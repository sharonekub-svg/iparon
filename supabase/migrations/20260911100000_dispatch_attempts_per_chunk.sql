-- מונה הניסיונות נספר לכל מנה בנפרד, והמסד הוא שמאפס אותו.
--
-- העובד מאפס אותו כשהוא מתקדם למנה הבאה, אבל אסור שהספירה תהיה
-- תלויה בגרסת העובד שפרוסה כרגע: מונה שלא מתאפס אומר שחומר עם חמש
-- מנות מסומן ככושל אחרי הרביעית. המתזמן מחזיק את מספר המנה שאליה
-- שייכים הניסיונות, ומאפס ברגע שהמנה התחלפה.

alter table public.study_sets
  add column if not exists dispatch_chunk integer not null default 0;

create or replace function private.dispatch_chunks()
returns integer
language plpgsql
security definer
set search_path = 'public, extensions, net, vault'
as $$
declare
  v_url   text;
  v_key   text;
  v_id    uuid;
  v_token uuid;
  v_sent  integer := 0;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'lamdai_functions_url';
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'lamdai_dispatch_jwt';

  if v_url is null or v_key is null then
    return 0;
  end if;

  -- מנה חדשה = ספירה חדשה.
  update public.study_sets
     set dispatch_attempts = 0,
         dispatch_chunk    = chunk_index
   where status = 'processing'
     and dispatch_chunk <> chunk_index;

  for v_id in
    select id
      from public.study_sets
     where status = 'processing'
       and (claimed_at is null or claimed_at < now() - interval '4 minutes')
       and dispatch_attempts < 4
       and (dispatched_at is null or dispatched_at < now() - interval '30 seconds')
     order by created_at
     limit 5
  loop
    v_token := gen_random_uuid();

    update public.study_sets
       set dispatched_at     = now(),
           dispatch_attempts = dispatch_attempts + 1,
           dispatch_token    = v_token
     where id = v_id;

    perform http_post(
      url     := v_url || '/functions/v1/process-material',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || v_key
                 ),
      body    := jsonb_build_object('studySetId', v_id, 'token', v_token),
      timeout_milliseconds := 5000
    );

    v_sent := v_sent + 1;
  end loop;

  return v_sent;
end;
$$;

revoke all on function private.dispatch_chunks() from public, anon, authenticated;
