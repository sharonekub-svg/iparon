-- מתזמן מנות בתוך המסד, במקום שרשרת הפעלות ודפדפן פתוח.
--
-- מה שהיה: כל הפעלה של העובד סיימה מנה וקראה לעצמה למנה הבאה
-- (fetch בלי await). זה לא עובד. ה-isolate נהרג ברגע שהעבודה
-- הסתיימה, לפני שהבקשה היוצאת בכלל נשלחה — בלוג נראתה שורת shutdown
-- אחת, ואחריה שקט מוחלט. החומר נשאר תקוע ב-processing לנצח.
--
-- התיקון הזמני היה להשעין את ההמשך על מסך העיבוד בדפדפן. גם זה לא
-- החזיק: תלמיד שסוגר טאב עוצר את העיבוד שלו, ומסך שנשאר פתוח שעות
-- עם כתיבה כל 2.5 שניות החניק את המסד.
--
-- מעכשיו: המסד עצמו מתזמן. pg_cron מריץ dispatcher שמחפש חומר
-- בעיבוד שאין עליו עובד חי, ומעיר את הפונקציה דרך pg_net. זה עובד
-- גם כשאין אף דפדפן פתוח, וגם כשהפעלה מתה באמצע מנה.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.study_sets
  add column if not exists dispatched_at     timestamptz,
  add column if not exists dispatch_attempts integer not null default 0
    check (dispatch_attempts >= 0);

-- החומר שמחכה למנה הבאה נמצא לפי claimed_at ריק. אינדקס חלקי, כי
-- הרוב המוחלט של השורות כבר ready והדispatcher לא מסתכל עליהן.
create index if not exists study_sets_processing_idx
  on public.study_sets (created_at)
  where status = 'processing';

-- ── הנעילה נשברת מהר יותר ──────────────────────────────────────────────
-- מנה אחת לוקחת עד ~150 שניות (מגבלת הזמן של Edge Function). נעילה
-- של 5 דקות הייתה אומרת שהמתזמן מחכה יותר ממה שצריך אחרי הפעלה שמתה.

create or replace function public.claim_study_set(p_study_set_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed boolean;
begin
  update public.study_sets
     set claimed_at = now()
   where id = p_study_set_id
     and status <> 'ready'
     and (claimed_at is null or claimed_at < now() - interval '3 minutes')
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

revoke all on function public.claim_study_set(uuid) from public, anon, authenticated;
grant execute on function public.claim_study_set(uuid) to service_role;

-- ── המתזמן ─────────────────────────────────────────────────────────────
-- הכתובת ומפתח ה-service role יושבים ב-Vault, לא בקוד ולא בטבלה
-- רגילה: dispatcher עם security definer שמחזיק מפתח בטקסט גלוי הוא
-- דלת אחורית לכל מי שמצליח לקרוא את הגדרת הפונקציה.

create or replace function private.dispatch_chunks()
returns integer
language plpgsql
security definer
set search_path = 'public, extensions, net, vault'
as $$
declare
  v_url  text;
  v_key  text;
  v_id   uuid;
  v_sent integer := 0;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'lamdai_functions_url';
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'lamdai_service_role_key';

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
    update public.study_sets
       set dispatched_at     = now(),
           dispatch_attempts = dispatch_attempts + 1
     where id = v_id;

    perform http_post(
      url     := v_url || '/functions/v1/process-material',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || v_key
                 ),
      body    := jsonb_build_object('studySetId', v_id),
      timeout_milliseconds := 5000
    );

    v_sent := v_sent + 1;
  end loop;

  return v_sent;
end;
$$;

revoke all on function private.dispatch_chunks() from public, anon, authenticated;

-- ── מי שכבר לא יקום ────────────────────────────────────────────────────
-- ההחזר עצמו קורה בטריגר study_sets_refund_on_error.

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
     and (dispatch_attempts >= 4 or created_at < now() - interval '45 minutes');

  get diagnostics v_failed = row_count;
  return v_failed;
end;
$$;

revoke all on function private.fail_dead_study_sets() from public, anon, authenticated;

-- ── התזמון ─────────────────────────────────────────────────────────────
-- pg_cron 1.5 ומעלה יודע לתזמן בשניות. אם הגרסה כאן לא יודעת, נופלים
-- לדקה — איטי יותר, אבל עדיין עובד בלי אף דפדפן פתוח.

do $$
begin
  perform cron.unschedule('lamdai-dispatch-chunks');
exception when others then null;
end;
$$;

do $$
begin
  perform cron.schedule('lamdai-dispatch-chunks', '10 seconds',
                        $cron$select private.dispatch_chunks()$cron$);
exception when others then
  perform cron.schedule('lamdai-dispatch-chunks', '* * * * *',
                        $cron$select private.dispatch_chunks()$cron$);
end;
$$;

do $$
begin
  perform cron.unschedule('lamdai-fail-dead-sets');
exception when others then null;
end;
$$;

select cron.schedule('lamdai-fail-dead-sets', '* * * * *',
                     $cron$select private.fail_dead_study_sets()$cron$);
