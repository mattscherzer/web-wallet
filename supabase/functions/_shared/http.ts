// Shared by the edge function handlers: CORS headers and a JSON reply helper. No Deno or Supabase imports.

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** A PIN is exactly six digits, kept as a string so a leading zero survives. */
export const PIN_PATTERN = /^\d{6}$/;
export const isPin = (value: unknown): value is string => typeof value === 'string' && PIN_PATTERN.test(value);
