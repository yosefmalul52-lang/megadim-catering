import assert from 'assert';
import { computeShabbatCateringTotals } from '../utils/shabbat-catering-pricing.util';

export function runShabbatCateringPricingSpec(): void {
  const single = computeShabbatCateringTotals(
    { mealTime: 'evening', numberOfPortions: 10, seudaShlishit: 'no' },
    { singleMealPrice: 70, bothMealsPrice: 135, seudaShlishitPrice: 25 }
  );
  assert.equal(single.pricePerPortion, 70);
  assert.equal(single.foodSubtotal, 700);

  const bothWithSeuda = computeShabbatCateringTotals(
    { mealTime: 'both', numberOfPortions: 4, seudaShlishit: 'yes' },
    { singleMealPrice: 70, bothMealsPrice: 135, seudaShlishitPrice: 25 }
  );
  assert.equal(bothWithSeuda.pricePerPortion, 160);
  assert.equal(bothWithSeuda.foodSubtotal, 640);

  const withFirstCourse = computeShabbatCateringTotals(
    {
      mealTime: 'evening',
      numberOfPortions: 10,
      seudaShlishit: 'no',
      firstCourseUpgrade: true
    },
    {
      singleMealPrice: 70,
      bothMealsPrice: 135,
      seudaShlishitPrice: 25,
      firstCourseUpgradePrice: 20
    }
  );
  assert.equal(withFirstCourse.pricePerPortion, 90);
  assert.equal(withFirstCourse.foodSubtotal, 900);

  const withoutFirstCourse = computeShabbatCateringTotals(
    {
      mealTime: 'evening',
      numberOfPortions: 10,
      seudaShlishit: 'no',
      firstCourseUpgrade: false
    },
    {
      singleMealPrice: 70,
      bothMealsPrice: 135,
      seudaShlishitPrice: 25,
      firstCourseUpgradePrice: 20
    }
  );
  assert.equal(withoutFirstCourse.pricePerPortion, 70);

  console.log('shabbat-catering-pricing.spec: ok');
}

if (require.main === module) {
  runShabbatCateringPricingSpec();
}
