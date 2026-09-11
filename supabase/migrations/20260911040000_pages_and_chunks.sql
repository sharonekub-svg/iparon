-- LamdAI — היחידה עוברת מ"העלאה" ל"עמוד", והעיבוד עובר לחלקים
--
-- למה: קובץ טיפוסי הוא 20–60 עמודים, לא 6. במצב הקודם העלאה של 60
-- עמודים נדחתה לגמרי (תקרת 20), ובכל מקרה "העלאה" כיחידת מכירה הייתה
-- שקר כלכלי — 60 עמודים עולים לנו פי שלושה מ-20, ונמכרו באותו מחיר.
--
-- מעכשיו: מוכרים עמודים. גובים לפי מה שבאמת עובד.

alter table public.profiles rename column upload_credits to page_credits;

alter table public.study_sets
  rename column credit_charged to credits_charged;

alter table public.study_sets
  add column pages_charged integer not null default 0 check (pages_charged >= 0),
  -- העיבוד מתבצע במנות של עד 20 עמודים, כל מנה בהפעלה נפרדת של העובד.
  -- הפעלה אחת ארוכה על 60 עמודים חורגת ממגבלת הזמן של הפונקציה.
  add column chunk_index integer not null default 0 check (chunk_index >= 0),
  add column chunk_count integer not null default 1 check (chunk_count >= 1);

-- ── החבילות, בעמודים ───────────────────────────────────────────────────

alter table public.credit_packs rename column uploads to pages;

update public.credit_packs set pages = 60,  price_agorot = 2900  where slug = 'exam';
update public.credit_packs set pages = 180, price_agorot = 6900  where slug = 'term';
update public.credit_packs set pages = 450, price_agorot = 14900 where slug = 'bagrut';

update public.credit_packs set title = 'מבחן אחד' where slug = 'exam';
update public.credit_packs set title = 'מחצית'    where slug = 'term';
update public.credit_packs set title = 'בגרות'    where slug = 'bagrut';

alter table public.redeem_codes rename column uploads to pages;

-- ── זיכוי ──────────────────────────────────────────────────────────────

drop function if exists public.grant_credits(uuid, integer, text);

