import axios from 'axios';
import DeliveryPricing from '../models/delivery-pricing.model';
import DeliveryCityOverride from '../models/delivery-city-override.model';

/** Origin point for delivery distance – Ma'ale Mikhmas (fixed coordinates) */
const ORIGIN_LAT = 31.884;
const ORIGIN_LON = 35.312;

/** Approximate factor from straight-line to real driving distance */
const ROUTING_FACTOR = 1.35;

/** Normalize city for matching (lowercase, trim, collapse spaces) */
function normalizeCityName(city: string): string {
  return (city || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

interface LatLng {
  lat: number;
  lon: number;
}

/**
 * Fetch latitude/longitude for a given city using OpenStreetMap Nominatim.
 * NOTE: Nominatim requires a valid User-Agent header.
 */
async function geocodeCityWithOsm(city: string): Promise<LatLng> {
  const q = encodeURIComponent(city);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}`;

  console.log('[Delivery Service] OSM geocoding for city:', city);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'MegadimCateringApp/1.0 (Contact: yosef@megadim-catering.com)',
        'Accept-Language': 'he'
      }
    });
    const data: any[] = Array.isArray(response.data) ? response.data : [];

    if (data.length === 0) {
      throw new Error('No results from Nominatim for city');
    }

    const first = data[0];
    const latNum = Number(first.lat);
    const lonNum = Number(first.lon);

    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
      throw new Error('Invalid lat/lon from Nominatim');
    }

    return { lat: latNum, lon: lonNum };
  } catch (err: any) {
    console.error('❌ [Delivery Service] OSM Nominatim request failed:');
    if (err?.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    } else if (err?.request) {
      console.error('No response received from OSM (network/timeout)');
    } else {
      console.error('Error Message:', err?.message);
    }
    throw err;
  }
}

/**
 * Haversine formula – straight-line distance between two coordinates (km).
 */
function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lon - a.lon);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDlat = Math.sin(dLat / 2);
  const sinDlng = Math.sin(dLng / 2);

  const h =
    sinDlat * sinDlat +
    Math.cos(lat1) * Math.cos(lat2) * sinDlng * sinDlng;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
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

  // Priority 1: City override (bypasses distance and external APIs)
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

  // Priority 2: Distance ranges table using OSM + Haversine + routing factor
  const destinationAddress = city.includes('ישראל') ? city : `${city}, ישראל`;

  const originCoords: LatLng = { lat: ORIGIN_LAT, lon: ORIGIN_LON };
  const destCoords = await geocodeCityWithOsm(destinationAddress);

  const straightKm = haversineKm(originCoords, destCoords);
  const distanceKm = Math.round(straightKm * ROUTING_FACTOR * 10) / 10;

  console.log(
    `[Delivery API] Haversine distance from origin to "${destinationAddress}" = ${straightKm.toFixed(
      2
    )} km, adjusted driving distance ≈ ${distanceKm} km.`
  );

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
  const destinationAddress = s.includes('ישראל') ? s : `${s}, ישראל`;
  try {
    const originCoords: LatLng = { lat: ORIGIN_LAT, lon: ORIGIN_LON };
    const destCoords = await geocodeCityWithOsm(destinationAddress);
    const straightKm = haversineKm(originCoords, destCoords);
    const distanceKm = Math.round(straightKm * ROUTING_FACTOR * 10) / 10;
    return distanceKm;
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
