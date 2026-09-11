-- ניסיון חוזר מאפס את סימון ההחזר.
--
-- credit_refunded נועד למנוע החזר כפול על אותו כישלון, אבל הוא נשאר
-- דלוק לנצח: חומר שנכשל, קיבל החזר, ואז נוסה שוב ונכשל שוב — חויב
-- בפעם השנייה ולא קיבל את הכסף בחזרה. כל מעבר חזרה לעיבוד הוא
-- כישלון חדש שעדיין לא הוחזר.

create or replace function public.reset_refund_on_retry()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'processing' and old.status = 'failed' then
    new.credit_refunded := false;
  end if;
  return new;
end;
$$;

drop trigger if exists study_sets_reset_refund_on_retry on public.study_sets;

-- לפני טריגר ההחזר, כדי שמצב "נכשל שוב" ייראה כמו כישלון ראשון.
create trigger study_sets_reset_refund_on_retry
  before update on public.study_sets
  for each row
  execute function public.reset_refund_on_retry();
