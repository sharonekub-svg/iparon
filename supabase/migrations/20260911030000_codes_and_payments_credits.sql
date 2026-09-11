-- קודי הפעלה ותשלומים עוברים גם הם ליחידות העלאה.

alter table public.redeem_codes
  add column uploads integer not null default 0 check (uploads >= 0),
  add column pack    text references public.credit_packs (slug);

-- ── מימוש קוד ──────────────────────────────────────────────────────────

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

  -- for update נועל את השורה עד סוף הטרנזקציה. בלעדיו שתי בקשות
  -- במקביל היו קוראות "לא מומש" ושתיהן היו מזכות.
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

  if v_row.uploads < 1 then
    return query select false, 'הקוד לא תקין. פנה אלינו.'::text, 0;
    return;
  end if;

  update public.redeem_codes
     set redeemed_by = v_user, redeemed_at = now()
   where code = v_code;

  v_balance := public.grant_credits(v_user, v_row.uploads, 'code:' || v_code);

  -- נרשם גם בטבלת התשלומים, כדי שתהיה תמונה אחת של מי שילם ואיך.
  -- הסכום 0 כי הכסף עבר מחוץ למערכת.
  insert into public.payments
    (user_id, provider, provider_txn_uid, status, amount_agorot, months_granted, raw)
  values
    (v_user, 'manual', 'code:' || v_code, 'approved', 0, 0,
     jsonb_build_object('code', v_code, 'uploads', v_row.uploads, 'note', v_row.note));

  return query select true,
    ('הקוד הופעל. נוספו לך ' || v_row.uploads || ' העלאות.')::text,
    v_balance;
end;
$$;

revoke all on function public.redeem_code(text) from public, anon;
grant execute on function public.redeem_code(text) to authenticated;

-- ── ייצור קודים לפי חבילה ──────────────────────────────────────────────
-- מיועדת להרצה ידנית מ-SQL Editor של Supabase:
--   select * from public.create_redeem_codes('exam', 5, 'ביט — דני');

drop function if exists public.create_redeem_codes(integer, integer, text);

create or replace function public.create_redeem_codes(
  p_pack  text,
  p_count integer default 1,
  p_note  text default null
)
returns table (code text, uploads integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_uploads integer;
  v_code text;
  i integer;
  j integer;
begin
  select cp.uploads into v_uploads from public.credit_packs cp where cp.slug = p_pack;

  if v_uploads is null then
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

    insert into public.redeem_codes (code, months, uploads, pack, note)
    values (v_code, 1, v_uploads, p_pack, p_note);

    code := v_code;
    uploads := v_uploads;
    return next;
  end loop;
end;
$$;

revoke all on function public.create_redeem_codes(text, integer, text)
  from public, anon, authenticated;
grant execute on function public.create_redeem_codes(text, integer, text) to service_role;

-- ── תשלום בכרטיס אשראי מזכה ביחידות ────────────────────────────────────

drop function if exists public.record_payment(uuid, text, text, boolean, integer, integer, jsonb);

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

  -- סכום נמוך ממחיר החבילה נרשם ככישלון ולא מזכה. לא raise: אחרת
  -- הרישום מתגלגל לאחור, הספק מנסה שוב בלי סוף, ואין תיעוד למה.
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

  v_balance := public.grant_credits(p_user_id, v_pack.uploads, 'payment:' || p_txn_uid);
  return v_balance;
end;
$$;

revoke all on function public.record_payment(uuid, text, text, boolean, integer, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_payment(uuid, text, text, boolean, integer, text, jsonb)
  to service_role;
