-- LamdAI — תשלומים ומנוי
--
-- המוצר בתשלום: ההעלאה הראשונה חינם (מכסת free = חומר אחד), וכל השאר
-- מאחורי מנוי חודשי. הטבלה כאן היא הרישום של מה שנגבה בפועל, וההרשאה
-- עצמה נשארת במקום שבו היא כבר נאכפת — profiles.plan ו-plan_expires_at.
--
-- כלל: הדבר היחיד שמשדרג משתמש הוא grant_premium, והיא פתוחה ל-service
-- role בלבד. תלמיד לא יכול לשדרג את עצמו גם אם יקרא ל-RPC ישירות.

create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  provider         text not null default 'payplus',
  -- מזהה העסקה אצל הספק. unique הוא בלם הכפילות: ספק תשלומים שולח את
  -- אותו callback שוב כשלא קיבל 200, ובלי זה חודש היה נוסף פעמיים.
  provider_txn_uid text not null,
  status           text not null check (status in ('approved', 'failed')),
  amount_agorot    integer not null check (amount_agorot >= 0),
  months_granted   integer not null default 0 check (months_granted between 0 and 24),
  raw              jsonb,
  created_at       timestamptz not null default now(),
  unique (provider, provider_txn_uid)
);

create index payments_user_created_idx on public.payments (user_id, created_at desc);

alter table public.payments enable row level security;

-- המשתמש רואה את החיובים שלו. כתיבה היא של service role בלבד, ולכן
-- אין כאן שום policy של insert או update — גם לא לבעלים.
create policy payments_select_own on public.payments
  for select to authenticated
  using (user_id = auth.uid());

-- ── השדרוג עצמו ────────────────────────────────────────────────────────
-- מאריכה מהמאוחר מבין "עכשיו" ל"תוקף קיים", כדי שתשלום נוסף באמצע
-- חודש פעיל יוסיף חודש ולא יבלע את מה שנשאר.

create or replace function public.grant_premium(target_user uuid, months integer)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_until timestamptz;
begin
  if months is null or months < 1 or months > 24 then
    raise exception 'טווח חודשים לא תקין: %', months;
  end if;

  update public.profiles
     set plan = 'premium',
         plan_expires_at =
           greatest(coalesce(plan_expires_at, now()), now())
           + make_interval(months => months)
   where id = target_user
  returning plan_expires_at into v_until;

  if v_until is null then
    raise exception 'לא נמצא פרופיל למשתמש %', target_user;
  end if;

  return v_until;
end;
$$;

revoke all on function public.grant_premium(uuid, integer) from public, anon, authenticated;
grant execute on function public.grant_premium(uuid, integer) to service_role;

-- ── רישום תשלום ושדרוג, בטרנזקציה אחת ──────────────────────────────────
-- שתי הפעולות חייבות לקרות יחד. אם הרישום יקרה בנפרד מהשדרוג, callback
-- שיגיע שוב אחרי שדרוג שנכשל ייחסם על הכפילות ולא ישדרג לעולם — הכסף
-- נגבה והמשתמש נשאר חינמי. כאן: כפילות מפילה את הכול ואין חודש כפול,
-- וכישלון בשדרוג מגלגל לאחור גם את הרישום, כך שניסיון חוזר של הספק נקי.

create or replace function public.record_payment(
  p_user_id  uuid,
  p_provider text,
  p_txn_uid  text,
  p_approved boolean,
  p_amount_agorot integer,
  p_months   integer,
  p_raw      jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_until timestamptz;
begin
  insert into public.payments
    (user_id, provider, provider_txn_uid, status, amount_agorot, months_granted, raw)
  values
    (p_user_id, p_provider, p_txn_uid,
     case when p_approved then 'approved' else 'failed' end,
     p_amount_agorot,
     case when p_approved then p_months else 0 end,
     p_raw);

  if not p_approved then
    return null;
  end if;

  v_until := public.grant_premium(p_user_id, p_months);
  return v_until;
end;
$$;

revoke all on function public.record_payment(uuid, text, text, boolean, integer, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_payment(uuid, text, text, boolean, integer, integer, jsonb)
  to service_role;
