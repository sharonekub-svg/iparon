-- מי מורשה להעיר את העובד.
--
-- הפונקציה קיבלה עד עכשיו כל בקשה עם JWT תקין וסמכה על מזהה החומר
-- שבגוף הבקשה. כלומר כל משתמש מחובר יכול היה להפעיל עיבוד על חומר
-- של מישהו אחר — ולחייב אותו. זה היה חור לפני המתזמן, והמתזמן רק
-- הופך אותו לבולט.
--
-- מעכשיו שלוש דרכים להיכנס, ורק הן:
--   1. הבעלים עצמו — sub ב-JWT שווה ל-user_id של החומר.
--   2. service_role — קריאה פנימית.
--   3. אסימון חד-פעמי שהמתזמן שתל בשורה. הוא נמחק ברגע שנתבע.
--
-- האסימון הוא מה שמאפשר למתזמן לעבוד עם מפתח anon במקום עם מפתח
-- service_role: המפתח פותח את השער, האסימון קובע על מה מותר לעבוד.

alter table public.study_sets
  add column if not exists dispatch_token uuid;

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

  for v_id in
    select id
      from public.study_sets
     where status = 'processing'
       -- אין עובד חי: או שאף אחד לא תבע את החומר, או שהתובע מת.
       and (claimed_at is null or claimed_at < now() - interval '4 minutes')
       -- ארבעה ניסיונות למנה. המונה מתאפס בכל מנה שמסתיימת.
       and dispatch_attempts < 4
       -- לא מעירים פעמיים את אותה מנה בתוך חלון של הפעלה אחת.
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
