import assert from 'assert';
import test from 'node:test';
import {
  validateShabbatCateringSelection,
  wantsShabbatFirstCourseUpgrade
} from '../utils/catering-validation';

const salads = [
  'חומוס',
  'טחינה',
  'מטבוחה',
  'חציל פיקנטי',
  'סלט גזר מרוקאי',
  'סלט סלק מזרחי'
];

function baseEveningBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    salads,
    mainCoursesEvening: ['שניצל', 'כרעיים עוף בסילאן'],
    sidesEvening: ['אורז לבן', 'ירקות מוקפצים', 'קוסקוס עם ירקות בסגנון טריפולטאי'],
    ...overrides
  };
}

test('wantsShabbatFirstCourseUpgrade: flag or selections', () => {
  assert.equal(wantsShabbatFirstCourseUpgrade({}), false);
  assert.equal(wantsShabbatFirstCourseUpgrade({ firstCourseUpgrade: true }), true);
  assert.equal(
    wantsShabbatFirstCourseUpgrade({ firstCoursesEvening: ['כבד קצוץ', 'פילה סלמון בחרדל ודבש'] }),
    true
  );
});

test('validateShabbatCateringSelection: allows empty first courses when upgrade off', () => {
  assert.doesNotThrow(() =>
    validateShabbatCateringSelection(baseEveningBody({ firstCourseUpgrade: false }), 'evening')
  );
});

test('validateShabbatCateringSelection: requires exact first courses when upgrade on', () => {
  assert.throws(
    () =>
      validateShabbatCateringSelection(
        baseEveningBody({ firstCourseUpgrade: true, firstCoursesEvening: ['כבד קצוץ'] }),
        'evening'
      ),
    /מנות ראשונות לערב/
  );

  assert.doesNotThrow(() =>
    validateShabbatCateringSelection(
      baseEveningBody({
        firstCourseUpgrade: true,
        firstCoursesEvening: ['כבד קצוץ', 'פילה סלמון בחרדל ודבש']
      }),
      'evening'
    )
  );
});

test('validateShabbatCateringSelection: both meals skip first courses when upgrade off', () => {
  assert.doesNotThrow(() =>
    validateShabbatCateringSelection(
      {
        salads,
        firstCourseUpgrade: false,
        mainCoursesEvening: ['שניצל', 'כרעיים עוף בסילאן'],
        mainCoursesMorning: ['פרגית בטריאקי', 'צלי בקר ברוטב'],
        sidesEvening: ['אורז לבן', 'ירקות מוקפצים', 'קוסקוס עם ירקות בסגנון טריפולטאי'],
        sidesMorning: ['אורז בקארי וירקות', 'סירות תפו"א ובטטה', 'שעועית ירוקה מוקפצת בסגנון סיני']
      },
      'both'
    )
  );
});

test('validateShabbatCateringSelection: both meals allow first courses on only one meal', () => {
  assert.doesNotThrow(() =>
    validateShabbatCateringSelection(
      {
        salads,
        firstCourseUpgrade: true,
        firstCoursesEvening: ['כבד קצוץ', 'פילה סלמון בחרדל ודבש'],
        firstCoursesMorning: [],
        mainCoursesEvening: ['שניצל', 'כרעיים עוף בסילאן'],
        mainCoursesMorning: ['פרגית בטריאקי', 'צלי בקר ברוטב'],
        sidesEvening: ['אורז לבן', 'ירקות מוקפצים', 'קוסקוס עם ירקות בסגנון טריפולטאי'],
        sidesMorning: ['אורז בקארי וירקות', 'סירות תפו"א ובטטה', 'שעועית ירוקה מוקפצת בסגנון סיני']
      },
      'both'
    )
  );

  assert.throws(
    () =>
      validateShabbatCateringSelection(
        {
          salads,
          firstCourseUpgrade: true,
          firstCoursesEvening: [],
          firstCoursesMorning: [],
          mainCoursesEvening: ['שניצל', 'כרעיים עוף בסילאן'],
          mainCoursesMorning: ['פרגית בטריאקי', 'צלי בקר ברוטב'],
          sidesEvening: ['אורז לבן', 'ירקות מוקפצים', 'קוסקוס עם ירקות בסגנון טריפולטאי'],
          sidesMorning: ['אורז בקארי וירקות', 'סירות תפו"א ובטטה', 'שעועית ירוקה מוקפצת בסגנון סיני']
        },
        'both'
      ),
    /לפחות בארוחה אחת/
  );
});
