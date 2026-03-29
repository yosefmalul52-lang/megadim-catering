/** Standard UTM keys we persist and forward to n8n. */
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

export type MarketingDataRecord = Partial<Record<(typeof UTM_KEYS)[number], string>>;

/**
 * Keeps only known UTM string fields from an arbitrary request body.
 */
export function sanitizeMarketingData(raw: unknown): MarketingDataRecord | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  const out: MarketingDataRecord = {};
  for (const k of UTM_KEYS) {
    const v = o[k];
    if (typeof v === 'string' && v.trim() !== '') {
      out[k] = v.trim();
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * POST JSON to an external webhook (e.g. n8n). Fail-open: never throws; logs errors only.
 */
export async function fireWebhook(url: string | undefined, payload: unknown): Promise<void> {
  const u = typeof url === 'string' ? url.trim() : '';
  if (!u) {
    return;
  }
  try {
    const res = await fetch(u, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error(
        `[webhook] HTTP ${res.status} ${res.statusText} for ${u.substring(0, 80)}${u.length > 80 ? '…' : ''}`
      );
    }
  } catch (err) {
    console.error('[webhook] Request failed:', err);
  }
}
