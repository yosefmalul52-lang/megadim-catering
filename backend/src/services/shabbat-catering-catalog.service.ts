import ShabbatCateringCatalog, {
  IShabbatCateringCatalog
} from '../models/shabbat-catering-catalog.model';

/** Defaults mirror holiday-food hardcoded package / option lists. */
export const DEFAULT_SHABBAT_CATALOG = {
  key: 'default',
  singleMealPrice: 70,
  bothMealsPrice: 135,
  firstCourseUpgradePrice: 20,
  seudaShlishitPrice: 25,
  fishUpgradePrice: 18,
  dessertsPrice: 8,
  kosherUpgradePrice: 7,
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
  saladMinCount: 6,
  saladMaxCount: 8,
  firstCourseSlotCount: 2,
  mainCourseSlotCount: 2,
  sideSlotCount: 3
};

function cleanStringList(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return [...fallback];
  const list = raw.map((s) => String(s || '').trim()).filter(Boolean);
  return list.length ? list : [...fallback];
}

export async function getOrCreateShabbatCatalog(): Promise<IShabbatCateringCatalog> {
  let doc = await ShabbatCateringCatalog.findOne({ key: 'default' });
  if (!doc) {
    doc = await ShabbatCateringCatalog.create(DEFAULT_SHABBAT_CATALOG);
  }
  return doc;
}

export function shabbatCatalogToPublicDto(doc: IShabbatCateringCatalog | Record<string, any>) {
  const d = doc as any;
  return {
    singleMealPrice: Number(d.singleMealPrice) || DEFAULT_SHABBAT_CATALOG.singleMealPrice,
    bothMealsPrice: Number(d.bothMealsPrice) || DEFAULT_SHABBAT_CATALOG.bothMealsPrice,
    firstCourseUpgradePrice:
      Number(d.firstCourseUpgradePrice) || DEFAULT_SHABBAT_CATALOG.firstCourseUpgradePrice,
    seudaShlishitPrice: Number(d.seudaShlishitPrice) || DEFAULT_SHABBAT_CATALOG.seudaShlishitPrice,
    fishUpgradePrice: Number(d.fishUpgradePrice) || DEFAULT_SHABBAT_CATALOG.fishUpgradePrice,
    dessertsPrice: Number(d.dessertsPrice) || DEFAULT_SHABBAT_CATALOG.dessertsPrice,
    kosherUpgradePrice: Number(d.kosherUpgradePrice) || DEFAULT_SHABBAT_CATALOG.kosherUpgradePrice,
    saladOptions: cleanStringList(d.saladOptions, DEFAULT_SHABBAT_CATALOG.saladOptions),
    firstCourseOptions: cleanStringList(
      d.firstCourseOptions,
      DEFAULT_SHABBAT_CATALOG.firstCourseOptions
    ),
    mainCourseOptions: cleanStringList(
      d.mainCourseOptions,
      DEFAULT_SHABBAT_CATALOG.mainCourseOptions
    ),
    sideDishOptions: cleanStringList(d.sideDishOptions, DEFAULT_SHABBAT_CATALOG.sideDishOptions),
    saladSlotCount: Number(d.saladSlotCount) || DEFAULT_SHABBAT_CATALOG.saladSlotCount,
    saladMinCount: Number(d.saladMinCount) || DEFAULT_SHABBAT_CATALOG.saladMinCount,
    saladMaxCount: Number(d.saladMaxCount) || DEFAULT_SHABBAT_CATALOG.saladMaxCount,
    firstCourseSlotCount:
      Number(d.firstCourseSlotCount) || DEFAULT_SHABBAT_CATALOG.firstCourseSlotCount,
    mainCourseSlotCount:
      Number(d.mainCourseSlotCount) || DEFAULT_SHABBAT_CATALOG.mainCourseSlotCount,
    sideSlotCount: Number(d.sideSlotCount) || DEFAULT_SHABBAT_CATALOG.sideSlotCount,
    updatedAt: d.updatedAt || null
  };
}

export async function updateShabbatCatalog(body: Record<string, unknown>) {
  const doc = await getOrCreateShabbatCatalog();
  const num = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const intMin1 = (v: unknown, fallback: number) =>
    Math.max(1, Math.trunc(num(v, fallback)));

  if (body.singleMealPrice !== undefined) {
    doc.singleMealPrice = num(body.singleMealPrice, doc.singleMealPrice);
  }
  if (body.bothMealsPrice !== undefined) {
    doc.bothMealsPrice = num(body.bothMealsPrice, doc.bothMealsPrice);
  }
  if (body.firstCourseUpgradePrice !== undefined) {
    doc.firstCourseUpgradePrice = num(body.firstCourseUpgradePrice, doc.firstCourseUpgradePrice);
  }
  if (body.seudaShlishitPrice !== undefined) {
    doc.seudaShlishitPrice = num(body.seudaShlishitPrice, doc.seudaShlishitPrice);
  }
  if (body.fishUpgradePrice !== undefined) {
    doc.fishUpgradePrice = num(body.fishUpgradePrice, doc.fishUpgradePrice);
  }
  if (body.dessertsPrice !== undefined) {
    doc.dessertsPrice = num(body.dessertsPrice, doc.dessertsPrice);
  }
  if (body.kosherUpgradePrice !== undefined) {
    doc.kosherUpgradePrice = num(body.kosherUpgradePrice, doc.kosherUpgradePrice);
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
    doc.saladSlotCount = intMin1(body.saladSlotCount, doc.saladSlotCount);
  }
  if (body.saladMinCount !== undefined) {
    doc.saladMinCount = intMin1(body.saladMinCount, doc.saladMinCount);
  }
  if (body.saladMaxCount !== undefined) {
    doc.saladMaxCount = intMin1(body.saladMaxCount, doc.saladMaxCount);
  }
  if (body.firstCourseSlotCount !== undefined) {
    doc.firstCourseSlotCount = intMin1(body.firstCourseSlotCount, doc.firstCourseSlotCount);
  }
  if (body.mainCourseSlotCount !== undefined) {
    doc.mainCourseSlotCount = intMin1(body.mainCourseSlotCount, doc.mainCourseSlotCount);
  }
  if (body.sideSlotCount !== undefined) {
    doc.sideSlotCount = intMin1(body.sideSlotCount, doc.sideSlotCount);
  }

  if (doc.saladMinCount > doc.saladMaxCount) {
    const tmp = doc.saladMinCount;
    doc.saladMinCount = doc.saladMaxCount;
    doc.saladMaxCount = tmp;
  }
  if (doc.saladSlotCount < doc.saladMaxCount) {
    doc.saladSlotCount = doc.saladMaxCount;
  }

  await doc.save();
  return doc;
}
