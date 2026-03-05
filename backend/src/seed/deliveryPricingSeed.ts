import DeliveryPricing from '../models/delivery-pricing.model';

/** Default tiers: distance from Ma'ale Mikhmas (מעלה מכמש) */
const DEFAULT_TIERS = [
  { minDistanceKm: 0, maxDistanceKm: 15, price: 50 },
  { minDistanceKm: 15.01, maxDistanceKm: 30, price: 80 },
  { minDistanceKm: 30.01, maxDistanceKm: 50, price: 120 },
  { minDistanceKm: 50.01, maxDistanceKm: 100, price: 200 }
];

/**
 * Wipes the DeliveryPricing collection and inserts default distance-based tiers.
 * Called automatically when the server connects to MongoDB (for development/testing).
 */
export async function seedDeliveryPrices(): Promise<void> {
  await DeliveryPricing.deleteMany({});
  await DeliveryPricing.insertMany(DEFAULT_TIERS.map(r => ({ ...r, isActive: true })));
  console.log('Delivery prices seeded successfully.');
}

/** Legacy name: run on first deploy when collection is empty (no wipe). */
export async function runDeliveryPricingSeed(): Promise<void> {
  const count = await DeliveryPricing.countDocuments();
  if (count > 0) return;
  await seedDeliveryPrices();
}
