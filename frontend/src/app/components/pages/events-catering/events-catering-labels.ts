/**
 * Hebrew catalog strings → natural American English for public Events page.
 * Order payloads keep Hebrew values; this map is display-only.
 */
export const EVENTS_HE_TO_EN: Record<string, string> = {
  // Packages / upgrades
  'תפריט בסיסי לאירוע': 'Base event menu',
  'חובה — כלול בכל הזמנה': 'Required — included with every order',
  לחמניות: 'Dinner rolls',
  '8 סוגי סלטים': '8 salad varieties',
  'מנה עיקרית — 2 סוגים לבחירה': 'Main course — choose 2 options',
  '3 תוספות': '3 sides',
  'תוספת מנה ראשונה': 'Add a first course',
  'מנה ראשונה': 'First course',
  'מגוון מנות ראשונות': 'A variety of first-course dishes',
  'תוספת קינוחים': 'Add desserts',
  'קינוחי ביס איכותיים': 'Bite-size gourmet desserts',
  'סוגרים את האירוע עם חיוך': 'A sweet finish that ends the event with a smile',
  'בר קבלת פנים': 'Welcome reception bar',
  'החל מ-4 תחנות': 'From 4 stations',
  בסיסי: 'Classic',
  משודרג: 'Upgraded',
  'בחירה של 4 סוגים': 'Choose 4 varieties',
  '2 מנות בשריות': '2 meat dishes',
  '2 מנות צמחוניות': '2 vegetarian dishes',
  'בחירה של 6 סוגים עשירים ומגוונים': 'Choose 6 rich, varied stations',
  'אידיאלי לאירועים שרוצים "וואו" כבר בכניסה':
    'Ideal when you want a wow moment right at the entrance',

  // Salads
  חומוס: 'Hummus',
  טחינה: 'Tahini',
  מטבוחה: 'Matbucha',
  'חציל פיקנטי': 'Spicy eggplant',
  'חציל במיונז': 'Eggplant mayo salad',
  'חציל בטחינה': 'Eggplant with tahini',
  סחוג: 'Schug',
  חילבה: 'Hilbeh (fenugreek)',
  אנטיפסטי: 'Antipasti',
  'סלט גזר מרוקאי': 'Moroccan carrot salad',
  'סלט סלק מזרחי': 'Middle Eastern beet salad',
  'סלט ביצים': 'Egg salad',
  'סלט קצוץ ישראלי': 'Israeli chopped salad',
  'סלט וולדורף': 'Waldorf salad',
  'גזר מגורד בלימון': 'Lemon grated carrots',
  'כרוב לבן וחמוציות': 'Cabbage with cranberries',
  קולוסלאו: 'Coleslaw',
  קולסלאו: 'Coleslaw',
  'כרוב בסגנון אסיאתי': 'Asian-style cabbage',
  'שרי פסטו': 'Cherry tomatoes with pesto',
  'סלט חסה עם שרי': 'Lettuce salad with cherry tomatoes',
  טאבולה: 'Tabbouleh',
  'חמוצי הבית': 'House pickles',
  'סלט תירס': 'Corn salad',

  // First courses
  'פילה אמנון מזרחי': 'Middle Eastern tilapia fillet',
  'פילה אמנון בעשבי תיבול': 'Herb tilapia fillet',
  'פילה סלמון בחרדל ודבש': 'Honey-mustard salmon fillet',
  'פילה סלמון בטריאקי': 'Teriyaki salmon fillet',
  'פילה סלמון בעשבי תיבול': 'Herb salmon fillet',
  'גלילות חצילים במילוי בשר': 'Meat-stuffed eggplant rolls',
  'תחתיות ארטישוק במילוי בשר': 'Meat-stuffed artichoke bottoms',
  'כבד קצוץ': 'Chopped liver',
  'בצל ממולא בשר ואורז': 'Meat & rice stuffed onions',
  'פלפל ממולא בשר ואורז': 'Meat & rice stuffed peppers',
  'בצל ממולא אורז': 'Rice-stuffed onions',
  'פלפל ממולא אורז': 'Rice-stuffed peppers',

  // Mains
  'כרעיים עוף בסילאן': 'Chicken legs in silan',
  'כרעיים עוף בעשבי תיבול': 'Herb-roasted chicken legs',
  'אסאדו בסגנון ארגנטינאי': 'Argentine-style asado',
  'צלי בקר ברוטב': 'Braised beef roast in gravy',
  'פרגית בטריאקי': 'Teriyaki chicken thighs',
  'פרגית בעשבי תיבול': 'Herb chicken thighs',
  'פרגית מונטריאון': 'Monterey chicken thighs',
  "שוקיים בצ'ילי": 'Chili chicken drumsticks',
  שניצל: 'Schnitzel',
  שניצלונים: 'Mini schnitzel bites',
  'שוק טלה': 'Lamb shank',
  "צ'ולנט": 'Cholent',

  // Sides
  'אורז לבן': 'White rice',
  'אורז בקארי וירקות': 'Curried vegetable rice',
  'אורז שקדים וצימוקים במייפל': 'Rice with almonds, raisins & maple',
  'תפו"א פריזיאן בסגנון מזרחי': 'Middle Eastern Parisian potatoes',
  'סירות תפו"א ובטטה': 'Potato & sweet potato boats',
  'זיתים ברוטב פיקנטי': 'Spicy marinated olives',
  'קוסקוס עם ירקות בסגנון טריפולטאי': 'Tripolitan-style couscous with vegetables',
  'ירקות מוקפצים': 'Stir-fried vegetables',
  'שעועית ירוקה מוקפצת בסגנון סיני': 'Chinese-style sautéed green beans',

  // Validation / misc
  'נא לבחור רמת בר קבלת פנים': 'Please choose a reception bar level'
};

export function eventsDisplayLabel(he: string, locale: 'he' | 'en'): string {
  const raw = String(he || '').trim();
  if (!raw || locale !== 'en') return raw;
  return EVENTS_HE_TO_EN[raw] || raw;
}
