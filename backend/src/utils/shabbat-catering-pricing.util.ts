import {
  DEFAULT_SHABBAT_CATALOG,
  shabbatCatalogToPublicDto
} from '../services/shabbat-catering-catalog.service';

export type ShabbatMealTime = 'evening' | 'morning' | 'both';

export interface ShabbatPricingCatalog {
  singleMealPrice?: number;
  bothMealsPrice?: number;
  firstCourseUpgradePrice?: number;
  seudaShlishitPrice?: number;
  fishUpgradePrice?: number;
  dessertsPrice?: number;
  kosherUpgradePrice?: number;
}

export interface ShabbatPricingInput {
  mealTime: ShabbatMealTime;
  numberOfPortions: number;
  seudaShlishit?: 'yes' | 'no' | boolean | string;
  /** Paid first-course upgrade (optional; form may not send yet). */
  firstCourseUpgrade?: boolean;
  fishUpgrade?: boolean;
  desserts?: boolean;
  kosherUpgrade?: boolean;
}

function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function asYes(v: unknown): boolean {
  return v === true || v === 'yes' || v === 'true';
}

/** Resolve catalog rates with safe defaults. */
export function resolveShabbatCatalogRates(
  catalog?: ShabbatPricingCatalog | null
): Required<ShabbatPricingCatalog> {
  const dto = catalog
    ? shabbatCatalogToPublicDto(catalog as any)
    : DEFAULT_SHABBAT_CATALOG;
  return {
    singleMealPrice: Number(dto.singleMealPrice) || DEFAULT_SHABBAT_CATALOG.singleMealPrice,
    bothMealsPrice: Number(dto.bothMealsPrice) || DEFAULT_SHABBAT_CATALOG.bothMealsPrice,
    firstCourseUpgradePrice:
      Number(dto.firstCourseUpgradePrice) || DEFAULT_SHABBAT_CATALOG.firstCourseUpgradePrice,
    seudaShlishitPrice:
      Number(dto.seudaShlishitPrice) || DEFAULT_SHABBAT_CATALOG.seudaShlishitPrice,
    fishUpgradePrice: Number(dto.fishUpgradePrice) || DEFAULT_SHABBAT_CATALOG.fishUpgradePrice,
    dessertsPrice: Number(dto.dessertsPrice) || DEFAULT_SHABBAT_CATALOG.dessertsPrice,
    kosherUpgradePrice:
      Number(dto.kosherUpgradePrice) || DEFAULT_SHABBAT_CATALOG.kosherUpgradePrice
  };
}

/**
 * Compute Shabbat catering food total from catalog (events-parity).
 * Delivery is NOT included — set manually by admin on the order.
 */
export function computeShabbatCateringTotals(
  input: ShabbatPricingInput,
  catalog?: ShabbatPricingCatalog | null
): {
  pricePerPortion: number;
  foodSubtotal: number;
  numberOfPortions: number;
  breakdown: {
    basePerPortion: number;
    seudaPerPortion: number;
    firstCoursePerPortion: number;
    fishPerPortion: number;
    dessertsPerPortion: number;
    kosherPerPortion: number;
  };
} {
  const rates = resolveShabbatCatalogRates(catalog);
  const portions = Math.max(0, Math.trunc(Number(input.numberOfPortions) || 0));
  const basePerPortion =
    input.mealTime === 'both' ? rates.bothMealsPrice : rates.singleMealPrice;

  const seudaPerPortion = asYes(input.seudaShlishit) ? rates.seudaShlishitPrice : 0;
  const firstCoursePerPortion = input.firstCourseUpgrade ? rates.firstCourseUpgradePrice : 0;
  const fishPerPortion = input.fishUpgrade ? rates.fishUpgradePrice : 0;
  const dessertsPerPortion = input.desserts ? rates.dessertsPrice : 0;
  const kosherPerPortion = input.kosherUpgrade ? rates.kosherUpgradePrice : 0;

  const pricePerPortion = roundMoney(
    basePerPortion +
      seudaPerPortion +
      firstCoursePerPortion +
      fishPerPortion +
      dessertsPerPortion +
      kosherPerPortion
  );
  const foodSubtotal = roundMoney(pricePerPortion * portions);

  return {
    pricePerPortion,
    foodSubtotal,
    numberOfPortions: portions,
    breakdown: {
      basePerPortion,
      seudaPerPortion,
      firstCoursePerPortion,
      fishPerPortion,
      dessertsPerPortion,
      kosherPerPortion
    }
  };
}
