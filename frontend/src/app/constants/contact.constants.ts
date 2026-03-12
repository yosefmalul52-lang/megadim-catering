/**
 * Centralized business contact info.
 * Update here to change phone/WhatsApp across the app (fallbacks and static links).
 */

/** Display format for UI (e.g. header, footer, placeholders) */
export const CONTACT_PHONE_DISPLAY = '073-367-8399';

/** Full tel: href for click-to-call */
export const CONTACT_TEL_HREF = 'tel:+972733678399';

/** WhatsApp link (with optional query later) */
export const CONTACT_WHATSAPP_HREF = 'https://wa.me/972733678399';

/** E.164-style digits only for 972733678399 (no +) – useful when building wa.me from stored phone */
export const CONTACT_PHONE_E164 = '972733678399';
