/** The message an edge function sent back with a non-2xx answer (supabase-js hides it behind a generic error). */
export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const response = (error as { context?: unknown } | null)?.context;
  if (response instanceof Response) {
    try {
      const body = (await response.clone().json()) as { error?: string; retryAfter?: number };
      if (body.error === 'locked') {
        const minutes = Math.max(1, Math.ceil((body.retryAfter ?? 60) / 60));
        return `Too many wrong tries. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
      }
      if (body.error) return body.error;
    } catch {
      // not JSON: fall through to the fallback
    }
  }
  return fallback;
}
