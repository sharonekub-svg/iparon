-- החזר מאפס גם את הסימון שהחומר חויב.
--
-- בלי זה נוצר חור: עיבוד שנכשל מחזיר את העמודים, אבל pages_charged
-- נשאר מלא — ולכן ניסיון חוזר על אותו חומר לא גובה שוב (consume_pages
-- מזהה חיוב קיים ויוצאת). כלומר החזר אחד + עיבוד חינם.

create or replace function public.refund_failed_study_set()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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
    -- הכסף חזר, ולכן גם החיוב מתאפס: ניסיון חוזר הוא חיוב חדש.
    new.pages_charged := 0;
  end if;

  return new;
end;
$$;
