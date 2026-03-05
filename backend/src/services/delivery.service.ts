import axios from 'axios';
import DeliveryPricing from '../models/delivery-pricing.model';
import DeliveryCityOverride from '../models/delivery-city-override.model';

/** נקודת המוצא לחישוב מרחק משלוח – קבוע: מעלה מכמש */
const ORIGIN = 'מעלה מכמש, ישראל';

/** Normalize city for matching (lowercase, trim, collapse spaces) */
function normalizeCityName(city: string): string {
  return (city || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Get driving distance in km from Google Maps Distance Matrix API.
 * Returns distance in km rounded to 1 decimal place.
 */
async function getDistanceKm(destination: string): Promise<number> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY is not set in environment');
  }

  const originStr = encodeURIComponent(ORIGIN);
  const destStr = encodeURIComponent(destination);
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&key=${apiKey}&language=he`;

  console.log('1. Starting Google API request...');
  let data: any;
  try {
    const response = await axios.get(url);
    data = response.data;
    console.log('2. Google API responded with status:', data?.status ?? 'unknown');
  } catch (err: any) {
    console.error('❌ [Delivery Service] Google Maps request failed:');
    if (err?.response) {
      console.error('Data:', err.response.data);
      console.error('Status:', err.response.status);
    } else if (err?.request) {
      console.error('No response received from Google (network/timeout)');
    } else {
      console.error('Error Message:', err?.message);
    }
    console.error('Stack Trace:', err?.stack);
    const message =
      err?.response?.data?.error_message ||
      err?.message ||
      (err?.response?.status ? `HTTP ${err.response.status}` : 'Unknown error');
    throw new Error(message);
  }

  if (data.status !== 'OK') {
    const msg =
      data.error_message ||
      (data.status === 'REQUEST_DENIED'
        ? 'מפתח Google Maps לא תקין או ש-Distance Matrix API לא מופעל בפרויקט'
        : `Google API: ${data.status}`);
    console.error('[Google Maps API Error]:', data.status, data.error_message || '');
    throw new Error(msg);
  }

  if (!data?.rows || !data.rows[0] || !data.rows[0].elements || !data.rows[0].elements[0]) {
    const msg = 'Invalid response structure from Google Maps API.';
    console.error('[Google Maps API Error]:', msg);
    throw new Error(msg);
  }

  const row = data.rows[0];
  const element = row.elements[0];
  if (element.status !== 'OK') {
    const msg = 'Could not calculate route to destination';
    console.error('[Google Maps API Error]:', msg);
    throw new Error(msg);
  }

  const distanceMeters = element.distance?.value;
  if (typeof distanceMeters !== 'number') {
    const msg = 'Invalid distance value from Google API';
    console.error('[Google Maps API Error]:', msg);
    throw new Error(msg);
  }

  const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
  console.log(`[Google Maps] Distance to ${destination} is ${distanceKm} km.`);
  return distanceKm;
}

/**
 * Calculate delivery fee. Priority (controller applies free shipping first):
 * 1) City override (active) -> fixed price
 * 2) Distance ranges table -> price for matching tier (minKM <= distance <= maxKM)
 * 3) No matching tier (distance > highest maxKM or no tiers) -> null (out of area)
 */
export async function calculateDeliveryFee(
  destinationCity: string
): Promise<{ distance: number; price: number; usedOverride?: boolean } | null> {
  const city = (destinationCity || '').trim();
  if (!city) return null;

  const normalized = normalizeCityName(city);

  // Priority 2: City override (bypasses distance)
  const override = await DeliveryCityOverride.findOne({
    cityName: normalized,
    isActive: true
  }).lean();

  if (override) {
    console.log(`[Delivery API] City override for "${city}": ${override.overridePrice}₪`);
    return {
      distance: 0,
      price: override.overridePrice,
      usedOverride: true
    };
  }

  // Priority 3: Distance ranges table
  const destination = `${city}, ישראל`;
  const distanceKm = await getDistanceKm(destination);

  const tier = await DeliveryPricing.findOne({
    minDistanceKm: { $lte: distanceKm },
    maxDistanceKm: { $gte: distanceKm },
    isActive: true
  })
    .sort({ minDistanceKm: 1 })
    .lean();

  if (tier) {
    console.log(`[Delivery API] Range match: ${distanceKm} km -> ${tier.price}₪`);
    return { distance: distanceKm, price: tier.price };
  }

  // Fallback: distance strictly greater than all maxKM or no tiers -> out of area
  const maxTier = await DeliveryPricing.findOne({ isActive: true })
    .sort({ maxDistanceKm: -1 })
    .lean();
  if (maxTier && distanceKm > maxTier.maxDistanceKm) {
    console.log(`[Delivery API] Out of area: ${distanceKm} km > max ${maxTier.maxDistanceKm} km`);
    return null;
  }
  if (!maxTier) {
    console.log('[Delivery API] No active distance tiers defined');
    return null;
  }
  return null;
}

/** Get distance only (for testing tool or display) */
export async function getDistanceForAddress(addressOrCity: string): Promise<number | null> {
  const s = (addressOrCity || '').trim();
  if (!s) return null;
  const destination = s.includes('ישראל') ? s : `${s}, ישראל`;
  try {
    return await getDistanceKm(destination);
  } catch {
    return null;
  }
}

export async function getAllDeliveryPricing(): Promise<
  { minDistanceKm: number; maxDistanceKm: number; price: number; isActive: boolean }[]
> {
  const docs = await DeliveryPricing.find({ isActive: true }).sort({ minDistanceKm: 1 }).lean();
  return docs.map(d => ({
    minDistanceKm: d.minDistanceKm,
    maxDistanceKm: d.maxDistanceKm,
    price: d.price,
    isActive: d.isActive
  }));
}
