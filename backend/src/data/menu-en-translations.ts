/**
 * Natural American English copy for Megadim menu items.
 * Keys must match Hebrew `name` in MongoDB exactly.
 */
export type EnCopy = { nameEn: string; descriptionEn: string };

export const MENU_EN_BY_HE_NAME: Record<string, EnCopy> = {
  חומוס: {
    nameEn: 'Hummus',
    descriptionEn: 'Classic house hummus — smooth chickpeas, tahini, lemon, and garlic.'
  },
  'סלט חומו': {
    nameEn: 'Hummus',
    descriptionEn: 'Classic house hummus — smooth chickpeas, tahini, lemon, and garlic.'
  },
  טחינה: {
    nameEn: 'Tahini',
    descriptionEn: 'Thick, creamy sesame tahini finished with lemon and garlic.'
  },
  'סלט טחינה': {
    nameEn: 'Tahini',
    descriptionEn: 'Thick, creamy sesame tahini finished with lemon and garlic.'
  },
  'טחינה פיקנטית אדומה': {
    nameEn: 'Spicy Red Tahini',
    descriptionEn: 'Creamy tahini blended with fiery red schug and fresh hot peppers.'
  },
  'טחינה פיקנטית ירוקה': {
    nameEn: 'Spicy Green Tahini',
    descriptionEn: 'Creamy tahini mixed with green schug and fresh herbs for a bright kick.'
  },
  מטבוחה: {
    nameEn: 'Matbucha',
    descriptionEn: 'Slow-cooked tomatoes and sweet peppers — rich, savory, and deeply Middle Eastern.'
  },
  'חציל פיקנטי': {
    nameEn: 'Spicy Eggplant',
    descriptionEn: 'Roasted eggplant tossed with hot spices and fresh herbs.'
  },
  'חציל במיונז': {
    nameEn: 'Eggplant Mayo Salad',
    descriptionEn: 'Roasted eggplant folded into creamy house mayo.'
  },
  'חציל בטחינה': {
    nameEn: 'Eggplant with Tahini',
    descriptionEn: 'Roasted eggplant mixed with tahini, parsley, and lemon.'
  },
  'סחוג ירוק': {
    nameEn: 'Green Schug',
    descriptionEn: 'Fresh herb-and-chili schug — bright, hot, and addictive.'
  },
  'סחוג אדום': {
    nameEn: 'Red Schug',
    descriptionEn: 'Red chili schug with warm spices. Serious heat.'
  },
  'עמבה מנגו': {
    nameEn: 'Mango Amba',
    descriptionEn: 'Tangy pickled mango amba with signature spice.'
  },
  'עמבה לימון': {
    nameEn: 'Lemon Amba',
    descriptionEn: 'Amba brightened with fresh lemon — sharp, sour, and bold.'
  },
  'חצילים בתחמיץ': {
    nameEn: 'Pickled Eggplant',
    descriptionEn: 'Eggplant slow-cooked in a sweet-and-sour house pickle brine.'
  },
  'פלפלים חריפים בשום ולימון': {
    nameEn: 'Hot Peppers with Garlic & Lemon',
    descriptionEn: 'Fresh hot peppers pickled with garlic and lemon.'
  },
  'פלפלים חריפים בתחמיץ': {
    nameEn: 'Pickled Hot Peppers',
    descriptionEn: 'Hot peppers in a sweet-and-sour pickle brine.'
  },
  חילבה: {
    nameEn: 'Hilbeh (Fenugreek)',
    descriptionEn: 'Traditional fenugreek dip — earthy, slightly bitter, and full of character.'
  },
  טאבולה: {
    nameEn: 'Tabbouleh',
    descriptionEn: 'Fresh parsley salad with tomato, mint, and lemon.'
  },
  'הום פרייז בטטה': {
    nameEn: 'Sweet Potato Homefries',
    descriptionEn: 'Crispy home-fried sweet potatoes with creamy hummus.'
  },
  'הום פרייד בטטה': {
    nameEn: 'Sweet Potato Homefries',
    descriptionEn: 'Crispy home-fried sweet potatoes with creamy hummus.'
  },
  קולסלאו: {
    nameEn: 'Coleslaw',
    descriptionEn: 'Crunchy cabbage and carrot slaw in our house dressing.'
  },
  'גזר מרוקאי': {
    nameEn: 'Moroccan Carrots',
    descriptionEn: 'Carrots seasoned the Moroccan way — warm spices, bright finish.'
  },
  'גזר בלימון פיקנטי': {
    nameEn: 'Spicy Lemon Carrots',
    descriptionEn: 'Crisp carrots in a zesty lemon dressing with a little heat.'
  },
  'גזר בלימון': {
    nameEn: 'Lemon Carrots',
    descriptionEn: 'Fresh carrots tossed in bright lemon dressing.'
  },
  'גזר בלימון ואננס': {
    nameEn: 'Lemon & Pineapple Carrots',
    descriptionEn: 'Carrots with lemon and sweet pineapple — tart, sweet, and fresh.'
  },
  'סלט וולדורף': {
    nameEn: 'Waldorf Salad',
    descriptionEn: 'Classic Waldorf — apples, toasted nuts, and celery.'
  },
  'כרוב בסגנון אסיאתי': {
    nameEn: 'Asian-Style Cabbage',
    descriptionEn: 'Shredded cabbage in a savory Asian-inspired dressing.'
  },
  'כרוב סגול בסגנון אסיאתי': {
    nameEn: 'Asian-Style Red Cabbage',
    descriptionEn: 'Red cabbage in a savory Asian-inspired dressing.'
  },
  'כרוב לבן חמוציות': {
    nameEn: 'Cabbage with Cranberries',
    descriptionEn: 'Crisp white cabbage with sweet dried cranberries.'
  },
  'סלט ביצים': {
    nameEn: 'Egg Salad',
    descriptionEn: 'Classic egg salad with creamy house mayo.'
  },
  'סלק מזרחי': {
    nameEn: 'Middle Eastern Beets',
    descriptionEn: 'Beets seasoned with warm Middle Eastern spices.'
  },
  'סלט תירס': {
    nameEn: 'Corn Salad',
    descriptionEn: 'Sweet corn with fresh veggies and house dressing.'
  },
  'חמוצי מגדים (טירשי)': {
    nameEn: 'Megadim Pickles (Turshi)',
    descriptionEn: 'House-pickled vegetables — crunchy, tangy, and made in-house.'
  },
  'חציל בטעם כבד': {
    nameEn: 'Eggplant “Liver” Salad',
    descriptionEn: 'Roasted eggplant seasoned to mimic classic chopped liver — rich and savory.'
  },
  'קישוא בטעם כבד': {
    nameEn: 'Zucchini “Liver” Salad',
    descriptionEn: 'Zucchini cooked and seasoned in the chopped-liver style.'
  },
  'סלט ירקות שורש': {
    nameEn: 'Root Vegetable Salad',
    descriptionEn: 'A mix of seasoned root veggies — earthy and fresh.'
  },
  'כבד קצוץ': {
    nameEn: 'Chopped Liver',
    descriptionEn: 'Traditional chopped liver with fried onions.'
  },
  'הרינג לבן': {
    nameEn: 'White Herring',
    descriptionEn: 'Classic white herring, simply seasoned.'
  },
  'הרינג אדום': {
    nameEn: 'Red Herring',
    descriptionEn: 'Herring tossed with sweet tomatoes and spices.'
  },
  'הרינג בעשבי תיבול': {
    nameEn: 'Herb Herring',
    descriptionEn: 'Herring finished with fresh herbs.'
  },
  'הרינג חריף': {
    nameEn: 'Spicy Herring',
    descriptionEn: 'Herring with a bold, spicy kick.'
  },
  'הרינג בחרדל ומיונז': {
    nameEn: 'Mustard-Mayo Herring',
    descriptionEn: 'Herring in creamy mustard mayo.'
  },
  'הרינג פיקנטי': {
    nameEn: 'Piquant Herring',
    descriptionEn: 'Herring with a sharp, spicy finish.'
  },
  אסאדו: {
    nameEn: 'Asado',
    descriptionEn: 'Slow-braised asado beef, deeply seasoned and fall-apart tender.'
  },
  'צלי בקר': {
    nameEn: 'Braised Beef Roast',
    descriptionEn: 'Beef roast slow-cooked with root vegetables until fork-tender.'
  },
  'כבד ברוטב': {
    nameEn: 'Liver in Gravy',
    descriptionEn: 'Liver simmered in a rich onion gravy.'
  },
  'כרעיים עוף בסילאן': {
    nameEn: 'Chicken Legs in Silan',
    descriptionEn: 'Oven-roasted chicken legs glazed with sweet date silan.'
  },
  'כרעיים עוף בעשבי תיבול': {
    nameEn: 'Herb-Roasted Chicken Legs',
    descriptionEn: 'Chicken legs roasted with fresh herbs.'
  },
  'כרעיים עוף פיקנטי': {
    nameEn: 'Spicy Chicken Legs',
    descriptionEn: 'Oven-roasted chicken legs with a spicy rub.'
  },
  שניצל: {
    nameEn: 'Schnitzel',
    descriptionEn: 'Crispy breaded schnitzel, golden and crunchy.'
  },
  שניצלונים: {
    nameEn: 'Mini Schnitzel Bites',
    descriptionEn: 'Bite-size crispy schnitzel pieces — perfect for sharing.'
  },
  'שווארמה הודו': {
    nameEn: 'Turkey Shawarma',
    descriptionEn: 'Seasoned turkey shawarma, roasted and sliced.'
  },
  'פרגית בעשבי תיבול': {
    nameEn: 'Herb Chicken Thighs',
    descriptionEn: 'Boneless chicken thighs roasted with fresh herbs.'
  },
  'פרגית פיקנטית': {
    nameEn: 'Spicy Chicken Thighs',
    descriptionEn: 'Boneless chicken thighs with a bold spicy seasoning.'
  },
  'פרגית בסגנון מזרחי': {
    nameEn: 'Middle Eastern Chicken Thighs',
    descriptionEn: 'Chicken thighs with classic Middle Eastern spices.'
  },
  'פרגית ברוטב טריאקי': {
    nameEn: 'Teriyaki Chicken Thighs',
    descriptionEn: 'Chicken thighs glazed in sweet teriyaki sauce.'
  },
  'קציצות בשר ברוטב': {
    nameEn: 'Meatballs in Sauce',
    descriptionEn: 'Homestyle meatballs simmered in savory sauce.'
  },
  'צ\'ולנט בשרי': {
    nameEn: 'Meat Cholent',
    descriptionEn: 'Overnight meat cholent with potatoes and beans — Shabbat classic.'
  },
  'צ\'ולנט פרווה': {
    nameEn: 'Pareve Cholent',
    descriptionEn: 'Meatless cholent with potatoes, beans, and vegetables.'
  },
  'אורז לבן': {
    nameEn: 'White Rice',
    descriptionEn: 'Fluffy steamed white rice.'
  },
  'אורז בסמטי': {
    nameEn: 'Basmati Rice',
    descriptionEn: 'Fragrant basmati rice with herbs and spices.'
  },
  'אורז פיצוחים': {
    nameEn: 'Rice with Nuts',
    descriptionEn: 'Rice topped with toasted nuts and seeds.'
  },
  'אורז בקארי וירקות': {
    nameEn: 'Curried Vegetable Rice',
    descriptionEn: 'Rice with curry spices and mixed vegetables.'
  },
  'קוגל תפוחי אדמה': {
    nameEn: 'Potato Kugel',
    descriptionEn: 'Classic potato kugel — crisp outside, soft inside.'
  },
  'קוגל תפו"א': {
    nameEn: 'Potato Kugel',
    descriptionEn: 'Classic potato kugel — crisp outside, soft inside.'
  },
  'קוגל אטריות': {
    nameEn: 'Noodle Kugel',
    descriptionEn: 'Traditional noodle kugel.'
  },
  'קוגל ירושלמי': {
    nameEn: 'Jerusalem Kugel',
    descriptionEn: 'Peppery Jerusalem kugel — sweet, savory, and caramelized.'
  },
  'ירקות גריל': {
    nameEn: 'Grilled Vegetables',
    descriptionEn: 'Assorted vegetables grilled with olive oil.'
  },
  'פתיתים באלפרדו': {
    nameEn: 'Israeli Couscous Alfredo',
    descriptionEn: 'Ptitim (Israeli couscous) in creamy Alfredo with mushrooms.'
  },
  קוסקוס: {
    nameEn: 'Couscous',
    descriptionEn: 'Fluffy couscous with vegetables and spices.'
  },
  'ירקות לקוסקוס': {
    nameEn: 'Couscous Vegetables',
    descriptionEn: 'Stewed vegetables served with couscous.'
  },
  אנטיפסטי: {
    nameEn: 'Antipasti',
    descriptionEn: 'Roasted vegetable antipasti platter.'
  },
  'שעועית ירוקה מוקפצת': {
    nameEn: 'Sautéed Green Beans',
    descriptionEn: 'Crisp green beans quickly sautéed.'
  },
  'ירקות מוקפצים': {
    nameEn: 'Stir-Fried Vegetables',
    descriptionEn: 'Mixed vegetables stir-fried until tender-crisp.'
  },
  'שניצל חציל': {
    nameEn: 'Eggplant Schnitzel',
    descriptionEn: 'Breaded fried eggplant cutlets.'
  },
  'תפו"א פריזיאן': {
    nameEn: 'Parisian Potatoes',
    descriptionEn: 'Bite-size roasted Parisian potatoes.'
  },
  'סירות תפו"א ובטטה': {
    nameEn: 'Potato & Sweet Potato Boats',
    descriptionEn: 'Roasted potato and sweet potato boats.'
  },
  'זיתים ברוטב פיקנטי': {
    nameEn: 'Spicy Marinated Olives',
    descriptionEn: 'Olives in a spicy house marinade.'
  },
  פסטלים: {
    nameEn: 'Pastels',
    descriptionEn: 'Crispy fried pastels — savory pastry pockets.'
  },
  'סיגר בשר': {
    nameEn: 'Meat Cigars',
    descriptionEn: 'Crispy phyllo cigars filled with seasoned meat.'
  },
  'קובה בשר מיני': {
    nameEn: 'Mini Meat Kubbeh',
    descriptionEn: 'Bite-size fried kubbeh stuffed with meat.'
  },
  מלבי: {
    nameEn: 'Malabi',
    descriptionEn: 'Creamy milk pudding with pomegranate syrup and pistachios.'
  },
  טירמיסו: {
    nameEn: 'Tiramisu',
    descriptionEn: 'Classic Italian tiramisu with coffee and mascarpone.'
  },
  'מוס שוקולד': {
    nameEn: 'Chocolate Mousse',
    descriptionEn: 'Rich dark chocolate mousse.'
  },
  'עוגת דבש': {
    nameEn: 'Honey Cake',
    descriptionEn: 'Traditional honey cake with warm spices.'
  },
  'עוגת גזר': {
    nameEn: 'Carrot Cake',
    descriptionEn: 'Moist carrot cake.'
  },
  'סלט פירות': {
    nameEn: 'Fruit Salad',
    descriptionEn: 'Fresh cut fruit with honey and mint.'
  },
  'קינוחי כוסות': {
    nameEn: 'Dessert Cups',
    descriptionEn: 'Individual dessert cups.'
  },
  'קרם ברולה': {
    nameEn: 'Crème Brûlée',
    descriptionEn: 'Classic crème brûlée with a caramelized sugar top.'
  },
  'קראנץ\' שמרים שוקולד': {
    nameEn: 'Chocolate Yeast Crunch',
    descriptionEn: 'Crispy yeast pastry with chocolate.'
  },
  'קראנץ\' שמרים קינמון': {
    nameEn: 'Cinnamon Yeast Crunch',
    descriptionEn: 'Crispy yeast pastry with cinnamon.'
  },
  'קרמבל קוקיז': {
    nameEn: 'Cookie Crumble',
    descriptionEn: 'Sweet cookie crumble dessert.'
  },
  'סופלה שוקולד עם גלידה וניל': {
    nameEn: 'Chocolate Soufflé with Vanilla Ice Cream',
    descriptionEn: 'Warm chocolate soufflé served with vanilla ice cream.'
  },
  'פלטת קינוחים זוגית': {
    nameEn: 'Dessert Platter for Two',
    descriptionEn: 'Assorted desserts made for sharing.'
  },
  'מושט מרוקאי': {
    nameEn: 'Moroccan Tilapia',
    descriptionEn: 'Tilapia simmered in classic Moroccan spices and sauce.'
  },
  'סלמון בעשבי תיבול': {
    nameEn: 'Herb Salmon',
    descriptionEn: 'Salmon fillet roasted with fresh herbs.'
  },
  'סלמון ברוטב טריאקי': {
    nameEn: 'Teriyaki Salmon',
    descriptionEn: 'Salmon glazed in sweet teriyaki sauce.'
  },
  'סלמון ברוטב חרדל ודבש': {
    nameEn: 'Honey-Mustard Salmon',
    descriptionEn: 'Salmon in a sweet-and-tangy honey mustard glaze.'
  },
  סלונה: {
    nameEn: 'Salona (Fish Salad)',
    descriptionEn: 'House salona — seasoned fish salad, ready to serve.'
  },
  'גרבלקס סלק ביתי': {
    nameEn: 'House Beet Gravlax',
    descriptionEn: 'House-cured gravlax with beet — vibrant and silky.'
  },
  'גרבלקס שמיר ביתי': {
    nameEn: 'House Dill Gravlax',
    descriptionEn: 'House-cured gravlax with fresh dill.'
  },
  'חלה שניצל': {
    nameEn: 'Schnitzel Challah Sandwich',
    descriptionEn: 'Schnitzel on challah with your choice of salads and fries.'
  },
  'המבורגר בלחמניה': {
    nameEn: 'Hamburger',
    descriptionEn: 'Classic burger on a bun.'
  },
  'ארוחת המבורגר': {
    nameEn: 'Hamburger Meal',
    descriptionEn: 'Burger meal with fries and a drink.'
  },
  'נשנושי שניצלונים וצ\'יפס': {
    nameEn: 'Schnitzel Bites & Fries',
    descriptionEn: 'Crispy mini schnitzel with fries.'
  },
  'צ\'יפס גדול': {
    nameEn: 'Large Fries',
    descriptionEn: 'A large order of fries.'
  },
  'צ\'יפס קטן': {
    nameEn: 'Small Fries',
    descriptionEn: 'A small order of fries.'
  },
  'מים/סודה': {
    nameEn: 'Water / Soda',
    descriptionEn: 'Bottled water or soda.'
  },
  'קולה, פנטה, ספרייט, זירו, XL': {
    nameEn: 'Coke, Fanta, Sprite, Zero, XL',
    descriptionEn: 'Assorted soft drinks.'
  },
  בירה: {
    nameEn: 'Beer',
    descriptionEn: 'Cold beer.'
  },
  'מוסקה - גלילות חצילים': {
    nameEn: 'Mousakka — Rolled Eggplant',
    descriptionEn: 'Eggplant rolls layered mousakka-style.'
  },
  'תחתיות ארטישוק במילוי בשר': {
    nameEn: 'Meat-Stuffed Artichoke Bottoms',
    descriptionEn: 'Artichoke bottoms filled with seasoned meat.'
  },
  'בצל ממולא אורז': {
    nameEn: 'Rice-Stuffed Onions',
    descriptionEn: 'Onions stuffed with seasoned rice.'
  },
  'בצל ממולא בשר ואורז': {
    nameEn: 'Meat & Rice Stuffed Onions',
    descriptionEn: 'Onions stuffed with meat and rice.'
  },
  'פלפל ממולא אורז': {
    nameEn: 'Rice-Stuffed Peppers',
    descriptionEn: 'Peppers stuffed with seasoned rice.'
  },
  'פלפל ממולא בשר ואורז': {
    nameEn: 'Meat & Rice Stuffed Peppers',
    descriptionEn: 'Peppers stuffed with meat and rice.'
  },
  'עלי סלק ממולאים באורז': {
    nameEn: 'Rice-Stuffed Beet Greens',
    descriptionEn: 'Beet leaves rolled and stuffed with rice.'
  },
  'קובה חמוסטה': {
    nameEn: 'Hamusta Kubbeh',
    descriptionEn: 'Kubbeh in tangy hamusta broth.'
  },
  'קובה סלק': {
    nameEn: 'Beet Kubbeh',
    descriptionEn: 'Kubbeh in vibrant beet broth.'
  },
  'קיש בטטה': {
    nameEn: 'Sweet Potato Quiche',
    descriptionEn: 'Savory sweet potato quiche.'
  },
  'קיש פטריות': {
    nameEn: 'Mushroom Quiche',
    descriptionEn: 'Savory mushroom quiche.'
  },
  'קיש בצל': {
    nameEn: 'Onion Quiche',
    descriptionEn: 'Savory caramelized onion quiche.'
  },
  'קיש תפו"א': {
    nameEn: 'Potato Quiche',
    descriptionEn: 'Savory potato quiche.'
  },
  'תפו"א מוקרם': {
    nameEn: 'Creamed Potatoes',
    descriptionEn: 'Rich, creamy potato bake.'
  },
  'לזניה חצילים ברוטב רוזה': {
    nameEn: 'Eggplant Lasagna in Rosa Sauce',
    descriptionEn: 'Layered eggplant lasagna with creamy rosa sauce.'
  },
  "יאפצ'ק": {
    nameEn: 'Yapchik',
    descriptionEn: 'Overnight potato-and-meat yapchik — crispy edges, soft center.'
  }
};

/** Common size / packaging labels → American English */
export const LABEL_EN_BY_HE: Record<string, string> = {
  '250 מ"ל': '250 ml',
  '500 מ"ל': '500 ml',
  '300 גרם': '300 g',
  '500 גרם': '500 g',
  '1 ק"ג': '1 kg',
  '2 ליטר': '2 L',
  'חצי ליטר': 'Half liter',
  ליטר: 'Liter',
  קטן: 'Small',
  גדול: 'Large',
  יחידה: 'Each'
};
