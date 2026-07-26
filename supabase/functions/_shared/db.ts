import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.110.8";

import { env } from "./env.ts";
import type { StudySet } from "./studySet.ts";

/**
 * service role — עוקף RLS. הטבלאות חסומות לחלוטין מול המפתח הציבורי,
 * ולכן כל גישה לנתונים עוברת דרך הפונקציות האלה.
 */
export function db(): SupabaseClient {
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export type MaterialRow = {
  id: string;
  device_id: string;
  title: string;
  source: "pdf" | "camera";
  status: "processing" | "ready" | "failed";
  page_count: number;
  study_set: StudySet | null;
  error: string | null;
  created_at: string;
};

/** מה שהאפליקציה מקבלת: שדות מנורמלים, בלי device_id ובלי התוצאה המלאה. */
export type MaterialSummary = {
  id: string;
  title: string;
  createdAt: string;
  status: MaterialRow["status"];
  source: MaterialRow["source"];
  pageCount: number;
  flashcardCount: number;
  quizCount: number;
};

export function toSummary(row: MaterialRow): MaterialSummary {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    status: row.status,
    source: row.source,
    pageCount: row.page_count,
    flashcardCount: row.study_set?.flashcards.length ?? 0,
    quizCount: row.study_set?.quiz.length ?? 0,
  };
}

export type CapCheck =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * כלל ברזל 7: עצירה מעל התקרה החודשית.
 * נבדק לפני כל קריאה למודל, על סמך מה שנרשם בטבלת model_calls.
 */
export async function checkMonthlyCap(client: SupabaseClient): Promise<CapCheck> {
  const [caps, usage] = await Promise.all([
    client.from("usage_caps").select("max_calls_per_month, max_cost_usd_per_month").single(),
    client.rpc("month_usage").single<{ calls: number; cost_usd: number }>(),
  ]);

  if (caps.error) {
    throw new Error(`קריאת התקרה נכשלה: ${caps.error.message}`);
  }
  if (usage.error) {
    throw new Error(`ספירת השימוש נכשלה: ${usage.error.message}`);
  }

  if (usage.data.calls >= caps.data.max_calls_per_month) {
    return {
      allowed: false,
      reason: `נגמרה המסגרת החודשית (${caps.data.max_calls_per_month} עיבודים). נסה שוב בתחילת החודש הבא.`,
    };
  }

  if (Number(usage.data.cost_usd) >= Number(caps.data.max_cost_usd_per_month)) {
    return {
      allowed: false,
      reason: "נגמרה המסגרת החודשית. נסה שוב בתחילת החודש הבא.",
    };
  }

  return { allowed: true };
}

export async function recordCall(
  client: SupabaseClient,
  call: {
    materialId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    costUsd: number;
    ok: boolean;
    error?: string;
  },
): Promise<void> {
  const { error } = await client.from("model_calls").insert({
    material_id: call.materialId,
    model: call.model,
    input_tokens: call.inputTokens,
    output_tokens: call.outputTokens,
    cache_read_tokens: call.cacheReadTokens,
    cost_usd: call.costUsd,
    ok: call.ok,
    error: call.error ?? null,
  });

  // רישום השימוש הוא חלק מהגנת התקרה, ולכן כשל כאן לא נבלע בשקט
  if (error) {
    console.error("model_calls insert failed", error.message);
  }
}
