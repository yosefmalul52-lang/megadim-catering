/**
 * Central kill switch for all order-related customer (and combined) emails.
 * Default: OFF (unset / false). Must be explicitly enabled with true/1/yes/on.
 */

export function isOrderCustomerEmailsEnabled(): boolean {
  const raw = String(process.env.ORDER_CUSTOMER_EMAILS_ENABLED ?? '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
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
