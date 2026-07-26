/**
 * כלל ברזל 1: מפתח המודל נקרא כאן, בתוך ה-Edge Function, מ-Secrets
 * של פרויקט ה-Supabase. הוא לא עובר לאפליקציה ולא חוזר בתשובה.
 */
export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`חסר משתנה סביבה: ${name}`);
  }
  return value;
}

/** SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY מוזרקים אוטומטית על ידי Supabase */
export const env = {
  get anthropicApiKey() {
    return requireEnv("ANTHROPIC_API_KEY");
  },
  get supabaseUrl() {
    return requireEnv("SUPABASE_URL");
  },
  get serviceRoleKey() {
    return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  },
  /** אפשר לעקוף את המודל בלי לשנות קוד */
  get model() {
    return Deno.env.get("SHINUN_MODEL") ?? "claude-opus-5";
  },
} as const;
