import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.8";

import { checkMonthlyCap, db, recordCall, toSummary, type MaterialRow } from "../_shared/db.ts";
import { env } from "../_shared/env.ts";
import { fail, json, preflight } from "../_shared/http.ts";
import { analyzeMaterial, isSupportedMediaType, type SupportedMediaType } from "../_shared/model.ts";
import { StudySetError } from "../_shared/studySet.ts";

/**
 * POST /analyze
 *
 * גוף הבקשה:
 *   { deviceId, title, source: "pdf" | "camera", mediaType, fileBase64, pageCount? }
 *
 * מחזיר 202 מיד עם החומר במצב "בעיבוד", וממשיך לעבוד ברקע. הקריאה למודל
 * יכולה לקחת דקה ויותר, וזה ארוך מדי כדי להשאיר תלמיד מול מסך טעינה על
 * רשת סלולרית. מסך הבית מציג "בעיבוד" ומתעדכן כשהעיבוד נגמר.
 */

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

/** 20MB בבסיס 64 ≈ 15MB קובץ. מגבלת הבקשה של המודל היא 32MB. */
const MAX_BASE64_LENGTH = 20 * 1024 * 1024;

type AnalyzeBody = {
  deviceId?: unknown;
  title?: unknown;
  source?: unknown;
  mediaType?: unknown;
  fileBase64?: unknown;
  pageCount?: unknown;
};

function isFilledString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

async function processMaterial(
  client: SupabaseClient,
  materialId: string,
  mediaType: SupportedMediaType,
  base64: string,
): Promise<void> {
  try {
    const { studySet, usage } = await analyzeMaterial(mediaType, base64);

    await recordCall(client, {
      materialId,
      model: env.model,
      ...usage,
      ok: true,
    });

    await client
      .from("materials")
      .update({ status: "ready", study_set: studySet, error: null })
      .eq("id", materialId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא מזוהה";

    // גם כשל נרשם: קריאה שנכשלה אחרי שהמודל כבר עבד עלתה כסף.
    await recordCall(client, {
      materialId,
      model: env.model,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      costUsd: 0,
      ok: false,
      error: message,
    });

    await client
      .from("materials")
      .update({
        status: "failed",
        error:
          error instanceof StudySetError
            ? "העיבוד הצליח אבל התוצאה לא הייתה במבנה הצפוי. נסה שוב."
            : message,
      })
      .eq("id", materialId);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return preflight();
  }

  if (request.method !== "POST") {
    return fail("method_not_allowed", "השתמש ב-POST", 405);
  }

  let body: AnalyzeBody;
  try {
    body = await request.json();
  } catch {
    return fail("invalid_json", "גוף הבקשה אינו JSON תקין", 400);
  }

  if (!isFilledString(body.deviceId)) {
    return fail("missing_device", "חסר deviceId", 400);
  }
  if (!isFilledString(body.title)) {
    return fail("missing_title", "חסרה כותרת לחומר", 400);
  }
  if (body.source !== "pdf" && body.source !== "camera") {
    return fail("invalid_source", 'source חייב להיות "pdf" או "camera"', 400);
  }
  if (!isFilledString(body.mediaType) || !isSupportedMediaType(body.mediaType)) {
    return fail("unsupported_media", "אפשר להעלות PDF או תמונה בלבד", 415);
  }
  if (!isFilledString(body.fileBase64)) {
    return fail("missing_file", "חסר קובץ", 400);
  }
  if (body.fileBase64.length > MAX_BASE64_LENGTH) {
    return fail("file_too_large", "הקובץ גדול מדי. נסה להעלות פחות עמודים", 413);
  }

  const client = db();

  try {
    const cap = await checkMonthlyCap(client);
    if (!cap.allowed) {
      return fail("monthly_cap_reached", cap.reason, 429);
    }
  } catch (error) {
    console.error("cap check failed", error);
    return fail("cap_check_failed", "בדיקת המסגרת החודשית נכשלה", 500);
  }

  const pageCount = typeof body.pageCount === "number" && body.pageCount > 0
    ? Math.floor(body.pageCount)
    : 0;

  const { data, error } = await client
    .from("materials")
    .insert({
      device_id: body.deviceId,
      title: body.title.trim().slice(0, 200),
      source: body.source,
      status: "processing",
      page_count: pageCount,
    })
    .select("*")
    .single<MaterialRow>();

  if (error || !data) {
    console.error("material insert failed", error?.message);
    return fail("insert_failed", "שמירת החומר נכשלה", 500);
  }

  const work = processMaterial(client, data.id, body.mediaType, body.fileBase64);

  // ברקע כשהריצה תומכת בזה; אחרת ממתינים, ובכל מקרה החומר כבר נשמר.
  if (typeof EdgeRuntime !== "undefined") {
    EdgeRuntime.waitUntil(work);
  } else {
    await work;
  }

  return json({ material: toSummary(data) }, 202);
});
