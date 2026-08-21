const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** שגיאה גולמית אף פעם לא מגיעה למסך. הודעה בעברית, הפירוט ללוג. */
export function fail(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}
