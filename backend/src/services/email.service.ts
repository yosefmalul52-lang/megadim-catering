import nodemailer from 'nodemailer';
import { IOrder } from '../models/Order';
import { generateAdminEmailHtml, generateCustomerEmailHtml, generateCateringCustomerEmailHtml, OrderTemplateData } from './email-templates';

/** Single source of truth: EMAIL_HOST, EMAIL_PORT (default 587), EMAIL_USER, EMAIL_PASS */
const EMAIL_USER = (process.env.EMAIL_USER || '').trim();
const EMAIL_PASS = process.env.EMAIL_PASS;

/**
 * From header for website-originated mail (SMTP user = dedicated Gmail; display name for clients).
 * Override display name with EMAIL_FROM_DISPLAY_NAME if needed.
 */
function getWebsiteFromHeader(): string {
  const display = (process.env.EMAIL_FROM_DISPLAY_NAME || 'Megadim Website').trim() || 'Megadim Website';
  const addr = (process.env.EMAIL_USER || '').trim();
  return `"${display}" <${addr}>`;
}

function createTransporter(): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false, // Must be false for port 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

/** Order payload for POST /order/send (cart checkout emails). */
export interface OrderEmailData {
  customerName: string;
  phone: string;
  customerEmail?: string;
  eventDate?: string;
  deliveryType: 'pickup' | 'delivery';
  address?: string;
  notes?: string;
  items: Array<{ id: string; name: string; quantity: number; price: number; category?: string }>;
  subtotal?: number;
  deliveryFee?: number;
  total: number;
  /** Human-readable order number (e.g. MG-123456) to include in email subject and body. */
  orderNumber?: string;
  /** When set, switches to catering-specific email templates. */
  cateringKind?: 'shabbat' | 'events';
  /** Extra labelled info for the catering email (meal type, guest count, etc.). */
  cateringExtraInfo?: Array<{ label: string; value: string }>;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = createTransporter();
    console.log('📧 EmailService: transporter created with host/port/user summary:', {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: Number(process.env.EMAIL_PORT) || 587,
      hasUser: !!EMAIL_USER,
      hasPass: !!EMAIL_PASS
    });
  }

  /**
   * Internal helper to wrap transporter.sendMail with strong logging & normalized errors.
   */
  private async sendMailWithLogging(
    context: string,
    options: nodemailer.SendMailOptions
  ): Promise<void> {
    try {
      await this.transporter.sendMail(options);
    } catch (error: any) {
      console.error('🚨 CRITICAL EMAIL ERROR in context:', context);
      console.error('🚨 Email error message:', error?.message || error);
      console.error('🚨 Email error details:', {
        name: error?.name,
        code: error?.code,
        command: error?.command,
        response: error?.response,
        responseCode: error?.responseCode
      });
      throw new Error(
        `Failed to send email (${context}). Please check server logs for SMTP credentials or connection issues.`
      );
    }
  }

  /**
   * Verify SMTP connection. Logs result to console.
   * @throws Error if connection fails
   */
  async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      console.log('✅ SMTP connection ready – server can send emails');
    } catch (error: any) {
      console.error('🚨 CRITICAL EMAIL ERROR during SMTP verifyConnection');
      console.error('🚨 Email verify error message:', error?.message || error);
      console.error('🚨 Email verify error details:', {
        name: error?.name,
        code: error?.code,
        command: error?.command,
        response: error?.response,
        responseCode: error?.responseCode
      });
      throw new Error(
        'Failed to verify SMTP connection. Please check EMAIL_HOST/PORT/USER/PASS environment variables and provider status.'
      );
    }
  }

  /**
   * Send contact form submission to the business owner inbox (OWNER_EMAIL).
   * SMTP auth uses EMAIL_USER; Reply-To is the customer's email so the business can reply in one click.
   */
  async sendContactFormToBusiness(payload: {
    name: string;
    phone: string;
    email?: string;
    message: string;
  }): Promise<void> {
    if (!EMAIL_USER || !EMAIL_PASS) {
      throw new Error('Email service is not configured (EMAIL_USER or EMAIL_PASS missing)');
    }
    const ownerEmail = (process.env.OWNER_EMAIL || '').trim();
    if (!ownerEmail) {
      throw new Error('OWNER_EMAIL is not configured');
    }
    const customerReplyEmail = (payload.email || '').trim();
    console.log('📧 Contact form: sending to owner', ownerEmail, customerReplyEmail ? `(reply-to: ${customerReplyEmail})` : '');
    const subject = `פנייה חדשה מאתר מגדים: ${escapeHtml(payload.name)}`;
    const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 560px; padding: 24px;">
        <h2 style="color: #0E1A24; margin: 0 0 16px;">פנייה חדשה מהאתר</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>שם:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(payload.name)}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>טלפון:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(payload.phone)}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>אימייל:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${payload.email ? escapeHtml(payload.email) : '—'}</td></tr>
        </table>
        <p style="margin: 16px 0 0; color: #333;"><strong>הודעה:</strong></p>
        <p style="margin: 8px 0 0; padding: 12px; background: #f8f9fa; border-radius: 8px; white-space: pre-wrap;">${escapeHtml(payload.message)}</p>
      </div>`;
    await this.sendMailWithLogging('contact-form', {
      from: getWebsiteFromHeader(),
      to: ownerEmail,
      replyTo: customerReplyEmail || undefined,
      subject,
      html
    });
    console.log('✅ Contact form email sent successfully to owner:', ownerEmail);
  }

  /**
   * Send two separate emails: (1) order details to business owner, (2) receipt to customer if provided.
   * Uses EMAIL_USER to authenticate; from/replyTo use BUSINESS_NAME and OWNER_EMAIL.
   */
  async sendOrderEmails(
    orderData: OrderEmailData,
    _adminEmail: string,
    customerEmail?: string
  ): Promise<void> {
    if (!EMAIL_USER || !EMAIL_PASS) {
      throw new Error('Email service is not configured (EMAIL_USER or EMAIL_PASS missing)');
    }

    const ownerEmail = (process.env.OWNER_EMAIL || '').trim();
    const businessName = process.env.BUSINESS_NAME || 'Megadim';

    if (!ownerEmail) {
      throw new Error('OWNER_EMAIL is not configured');
    }

    const templateData: OrderTemplateData = {
      customerName: orderData.customerName,
      customerPhone: orderData.phone,
      orderType: orderData.deliveryType,
      eventDate: orderData.eventDate,
      address: orderData.address,
      notes: orderData.notes,
      cartItems: orderData.items.map((item) => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        category: item.category
      })),
      subtotal: orderData.subtotal,
      deliveryFee: orderData.deliveryFee,
      totalPrice: orderData.total,
      orderNumber: orderData.orderNumber,
      cateringKind: orderData.cateringKind,
      cateringExtraInfo: orderData.cateringExtraInfo
    };

    const ownerHtml = generateAdminEmailHtml(templateData);
    const customerHtml = orderData.cateringKind
      ? generateCateringCustomerEmailHtml(templateData)
      : generateCustomerEmailHtml(templateData);

    const customerReplyTo =
      (typeof orderData.customerEmail === 'string' ? orderData.customerEmail.trim() : '') ||
      (typeof customerEmail === 'string' ? customerEmail.trim() : '') ||
      '';

    // 1. Send order details to the business owner (never to EMAIL_USER)
    await this.sendMailWithLogging('order:owner', {
      from: getWebsiteFromHeader(),
      to: ownerEmail,
      replyTo: customerReplyTo || undefined,
      subject: orderData.cateringKind
        ? `בקשת קייטרינג חדשה${orderData.orderNumber ? ` - ${orderData.orderNumber}` : ''} - ${businessName}`
        : `הזמנה חדשה התקבלה 🍽️${orderData.orderNumber ? ` - ${orderData.orderNumber}` : ''} - ${businessName}`,
      html: ownerHtml
    });

    // 2. Send receipt to the customer (if customer email provided)
    const customerEmailTrimmed = typeof customerEmail === 'string' ? customerEmail.trim() : '';
    if (customerEmailTrimmed) {
      await this.sendMailWithLogging('order:customer-receipt', {
        from: getWebsiteFromHeader(),
        replyTo: ownerEmail,
        to: customerEmailTrimmed,
        subject: orderData.cateringKind
          ? `אישור קבלת בקשת קייטרינג${orderData.orderNumber ? ` ${orderData.orderNumber}` : ''} - ${businessName}`
          : `אישור הזמנה${orderData.orderNumber ? ` ${orderData.orderNumber}` : ''} - ${businessName}`,
        html: customerHtml
      });
    }
  }

  /**
   * Send order confirmation email to the business owner (legacy: used by order.service after DB save).
   * Agency model: sends via EMAIL_USER, appears from BUSINESS_NAME, to OWNER_EMAIL (client).
   * Uses the same branded HTML templates as the newer sendOrderEmails flow.
   */
  async sendOrderEmail(order: IOrder): Promise<void> {
    try {
      const businessName = process.env.BUSINESS_NAME || 'Megadim';
      const ownerEmail = (process.env.OWNER_EMAIL || '').trim();
      if (!ownerEmail) {
        console.warn('⚠️ sendOrderEmail: OWNER_EMAIL not set – skipping legacy admin notification');
        return;
      }
      const customerReplyEmail = (order.customerDetails?.email || '').toString().trim();
      const deliveryType: 'pickup' | 'delivery' =
        order.customerDetails?.deliveryMethod === 'delivery' ? 'delivery' : 'pickup';

      const addressRaw = order.customerDetails?.address;
      const addressStr =
        typeof addressRaw === 'string'
          ? addressRaw
          : addressRaw && typeof addressRaw === 'object'
            ? [addressRaw.city, addressRaw.street, addressRaw.apartment].filter(Boolean).join(', ')
            : undefined;

      const templateData: OrderTemplateData = {
        customerName: order.customerDetails?.fullName || 'לא צוין',
        customerPhone: order.customerDetails?.phone || 'לא צוין',
        orderType: deliveryType,
        eventDate: order.customerDetails?.eventDate,
        address: addressStr,
        notes: order.customerDetails?.notes,
        cartItems: (order.items || []).map((item: any) => ({
          name: item.name,
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 0
        })),
        subtotal: order.subtotal ?? order.customerDetails?.subtotal,
        deliveryFee: order.deliveryFee ?? order.customerDetails?.deliveryFee,
        totalPrice: order.totalPrice,
        orderNumber: order.orderNumber
      };

      const ownerHtml = generateAdminEmailHtml(templateData);
      const customerHtml = generateCustomerEmailHtml(templateData);

      await this.sendMailWithLogging('order:legacy-admin', {
        from: getWebsiteFromHeader(),
        to: ownerEmail,
        replyTo: customerReplyEmail || undefined,
        subject: `הזמנה חדשה התקבלה 🍽️${order.orderNumber ? ` - ${order.orderNumber}` : ''} - ${businessName}`,
        html: ownerHtml
      });

      // Also send receipt to the customer when email is available
      if (customerReplyEmail) {
        await this.sendMailWithLogging('order:legacy-customer-receipt', {
          from: getWebsiteFromHeader(),
          replyTo: ownerEmail,
          to: customerReplyEmail,
          subject: `אישור הזמנה${order.orderNumber ? ` ${order.orderNumber}` : ''} - ${businessName}`,
          html: customerHtml
        });
        console.log('✅ Order receipt sent to customer:', customerReplyEmail);
      }

      console.log('✅ Order confirmation email sent:', order._id);
    } catch (error: any) {
      console.error('❌ Error sending order email (legacy admin):', error?.message || error);
      console.error('❌ Email error details (legacy admin):', {
        message: error?.message,
        code: error?.code,
        response: error?.response
      });
    }
  }

  /**
   * Send "order approved and being prepared" email to the customer (when admin sets status to 'processing').
   * Gold brand theme. No-op if customer has no email.
   */
  async sendOrderApprovedToCustomer(order: IOrder): Promise<void> {
    const toEmail = (order.customerDetails?.email || '').toString().trim();
    if (!toEmail) {
      console.warn('⚠️ Order approved but customer has no email – skipping approval email');
      return;
    }
    if (!EMAIL_USER || !EMAIL_PASS) {
      console.warn('⚠️ Email not configured – skipping approval email to customer');
      return;
    }
    const businessName = process.env.BUSINESS_NAME || 'Megadim';
    const ownerEmail = (process.env.OWNER_EMAIL || '').trim();
    const customerName = order.customerDetails?.fullName || 'לקוח/ה';
    const orderIdShort = order._id?.toString().slice(-8) || '';

    const itemsList = (order.items || [])
      .map(
        (item: any, i: number) =>
          `${i + 1}. ${item.name} – כמות: ${item.quantity}, סה"כ: ₪${((item.price || 0) * (item.quantity || 0)).toFixed(2)}`
      )
      .join('<br/>');

    const html = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: linear-gradient(180deg, #fefaf2 0%, #f7ecd3 100%); border: 1px solid #e2cfa4;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #0E1A24; margin: 0 0 8px;">הזמנתך אושרה!</h1>
          <p style="color: #1f3540; font-size: 1.1em; margin: 0;">קייטרינג מגדים</p>
          <div style="height: 3px; background: linear-gradient(90deg, transparent, #e0c075, transparent); margin: 16px auto; max-width: 200px;"></div>
        </div>
        <p style="color: #333; font-size: 1.05em; line-height: 1.6;">שלום ${escapeHtml(customerName)},</p>
        <p style="color: #333; font-size: 1.05em; line-height: 1.6;"><strong>הזמנתך מקייטרינג מגדים אושרה!</strong> השפים שלנו כבר התחילו בהכנות.</p>
        <div style="background: #fff; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid rgba(224, 192, 117, 0.4); box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <h3 style="color: #0E1A24; border-bottom: 2px solid #e0c075; padding-bottom: 10px; margin: 0 0 16px;">פרטי ההזמנה</h3>
          <p style="margin: 0 0 8px;"><strong>מספר הזמנה:</strong> #${orderIdShort}</p>
          <p style="margin: 0 0 8px;"><strong>סה"כ:</strong> <span style="color: #e0c075; font-weight: bold;">₪${(order.totalPrice ?? 0).toFixed(2)}</span></p>
          <p style="margin: 0 0 8px;"><strong>פריטים:</strong></p>
          <div style="color: #555; font-size: 0.95em;">${itemsList}</div>
        </div>
        <p style="color: #666; font-size: 0.95em;">נעדכן כשההזמנה תהיה מוכנה. לכל שאלה – צרו איתנו קשר.</p>
        <p style="color: #0E1A24; font-weight: 600;">בתיאבון,<br/>צוות מגדים</p>
      </div>`;

    await this.sendMailWithLogging('order:approved-customer', {
      from: getWebsiteFromHeader(),
      replyTo: ownerEmail || undefined,
      to: toEmail,
      subject: `הזמנתך אושרה – ${businessName}`,
      html
    });
    console.log('✅ Order approved email sent to customer:', toEmail);
  }

  /**
   * Send catering order (שבת וחג) using the same email flow as "אוכל מוכן" – same templates, same recipient logic.
   * Converts catering payload to OrderEmailData and calls sendOrderEmails.
   */
  async sendCateringOrderEmails(
    data: {
      fullName: string;
      phone: string;
      email: string;
      numberOfPortions: string;
      eventDate: string;
      mealTime: string;
      salads: string[];
      firstCourses: string[];
      mainCourses: string[];
      sidesEvening: string[];
      sidesMorning: string[];
      seudaShlishit: string;
      deliveryType: 'pickup' | 'delivery';
      address: string;
      remarks: string;
    },
    ownerEmail: string,
    customerEmail?: string
  ): Promise<void> {
    const mealTimeLabel =
      data.mealTime === 'evening'
        ? 'ערב שבת'
        : data.mealTime === 'morning'
          ? 'שבת בבוקר'
          : 'שתי ארוחות שבת';
    const notesParts = [
      `קייטרינג שבת וחג. מספר מנות: ${data.numberOfPortions}`,
      `סוג ארוחה: ${mealTimeLabel}`,
      `סעודה שלישית: ${data.seudaShlishit === 'yes' ? 'כן' : 'לא'}`
    ];
    if (data.remarks && data.remarks.trim()) notesParts.push(`הערות: ${data.remarks.trim()}`);
    const notes = notesParts.join(' | ');

    const items: Array<{ id: string; name: string; quantity: number; price: number; category: string }> = [];
    (data.salads || []).filter((s) => s && String(s).trim()).forEach((s) => items.push({ id: '', name: String(s).trim(), quantity: 1, price: 0, category: 'סלטים' }));
    (data.firstCourses || []).filter((s) => s && String(s).trim()).forEach((s) => items.push({ id: '', name: String(s).trim(), quantity: 1, price: 0, category: 'מנות ראשונות' }));
    (data.mainCourses || []).filter((s) => s && String(s).trim()).forEach((s) => items.push({ id: '', name: String(s).trim(), quantity: 1, price: 0, category: 'מנות עיקריות' }));
    (data.sidesEvening || []).filter((s) => s && String(s).trim()).forEach((s) => items.push({ id: '', name: String(s).trim(), quantity: 1, price: 0, category: 'תוספות ערב' }));
    (data.sidesMorning || []).filter((s) => s && String(s).trim()).forEach((s) => items.push({ id: '', name: String(s).trim(), quantity: 1, price: 0, category: 'תוספות בוקר' }));

    const cateringExtraInfo: Array<{ label: string; value: string }> = [
      { label: 'מספר מנות', value: String(data.numberOfPortions) },
      { label: 'סוג ארוחה', value: mealTimeLabel },
      { label: 'סעודה שלישית', value: data.seudaShlishit === 'yes' ? 'כן' : 'לא' }
    ].filter((r) => r.value && r.value.trim());

    const orderData: OrderEmailData = {
      customerName: data.fullName,
      phone: data.phone,
      customerEmail: data.email,
      eventDate: data.eventDate,
      deliveryType: data.deliveryType,
      address: data.address || undefined,
      notes: data.remarks && data.remarks.trim() ? data.remarks : undefined,
      items,
      total: 0,
      cateringKind: 'shabbat',
      cateringExtraInfo
    };
    await this.sendOrderEmails(orderData, ownerEmail, customerEmail ?? data.email);
  }
}

/** Singleton for use in controllers and server startup. */
export const emailService = new EmailService();