create or replace function public.grant_credits(
  target_user uuid,
  p_pages     integer,
  p_reason    text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
begin
  if p_pages is null or p_pages < 1 or p_pages > 5000 then
    raise exception 'כמות עמודים לא תקינה: %', p_pages;
  end if;

  update public.profiles
     set page_credits = page_credits + p_pages
   where id = target_user
  returning page_credits into v_balance;

  if v_balance is null then
    raise exception 'לא נמצא פרופיל למשתמש %', target_user;
  end if;

  insert into public.credit_events (user_id, delta, reason)
  values (target_user, p_pages, p_reason);

  return v_balance;
end;
$$;

revoke all on function public.grant_credits(uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.grant_credits(uuid, integer, text) to service_role;

-- ── גבייה לפי עמודים בפועל ─────────────────────────────────────────────
-- מספר העמודים האמיתי ידוע רק אחרי שהעובד פותח את ה-PDF, ולכן הטריגר
-- על היצירה בודק רק שיש יתרה, והגבייה עצמה כאן — אחרי הספירה ולפני
-- הקריאה הראשונה למודל.

create or replace function public.consume_pages(
  p_study_set_id uuid,
  p_pages        integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_set     public.study_sets;
  v_balance integer;
  v_pages   integer;
begin
  select * into v_set from public.study_sets where id = p_study_set_id;

  if v_set.id is null then
    raise exception 'החומר לא נמצא';
  end if;

  -- כבר נגבה על החומר הזה. קורה כשהעובד מופעל שוב על אותו חומר.
  if v_set.pages_charged > 0 then
    return v_set.pages_charged;
  end if;

  -- ההעלאה הראשונה של המשתמש היא על חשבוננו, בלי קשר לכמה עמודים בה.
  if not v_set.credits_charged then
    update public.study_sets set pages_charged = 0 where id = p_study_set_id;
    return 0;
  end if;

  -- חיוב מינימלי. הפלט של המודל עולה כמעט אותו דבר בכל קריאה, ולכן
  -- צילום של עמוד בודד עולה לנו יותר ממה שהוא מחויב. נקודת האיזון
  -- היא סביב 4 עמודים.
  v_pages := greatest(p_pages, 5);

  update public.profiles
     set page_credits = page_credits - v_pages
   where id = v_set.user_id
     and page_credits >= v_pages
  returning page_credits into v_balance;

  if v_balance is null then
    raise exception 'אין לך מספיק עמודים ביתרה' using errcode = '42501';
  end if;

  update public.study_sets set pages_charged = v_pages where id = p_study_set_id;

  insert into public.credit_events (user_id, delta, reason, study_set_id)
  values (v_set.user_id, -v_pages, 'pages', p_study_set_id);

  return v_balance;
end;
$$;

revoke all on function public.consume_pages(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_pages(uuid, integer) to service_role;

-- ── הטריגר: רק שער כניסה, בלי גבייה ────────────────────────────────────

create or replace function public.enforce_study_set_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total   integer;
  v_credits integer;
begin
  select count(*) into v_total from public.study_sets where user_id = new.user_id;

  if v_total = 0 then
    new.credits_charged := false;
    return new;
  end if;

  select page_credits into v_credits from public.profiles where id = new.user_id;

  if coalesce(v_credits, 0) < 1 then
    raise exception 'נגמרו לך העמודים. אפשר להוסיף עוד.' using errcode = '42501';
  end if;

  new.credits_charged := true;
  return new;
end;
$$;

-- ── החזר על עיבוד שנכשל ────────────────────────────────────────────────

create or replace function public.refund_failed_study_set()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- הסטטוס הוא 'failed' ולא 'error' (ראה study_set_status ב-init_schema).
  -- הגרסה הקודמת של הטריגר בדקה 'error', ולכן ההחזר לא היה קורה לעולם.
  if new.status = 'failed'
     and old.status is distinct from 'failed'
     and new.pages_charged > 0
     and not new.credit_refunded then

    update public.profiles
       set page_credits = page_credits + new.pages_charged
     where id = new.user_id;

    insert into public.credit_events (user_id, delta, reason, study_set_id)
    values (new.user_id, new.pages_charged, 'refund:error', new.id);

    new.credit_refunded := true;
  end if;

  return new;
end;
$$;

-- ── מה שהממשק רואה ─────────────────────────────────────────────────────

drop function if exists public.my_entitlements();

create or replace function public.my_entitlements()
returns table (
  credits   integer,
  sets_used integer,
  free_used boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(p.page_credits, 0),
    (select count(*)::integer from public.study_sets s where s.user_id = auth.uid()),
    (select count(*) from public.study_sets s where s.user_id = auth.uid()) > 0
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.my_entitlements() from public, anon;
grant execute on function public.my_entitlements() to authenticated;

create or replace function public.can_create_study_set(target_user uuid)
returns table (allowed boolean, reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total   integer;
  v_credits integer;
begin
  select count(*) into v_total from public.study_sets where user_id = target_user;

  if v_total = 0 then
    return query select true, null::text;
    return;
  end if;

  select page_credits into v_credits from public.profiles where id = target_user;

  if coalesce(v_credits, 0) > 0 then
    return query select true, null::text;
    return;
  end if;

  return query select false, 'נגמרו לך העמודים. אפשר להוסיף עוד.'::text;
end;
$$;

revoke all on function public.can_create_study_set(uuid) from public, anon, authenticated;
grant execute on function public.can_create_study_set(uuid) to service_role;

-- ── קוד הפעלה ותשלום, במונחי עמודים ────────────────────────────────────

create or replace function public.redeem_code(p_code text)
returns table (ok boolean, message text, credits integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user    uuid := auth.uid();
  v_code    text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_row     public.redeem_codes;
  v_balance integer;
begin
  if v_user is null then
    return query select false, 'צריך להתחבר כדי להפעיל קוד.'::text, 0;
    return;
  end if;

  select * into v_row from public.redeem_codes where code = v_code for update;

  if not found then
    return query select false, 'הקוד לא קיים. בדוק שהוקלד נכון.'::text, 0;
    return;
  end if;

  if v_row.redeemed_by is not null then
    return query select false, 'הקוד כבר מומש.'::text, 0;
    return;
  end if;

  if v_row.expires_at is not null and v_row.expires_at < now() then
    return query select false, 'פג תוקפו של הקוד.'::text, 0;
    return;
  end if;

  if v_row.pages < 1 then
    return query select false, 'הקוד לא תקין. פנה אלינו.'::text, 0;
    return;
  end if;

  update public.redeem_codes
     set redeemed_by = v_user, redeemed_at = now()
   where code = v_code;

  v_balance := public.grant_credits(v_user, v_row.pages, 'code:' || v_code);

  insert into public.payments
    (user_id, provider, provider_txn_uid, status, amount_agorot, months_granted, raw)
  values
    (v_user, 'manual', 'code:' || v_code, 'approved', 0, 0,
     jsonb_build_object('code', v_code, 'pages', v_row.pages, 'note', v_row.note));

  return query select true,
    ('הקוד הופעל. נוספו לך ' || v_row.pages || ' עמודים.')::text,
    v_balance;
end;
$$;

revoke all on function public.redeem_code(text) from public, anon;
grant execute on function public.redeem_code(text) to authenticated;

drop function if exists public.create_redeem_codes(text, integer, text);

create or replace function public.create_redeem_codes(
  p_pack  text,
  p_count integer default 1,
  p_note  text default null
)
returns table (code text, pages integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_pages integer;
  v_code text;
  i integer;
  j integer;
begin
  select cp.pages into v_pages from public.credit_packs cp where cp.slug = p_pack;

  if v_pages is null then
    raise exception 'אין חבילה בשם %. החבילות: exam, term, bagrut', p_pack;
  end if;

  if p_count < 1 or p_count > 100 then
    raise exception 'כמות קודים לא תקינה: %', p_count;
  end if;

  for i in 1..p_count loop
    loop
      v_code := 'LAMDAI-';
      for j in 1..8 loop
        v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
        if j = 4 then v_code := v_code || '-'; end if;
      end loop;
      exit when not exists (select 1 from public.redeem_codes r where r.code = v_code);
    end loop;

    insert into public.redeem_codes (code, months, pages, pack, note)
    values (v_code, 1, v_pages, p_pack, p_note);

    code := v_code;
    pages := v_pages;
    return next;
  end loop;
end;
$$;

revoke all on function public.create_redeem_codes(text, integer, text)
  from public, anon, authenticated;
grant execute on function public.create_redeem_codes(text, integer, text) to service_role;

create or replace function public.record_payment(
  p_user_id       uuid,
  p_provider      text,
  p_txn_uid       text,
  p_approved      boolean,
  p_amount_agorot integer,
  p_pack          text,
  p_raw           jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pack     public.credit_packs;
  v_balance  integer;
  v_approved boolean;
begin
  select * into v_pack from public.credit_packs where slug = p_pack;

  if v_pack.slug is null then
    raise exception 'אין חבילה בשם %', p_pack;
  end if;

  v_approved := p_approved and p_amount_agorot >= v_pack.price_agorot;

  insert into public.payments
    (user_id, provider, provider_txn_uid, status, amount_agorot, months_granted, raw)
  values
    (p_user_id, p_provider, p_txn_uid,
     case when v_approved then 'approved' else 'failed' end,
     p_amount_agorot, 0, p_raw);

  if not v_approved then
    return null;
  end if;

  v_balance := public.grant_credits(p_user_id, v_pack.pages, 'payment:' || p_txn_uid);
  return v_balance;
end;
$$;

revoke all on function public.record_payment(uuid, text, text, boolean, integer, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_payment(uuid, text, text, boolean, integer, text, jsonb)
  to service_role;

-- התקרה האישית היא בלם נגד שימוש חריג בלבד.
update public.usage_caps set max_uploads_per_user_per_month = 60 where id;

-- ── נעילת עיבוד ────────────────────────────────────────────────────────
-- העיבוד רץ בכמה הפעלות (מנה לכל הפעלה), ולכן שתי הפעלות שרצות במקביל
-- על אותו חומר היו מייצרות תוכן כפול. התביעה היא update מותנה: מי
-- שקיבל שורה, הוא שעובד. אחרי 5 דקות הנעילה נשברת מעצמה, כדי
-- שהפעלה שמתה באמצע לא תנעל חומר לנצח.

alter table public.study_sets
  add column claimed_at timestamptz;

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
     and (claimed_at is null or claimed_at < now() - interval '5 minutes')
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

revoke all on function public.claim_study_set(uuid) from public, anon, authenticated;
grant execute on function public.claim_study_set(uuid) to service_role;
