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

/** Pre-filled message for website WhatsApp CTAs */
export const WHATSAPP_DEFAULT_MESSAGE =
  'היי, הגעתי מהאתר ואשמח לקבל פרטים על הזמנת קייטרינג.';

/** E.164-style digits only for 972733678399 (no +) – useful when building wa.me from stored phone */
export const CONTACT_PHONE_E164 = '972733678399';

/** Social media – open with target="_blank" rel="noopener noreferrer" */
export const CONTACT_FACEBOOK_URL = 'https://www.facebook.com/Megadimcatering/';
export const CONTACT_INSTAGRAM_URL = 'https://www.instagram.com/megadim_catering/';

/** Kashrut recommendation page for Megadim Catering on Kosharot */
export const KOSHAROT_RECOMMENDATION_URL =
  'https://www.kosharot.co.il/index2.php?id=432646&lang=HEB';

/** Append an encoded pre-filled message to a wa.me (or api.whatsapp.com) URL. */
export function buildWhatsAppHref(baseHref: string, message: string): string {
  const trimmedBase = baseHref.trim();
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    return trimmedBase;
  }
  const sep = trimmedBase.includes('?') ? '&' : '?';
  return `${trimmedBase}${sep}text=${encodeURIComponent(trimmedMessage)}`;
}
