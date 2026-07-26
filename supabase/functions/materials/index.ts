import { db, toSummary, type MaterialRow } from "../_shared/db.ts";
import { fail, json, preflight } from "../_shared/http.ts";

/**
 * GET /materials?deviceId=...          → רשימת החומרים של המכשיר
 * GET /materials?deviceId=...&id=...   → חומר אחד, כולל התוצאה המלאה
 *
 * הטבלאות חסומות ב-RLS מול המפתח הציבורי, ולכן האפליקציה קוראת נתונים
 * רק מכאן. ה-deviceId נבדק בכל שאילתה, כדי שמכשיר לא יראה חומר של אחר.
 */

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return preflight();
  }

  if (request.method !== "GET") {
    return fail("method_not_allowed", "השתמש ב-GET", 405);
  }

  const url = new URL(request.url);
  const deviceId = url.searchParams.get("deviceId");
  const id = url.searchParams.get("id");

  if (!deviceId) {
    return fail("missing_device", "חסר deviceId", 400);
  }

  const client = db();

  if (id) {
    const { data, error } = await client
      .from("materials")
      .select("*")
      .eq("id", id)
      .eq("device_id", deviceId)
      .maybeSingle<MaterialRow>();

    if (error) {
      console.error("material select failed", error.message);
      return fail("select_failed", "טעינת החומר נכשלה", 500);
    }
    if (!data) {
      return fail("not_found", "החומר לא נמצא", 404);
    }

    return json({
      material: { ...toSummary(data), studySet: data.study_set, error: data.error },
    });
  }

  const { data, error } = await client
    .from("materials")
    .select("*")
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("materials select failed", error.message);
    return fail("select_failed", "טעינת הרשימה נכשלה", 500);
  }

  return json({ materials: (data as MaterialRow[]).map(toSummary) });
});
