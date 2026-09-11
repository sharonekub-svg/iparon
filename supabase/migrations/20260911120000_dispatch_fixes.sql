-- שני תיקונים שהמתזמן נפל עליהם בייצור, בדקה הראשונה שלו.
--
-- 1. `set search_path = 'public, extensions, net'` אינו רשימה. המחרוזת
--    המצוטטת נקלטת כשם סכימה אחת, ולכן http_post לא נמצא וכל הפעלה
--    של המתזמן נפלה. הפתרון הנכון ממילא: שם מלא לכל אובייקט
--    (net.http_post) ו-search_path ריק.
--
-- 2. "ותיק מדי" נמדד מ-created_at, ולכן חומר שנוצר לפני שעתיים והוחזר
--    עכשיו לעיבוד סומן ככושל לפני שהמתזמן הספיק להעיר אותו פעם אחת.
--    updated_at מתעדכן בכל שינוי שלב: עבודה שזזה לא מתיישנת, עבודה
--    שקפאה כן. הבלם העיקרי ממילא הוא מונה הניסיונות.

create or replace function private.dispatch_chunks()
returns integer
language plpgsql
security definer
set search_path = ''
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

    perform net.http_post(
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

create or replace function private.fail_dead_study_sets()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_failed integer;
begin
  update public.study_sets
     set status = 'failed',
         stage  = 'failed',
         error  = 'העיבוד נעצר באמצע. העמודים הוחזרו ליתרה — אפשר לנסות שוב.'
   where status = 'processing'
     and (claimed_at is null or claimed_at < now() - interval '4 minutes')
     and (dispatch_attempts >= 4 or updated_at < now() - interval '45 minutes');

  get diagnostics v_failed = row_count;
  return v_failed;
end;
$$;

revoke all on function private.fail_dead_study_sets() from public, anon, authenticated;
