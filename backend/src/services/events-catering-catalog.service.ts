import EventsCateringCatalog, {
  IEventsCateringCatalog
} from '../models/events-catering-catalog.model';

/** Defaults mirror frontend events-catering.model.ts hardcoded package. */
export const DEFAULT_EVENTS_CATALOG = {
  key: 'default',
  basePrice: 70,
  baseTitle: 'תפריט בסיסי לאירוע',
  baseIncludes: ['לחמניות', '8 סוגי סלטים', 'מנה עיקרית — 2 סוגים לבחירה', '3 תוספות'],
  firstCourseUpgradePrice: 20,
  firstCourseUpgradeTitle: 'תוספת מנה ראשונה',
  dessertsUpgradePrice: 8,
  dessertsUpgradeTitle: 'תוספת קינוחים',
  kosherUpgradePrice: 7,
  receptionTiers: [
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
  ],
  saladOptions: [
    'חומוס', 'טחינה', 'מטבוחה', 'חציל פיקנטי', 'חציל במיונז', 'חציל בטחינה',
    'סחוג', 'חילבה', 'אנטיפסטי', 'סלט גזר מרוקאי', 'סלט סלק מזרחי', 'סלט ביצים',
    'סלט קצוץ ישראלי', 'סלט וולדורף', 'גזר מגורד בלימון', 'כרוב לבן וחמוציות',
    'קולוסלאו', 'כרוב בסגנון אסיאתי', 'שרי פסטו', 'סלט חסה עם שרי', 'טאבולה',
    'חמוצי הבית', 'סלט תירס'
  ],
  firstCourseOptions: [
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
  ],
  mainCourseOptions: [
    'כרעיים עוף בסילאן', 'כרעיים עוף בעשבי תיבול', 'אסאדו בסגנון ארגנטינאי',
    'צלי בקר ברוטב', 'פרגית בטריאקי', 'פרגית בעשבי תיבול', 'פרגית מונטריאון',
    'שוקיים בצ\'ילי', 'שניצל', 'שניצלונים', 'שוק טלה', 'צ\'ולנט'
  ],
  sideDishOptions: [
    'אורז לבן', 'אורז בקארי וירקות', 'אורז שקדים וצימוקים במייפל',
    'תפו"א פריזיאן בסגנון מזרחי', 'סירות תפו"א ובטטה', 'זיתים ברוטב פיקנטי',
    'קוסקוס עם ירקות בסגנון טריפולטאי', 'ירקות מוקפצים', 'שעועית ירוקה מוקפצת בסגנון סיני'
  ],
  saladSlotCount: 8,
  mainCourseSlotCount: 2,
  sideSlotCount: 3,
  firstCourseSlotCount: 2
};

function cleanStringList(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return [...fallback];
  const list = raw.map((s) => String(s || '').trim()).filter(Boolean);
  return list.length ? list : [...fallback];
}

export async function getOrCreateEventsCatalog(): Promise<IEventsCateringCatalog> {
  let doc = await EventsCateringCatalog.findOne({ key: 'default' });
  if (!doc) {
    doc = await EventsCateringCatalog.create(DEFAULT_EVENTS_CATALOG);
  }
  return doc;
}

export function catalogToPublicDto(doc: IEventsCateringCatalog | Record<string, any>) {
  const d = doc as any;
  return {
    basePrice: Number(d.basePrice) || DEFAULT_EVENTS_CATALOG.basePrice,
    baseTitle: String(d.baseTitle || DEFAULT_EVENTS_CATALOG.baseTitle),
    baseIncludes: cleanStringList(d.baseIncludes, DEFAULT_EVENTS_CATALOG.baseIncludes),
    firstCourseUpgradePrice:
      Number(d.firstCourseUpgradePrice) || DEFAULT_EVENTS_CATALOG.firstCourseUpgradePrice,
    firstCourseUpgradeTitle: String(
      d.firstCourseUpgradeTitle || DEFAULT_EVENTS_CATALOG.firstCourseUpgradeTitle
    ),
    dessertsUpgradePrice:
      Number(d.dessertsUpgradePrice) || DEFAULT_EVENTS_CATALOG.dessertsUpgradePrice,
    dessertsUpgradeTitle: String(
      d.dessertsUpgradeTitle || DEFAULT_EVENTS_CATALOG.dessertsUpgradeTitle
    ),
    kosherUpgradePrice: Number(d.kosherUpgradePrice) || DEFAULT_EVENTS_CATALOG.kosherUpgradePrice,
    receptionTiers:
      Array.isArray(d.receptionTiers) && d.receptionTiers.length
        ? d.receptionTiers
        : DEFAULT_EVENTS_CATALOG.receptionTiers,
    saladOptions: cleanStringList(d.saladOptions, DEFAULT_EVENTS_CATALOG.saladOptions),
    firstCourseOptions: cleanStringList(
      d.firstCourseOptions,
      DEFAULT_EVENTS_CATALOG.firstCourseOptions
    ),
    mainCourseOptions: cleanStringList(
      d.mainCourseOptions,
      DEFAULT_EVENTS_CATALOG.mainCourseOptions
    ),
    sideDishOptions: cleanStringList(d.sideDishOptions, DEFAULT_EVENTS_CATALOG.sideDishOptions),
    saladSlotCount: Number(d.saladSlotCount) || DEFAULT_EVENTS_CATALOG.saladSlotCount,
    mainCourseSlotCount: Number(d.mainCourseSlotCount) || DEFAULT_EVENTS_CATALOG.mainCourseSlotCount,
    sideSlotCount: Number(d.sideSlotCount) || DEFAULT_EVENTS_CATALOG.sideSlotCount,
    firstCourseSlotCount:
      Number(d.firstCourseSlotCount) || DEFAULT_EVENTS_CATALOG.firstCourseSlotCount,
    updatedAt: d.updatedAt || null
  };
}

