/**
 * Central kill switch for order-related emails (owner + customer).
 *
 * Explicit values:
 *   true/1/yes/on  → enabled
 *   false/0/no/off → disabled
 *
 * Unset:
 *   production → enabled (so live orders are never silently dropped)
 *   otherwise  → disabled (safe for local/tests)
 */

export function isOrderCustomerEmailsEnabled(): boolean {
  const raw = String(process.env.ORDER_CUSTOMER_EMAILS_ENABLED ?? '')
    .trim()
    .toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false;
  if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') return true;
  return process.env.NODE_ENV === 'production';
}

export type OrderEmailSuppressed = {
  sent: false;
  suppressed: true;
  skipped: 'emails_disabled';
  reason: string;
};

export function suppressOrderCustomerEmail(context: string): OrderEmailSuppressed {
  const reason = `ORDER_CUSTOMER_EMAILS_ENABLED=false (${context})`;
  console.warn(`[email] suppressed — ${reason}`);
  return {
    sent: false,
    suppressed: true,
    skipped: 'emails_disabled',
    reason
  };
}

/** When emails are disabled, refuse to acquire/create claims that could send later. */
export function assertOrderCustomerEmailsAllowedOrSuppress(
  context: string
): { ok: true } | OrderEmailSuppressed {
  if (isOrderCustomerEmailsEnabled()) return { ok: true };
  return suppressOrderCustomerEmail(context);
}
