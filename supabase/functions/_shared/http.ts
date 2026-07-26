export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

/**
 * שגיאות חוזרות עם הודעה בעברית, כי היא מוצגת לתלמיד כמו שהיא.
 * ה-code נשאר באנגלית כדי שהאפליקציה תוכל להסתמך עליו.
 */
export function fail(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

export function preflight(): Response {
  return new Response("ok", { headers: corsHeaders });
}
