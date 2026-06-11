/** Events catering — Base (mandatory) + Optional Upgrades */

export const EVENTS_BASE_PRICE = 70;

export const EVENTS_BASE_PACKAGE = {
  id: 'base-event-menu',
  title: 'תפריט בסיסי לאירוע',
  pricePerPortion: EVENTS_BASE_PRICE,
  mandatoryLabel: 'חובה — כלול בכל הזמנה',
  includes: ['לחמניות', '8 סוגי סלטים', 'מנה עיקרית — 2 סוגים לבחירה', '3 תוספות']
};

export type EventsReceptionTier = 'regular' | 'upgraded';

export const EVENTS_FIRST_COURSE_UPGRADE = {
  title: 'תוספת מנה ראשונה',
  pricePerPortion: 20,
  priceLabel: '+₪20 למנה',
  includes: ['מנה ראשונה', 'מגוון מנות ראשונות']
};

export const EVENTS_DESSERTS_UPGRADE = {
  title: 'תוספת קינוחים',
  pricePerPortion: 8,
  priceLabel: '+₪8 למנה',
  includes: ['קינוחי ביס איכותיים', 'סוגרים את האירוע עם חיוך']
};

export const EVENTS_RECEPTION_BAR_UPGRADE = {
  title: 'בר קבלת פנים',
  minStationsNote: 'החל מ-4 תחנות',
  tiers: [
    {
      id: 'regular' as const,
      backendId: 'standard' as const,
      title: 'בסיסי',
      pricePerPortion: 30,
      stations: 4,
      features: ['בחירה של 4 סוגים', '2 מנות בשריות', '2 מנות צמחוניות']
    },
    {
      id: 'upgraded' as const,
      backendId: 'premium' as const,
      title: 'משודרג',
      pricePerPortion: 45,
      stations: 6,
      features: ['בחירה של 6 סוגים עשירים ומגוונים', 'אידיאלי לאירועים שרוצים "וואו" כבר בכניסה']
    }
  ]
};

export const EVENTS_KOSHER_UPGRADE_PRICE = 7;

export const EVENTS_SALAD_OPTIONS: string[] = [
  'חומוס', 'טחינה', 'מטבוחה', 'חציל פיקנטי', 'חציל במיונז', 'חציל בטחינה',
  'סחוג', 'חילבה', 'אנטיפסטי', 'סלט גזר מרוקאי', 'סלט סלק מזרחי', 'סלט ביצים',
  'סלט קצוץ ישראלי', 'סלט וולדורף', 'גזר מגורד בלימון', 'כרוב לבן וחמוציות',
  'קולוסלאו', 'כרוב בסגנון אסיאתי', 'שרי פסטו', 'סלט חסה עם שרי', 'טאבולה',
  'חמוצי הבית', 'סלט תירס'
];

export const EVENTS_FIRST_COURSE_UPGRADE_OPTIONS: string[] = [
  'פילה אמנון מזרחי',
  'פילה אמנון בעשבי תיבול',
  'פילה סלמון בחרדל ודבש',
  'פילה סלמון בטריאקי',
  'פילה סלמון בעשבי תיבול',
  'גלילות חצילים במילוי בשר',
  'תחתיות ארטישוק במילוי בשר',
  'כבד קצוץ',
  'בצל ממולא בשר ואורז',
  'פלפל ממולא בשר ואורז',
  'בצל ממולא אורז',
  'פלפל ממולא אורז'
];

export const EVENTS_MAIN_COURSE_OPTIONS: string[] = [
  'כרעיים עוף בסילאן', 'כרעיים עוף בעשבי תיבול', 'אסאדו בסגנון ארגנטינאי',
  'צלי בקר ברוטב', 'פרגית בטריאקי', 'פרגית בעשבי תיבול', 'פרגית מונטריאון',
  'שוקיים בצ\'ילי', 'שניצל', 'שניצלונים', 'שוק טלה', 'צ\'ולנט'
];

export const EVENTS_SIDE_DISH_OPTIONS: string[] = [
  'אורז לבן', 'אורז בקארי וירקות', 'אורז שקדים וצימוקים במייפל',
  'תפו"א פריזיאן בסגנון מזרחי', 'סירות תפו"א ובטטה', 'זיתים ברוטב פיקנטי',
  'קוסקוס עם ירקות בסגנון טריפולטאי', 'ירקות מוקפצים', 'שעועית ירוקה מוקפצת בסגנון סיני'
];

export const EVENTS_SALAD_SLOT_COUNT = 8;
export const EVENTS_MAIN_COURSE_SLOT_COUNT = 2;
export const EVENTS_SIDE_SLOT_COUNT = 3;
export const EVENTS_FIRST_COURSE_SLOT_COUNT = 2;

export function getReceptionTierPrice(tier: EventsReceptionTier | ''): number {
  if (!tier) return 0;
  return EVENTS_RECEPTION_BAR_UPGRADE.tiers.find(t => t.id === tier)?.pricePerPortion ?? 0;
}

export function calculatePricePerPortion(input: {
  isFirstCourseSelected: boolean;
  isDessertsSelected: boolean;
  isReceptionSelected: boolean;
  receptionTier: EventsReceptionTier | '';
  isKosherUpgradeSelected: boolean;
}): number {
  let total = EVENTS_BASE_PRICE;
  if (input.isFirstCourseSelected) total += EVENTS_FIRST_COURSE_UPGRADE.pricePerPortion;
  if (input.isDessertsSelected) total += EVENTS_DESSERTS_UPGRADE.pricePerPortion;
  if (input.isReceptionSelected) total += getReceptionTierPrice(input.receptionTier);
  if (input.isKosherUpgradeSelected) total += EVENTS_KOSHER_UPGRADE_PRICE;
  return total;
}

export function calculateTotalEventPrice(pricePerPortion: number, guestCount: number | null): number {
  const guests = Number(guestCount) || 0;
  return Math.round(pricePerPortion * guests * 100) / 100;
}
