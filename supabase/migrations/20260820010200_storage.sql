-- LamdAI — אחסון הקבצים שהועלו
--
-- Bucket פרטי. הנתיב הוא {user_id}/{study_set_id}/{uuid}.{ext},
-- והמדיניות מוודאת שהמקטע הראשון בנתיב שווה למשתמש המחובר — כך
-- אי אפשר לכתוב לתיקייה של מישהו אחר ואי אפשר לקרוא ממנה.
--
-- file_size_limit ו-allowed_mime_types נאכפים על ידי Storage עצמו,
-- כלומר גם אם הלקוח ידלג על הבדיקה בצד שלו. בדיקת ה-magic bytes
-- נעשית בנוסף, בעובד, כי MIME שמגיע מהלקוח הוא הצהרה ולא ראיה.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials',
  'materials',
  false,
  15728640, -- 15MB
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy materials_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'materials'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy materials_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'materials'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy materials_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'materials'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