export async function updateEventsCatalog(body: Record<string, unknown>) {
  const doc = await getOrCreateEventsCatalog();
  const num = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  if (body.basePrice !== undefined) doc.basePrice = num(body.basePrice, doc.basePrice);
  if (body.baseTitle !== undefined) doc.baseTitle = String(body.baseTitle || '').trim() || doc.baseTitle;
  if (body.baseIncludes !== undefined) {
    doc.baseIncludes = cleanStringList(body.baseIncludes, doc.baseIncludes);
  }
  if (body.firstCourseUpgradePrice !== undefined) {
    doc.firstCourseUpgradePrice = num(body.firstCourseUpgradePrice, doc.firstCourseUpgradePrice);
  }
  if (body.firstCourseUpgradeTitle !== undefined) {
    doc.firstCourseUpgradeTitle =
      String(body.firstCourseUpgradeTitle || '').trim() || doc.firstCourseUpgradeTitle;
  }
  if (body.dessertsUpgradePrice !== undefined) {
    doc.dessertsUpgradePrice = num(body.dessertsUpgradePrice, doc.dessertsUpgradePrice);
  }
  if (body.dessertsUpgradeTitle !== undefined) {
    doc.dessertsUpgradeTitle =
      String(body.dessertsUpgradeTitle || '').trim() || doc.dessertsUpgradeTitle;
  }
  if (body.kosherUpgradePrice !== undefined) {
    doc.kosherUpgradePrice = num(body.kosherUpgradePrice, doc.kosherUpgradePrice);
  }
  if (Array.isArray(body.receptionTiers) && body.receptionTiers.length) {
    doc.receptionTiers = body.receptionTiers as any;
  }
  if (body.saladOptions !== undefined) {
    doc.saladOptions = cleanStringList(body.saladOptions, doc.saladOptions);
  }
  if (body.firstCourseOptions !== undefined) {
    doc.firstCourseOptions = cleanStringList(body.firstCourseOptions, doc.firstCourseOptions);
  }
  if (body.mainCourseOptions !== undefined) {
    doc.mainCourseOptions = cleanStringList(body.mainCourseOptions, doc.mainCourseOptions);
  }
  if (body.sideDishOptions !== undefined) {
    doc.sideDishOptions = cleanStringList(body.sideDishOptions, doc.sideDishOptions);
  }
  if (body.saladSlotCount !== undefined) {
    doc.saladSlotCount = Math.max(1, Math.trunc(num(body.saladSlotCount, doc.saladSlotCount)));
  }
  if (body.mainCourseSlotCount !== undefined) {
    doc.mainCourseSlotCount = Math.max(
      1,
      Math.trunc(num(body.mainCourseSlotCount, doc.mainCourseSlotCount))
    );
  }
  if (body.sideSlotCount !== undefined) {
    doc.sideSlotCount = Math.max(1, Math.trunc(num(body.sideSlotCount, doc.sideSlotCount)));
  }
  if (body.firstCourseSlotCount !== undefined) {
    doc.firstCourseSlotCount = Math.max(
      1,
      Math.trunc(num(body.firstCourseSlotCount, doc.firstCourseSlotCount))
    );
  }

  await doc.save();
  return doc;
}
