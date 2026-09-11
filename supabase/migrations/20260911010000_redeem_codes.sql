-- LamdAI — קודי הפעלה
--
-- שלב ביניים עד שהסליקה חיה: התלמיד יוצר קשר, מעביר תשלום בעצמו,
-- ומקבל קוד. הקוד מוקלד באתר ופותח את המסלול המורחב.
--
-- שני כללים שקובעים את המבנה כאן:
--   1. לתלמיד אין ולא תהיה גישת קריאה לטבלה. select על טבלת קודים הוא
--      רשימת מנויים בחינם לכל מי שפותח את הקונסול.
--   2. המימוש חייב להיות אטומי. שני טאבים שמקלידים את אותו קוד באותו
--      רגע — רק אחד מהם מקבל חודש.

create table public.redeem_codes (
  code        text primary key check (code = upper(code) and char_length(code) between 8 and 32),
  months      integer not null default 1 check (months between 1 and 24),
  note        text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  redeemed_by uuid references auth.users (id) on delete set null,
  redeemed_at timestamptz
);

create index redeem_codes_redeemed_idx on public.redeem_codes (redeemed_at desc nulls last);

alter table public.redeem_codes enable row level security;
-- אין כאן אף policy, בכוונה. RLS בלי policy = אין גישה לאף אחד חוץ
-- מ-service role. הדרך היחידה לגעת בקודים היא הפונקציות שלמטה.

-- ── מימוש קוד ──────────────────────────────────────────────────────────

create or replace function public.redeem_code(p_code text)
returns table (ok boolean, message text, valid_until timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_code  text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_row   public.redeem_codes;
  v_until timestamptz;
begin
  if v_user is null then
    return query select false, 'צריך להתחבר כדי להפעיל קוד.'::text, null::timestamptz;
    return;
  end if;

  -- for update נועל את השורה עד סוף הטרנזקציה. בלעדיו שתי בקשות
  -- במקביל היו קוראות "לא מומש" ושתיהן היו מקבלות חודש.
  select * into v_row from public.redeem_codes
   where code = v_code
     for update;

  if not found then
    return query select false, 'הקוד לא קיים. בדוק שהוקלד נכון.'::text, null::timestamptz;
    return;
  end if;

  if v_row.redeemed_by is not null then
    return query select false, 'הקוד כבר מומש.'::text, null::timestamptz;
    return;
  end if;

  if v_row.expires_at is not null and v_row.expires_at < now() then
    return query select false, 'פג תוקפו של הקוד.'::text, null::timestamptz;
    return;
  end if;

  update public.redeem_codes
     set redeemed_by = v_user, redeemed_at = now()
   where code = v_code;

  v_until := public.grant_premium(v_user, v_row.months);

  -- נרשם גם בטבלת התשלומים, כדי שתהיה תמונה אחת של מי שילם ואיך.
  -- הסכום 0 כי הכסף עבר מחוץ למערכת.
  insert into public.payments
    (user_id, provider, provider_txn_uid, status, amount_agorot, months_granted, raw)
  values
    (v_user, 'manual', 'code:' || v_code, 'approved', 0, v_row.months,
     jsonb_build_object('code', v_code, 'note', v_row.note));

  return query select true, 'המסלול נפתח. בהצלחה.'::text, v_until;
end;
$$;

revoke all on function public.redeem_code(text) from public, anon;
grant execute on function public.redeem_code(text) to authenticated;

-- ── ייצור קודים ────────────────────────────────────────────────────────
-- מיועדת להרצה ידנית מ-SQL Editor של Supabase (שרץ כ-postgres):
--   select * from public.create_redeem_codes(5, 1, 'ביט — דני');
--
-- האלפבית בלי 0/O/1/I/L — קוד מוכתב בוואטסאפ ומוקלד בטלפון, וזוגות
-- התווים האלה הם מקור הטעויות.

create or replace function public.create_redeem_codes(
  p_count  integer default 1,
  p_months integer default 1,
  p_note   text default null
)
returns table (code text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_code text;
  i integer;
  j integer;
begin
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

      -- התנגשות היא כמעט בלתי אפשרית, אבל "כמעט" בטבלה עם מפתח ראשי
      -- הוא שגיאה שתצוץ פעם אחת בדיוק ברגע הלא נכון.
      exit when not exists (select 1 from public.redeem_codes r where r.code = v_code);
    end loop;

    insert into public.redeem_codes (code, months, note) values (v_code, p_months, p_note);
    code := v_code;
    return next;
  end loop;
end;
$$;

revoke all on function public.create_redeem_codes(integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.create_redeem_codes(integer, integer, text) to service_role;
