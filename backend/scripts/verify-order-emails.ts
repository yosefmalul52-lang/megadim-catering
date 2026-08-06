/**
 * Local/prod smoke check for order emails.
 * Usage: cd backend && npx ts-node --transpile-only scripts/verify-order-emails.ts
 *
 * Does NOT create a real order. Verifies:
 * 1) ORDER_CUSTOMER_EMAILS_ENABLED is on
 * 2) SMTP connects
 * 3) Owner receives a branded test "new order" email
 */
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const { isOrderCustomerEmailsEnabled } = await import(
    '../src/utils/order-customer-email-gate.util'
  );
  const { emailService } = await import('../src/services/email.service');

  const enabled = isOrderCustomerEmailsEnabled();
  const owner = (process.env.OWNER_EMAIL || '').trim();
  const hasSmtp = !!(process.env.EMAIL_USER || '').trim() && !!process.env.EMAIL_PASS;

  console.log('--- Order email preflight ---');
  console.log('ORDER_CUSTOMER_EMAILS_ENABLED:', process.env.ORDER_CUSTOMER_EMAILS_ENABLED);
  console.log('gate enabled:', enabled);
  console.log('has EMAIL_USER/PASS:', hasSmtp);
  console.log('OWNER_EMAIL set:', !!owner);

  if (!enabled) {
    console.error('FAIL: kill switch is OFF — set ORDER_CUSTOMER_EMAILS_ENABLED=true');
    process.exit(1);
  }
  if (!hasSmtp) {
    console.error('FAIL: EMAIL_USER / EMAIL_PASS missing');
    process.exit(1);
  }
  if (!owner) {
    console.error('FAIL: OWNER_EMAIL missing');
    process.exit(1);
  }

  console.log('Verifying SMTP...');
  await emailService.verifyConnection();

  const stamp = new Date().toISOString();
  console.log('Sending test order email to owner:', owner);
  await emailService.sendOrderEmails(
    {
      customerName: 'בדיקת מערכת (אל תטפל)',
      phone: '050-0000000',
      customerEmail: owner,
      eventDate: stamp.slice(0, 10),
      deliveryType: 'pickup',
      notes: `בדיקת מייל אוטומטית ${stamp} — אם קיבלת את זה, מערכת המיילים להזמנות פעילה.`,
      items: [{ id: 'test', name: 'פריט בדיקה', quantity: 1, price: 1 }],
      subtotal: 1,
      deliveryFee: 0,
      total: 1,
      orderNumber: `TEST-${Date.now()}`
    },
    owner,
    owner
  );

  console.log('OK: owner (+ copy to same address as customer receipt) sent successfully');
  console.log('Check inbox of', owner, '(and spam folder)');
}

main().catch((err) => {
  console.error('FAIL:', err?.message || err);
  process.exit(1);
});
