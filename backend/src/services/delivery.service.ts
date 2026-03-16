import axios from 'axios';
import DeliveryPricing from '../models/delivery-pricing.model';
import DeliveryCityOverride from '../models/delivery-city-override.model';

/** Origin point for delivery distance – Ma'ale Mikhmas (fixed coordinates) */
const ORIGIN_LAT = 31.8864;
const ORIGIN_LON = 35.2952;

/** Approximate factor from straight-line to real driving distance */
const ROUTING_FACTOR = 1.35;

/** Straight-line distance (km) above which Google result is treated as suspicious (e.g. wrong city) */
const SUSPICIOUS_DISTANCE_KM = 65;

/** Home city and common variations – bypass Google Geocoding to avoid wrong coordinates */
const HOME_CITY_ALIASES = [
  'מעלה מכמש',
  'מכמש',
  "maale mikhmas",
  "ma'ale mikhmas"
];

/** Normalize city for matching (lowercase, trim, collapse spaces) */
function normalizeCityName(city: string): string {
  return (city || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

interface LatLng {
  lat: number;
  lon: number;
}

/**
 * Fetch latitude/longitude for a given city using Google Geocoding API.
 */
async function geocodeCityWithGoogle(city: string): Promise<LatLng> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY is not set in environment');
  }

  const address = city.includes('ישראל') ? city : `${city}, ישראל`;
  const encoded = encodeURIComponent(address);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${apiKey}`;

  console.log('[Delivery Service] Google Geocoding for city:', address);

  try {
    const response = await axios.get(url);
    const data = response.data;

    if (!data || data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
      const status = data?.status || 'NO_STATUS';
      const msg = data?.error_message || '';
      console.error('[Google Geocoding Error]:', status, msg);
      throw new Error(`Google Geocoding failed: ${status}`);
    }

    const loc = data.results[0]?.geometry?.location;
    const latNum = typeof loc?.lat === 'number' ? loc.lat : Number(loc?.lat);
    const lonNum = typeof loc?.lng === 'number' ? loc.lng : Number((loc as any)?.lng);

    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
      throw new Error('Invalid lat/lon from Google Geocoding');
    }

    return { lat: latNum, lon: lonNum };
  } catch (err: any) {
    console.error('❌ [Delivery Service] Google Geocoding request failed:');
    if (err?.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    } else if (err?.request) {
      console.error('No response received from Google (network/timeout)');
    } else {
      console.error('Error Message:', err?.message);
    }
    throw err;
  }
}

/**
 * Fetch latitude/longitude using OpenStreetMap Nominatim (no API key).
 * Requires User-Agent header or Nominatim blocks the request.
 */
async function geocodeCityWithOSM(city: string): Promise<LatLng | null> {
  const url = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&format=json&limit=1`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'MegadimCatering/1.0' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const first = data[0];
    const lat = typeof first.lat === 'number' ? first.lat : Number(first.lat);
    const lon = typeof first.lon === 'number' ? first.lon : Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
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
): Promise<{ distance: number; price: number; usedOverride?: boolean; tierFreeShippingThreshold?: number } | null> {
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

  // Home City Bypass – avoid wrong Google Geocoding result for origin area
  const isHomeCity = HOME_CITY_ALIASES.some(
    (alias) => normalizeCityName(alias) === normalized
  );

  let distanceKm: number;

  if (isHomeCity) {
    console.log(
      '[Delivery API] Destination is Home City. Bypassing Google API. Distance set to 0 km.'
    );
    distanceKm = 0;
  } else {
    // Priority 2: Smart Geocoding – Google first, OSM fallback if Google result is suspicious (>65 km)
    const destinationAddress = city.includes('ישראל') ? city : `${city}, ישראל`;
    const originCoords: LatLng = { lat: ORIGIN_LAT, lon: ORIGIN_LON };
    const googleCoords = await geocodeCityWithGoogle(destinationAddress);
    let straightKm = haversineKm(originCoords, googleCoords);
    let source = 'Google';

    if (straightKm > SUSPICIOUS_DISTANCE_KM) {
      console.log(
        '[Delivery API] Google distance suspicious (>65km). Falling back to OpenStreetMap for:',
        city
      );
      const osmCoords = await geocodeCityWithOSM(city);
      if (osmCoords) {
        straightKm = haversineKm(originCoords, osmCoords);
        source = 'OpenStreetMap';
      }
      // If OSM failed, keep original Google result; tier/out-of-area logic will apply
    }

    distanceKm = Math.round(straightKm * ROUTING_FACTOR * 10) / 10;
    console.log(
      `[Delivery API] Haversine distance from origin to "${destinationAddress}" (${source}) = ${straightKm.toFixed(
        2
      )} km, adjusted driving distance ≈ ${distanceKm} km.`
    );
  }

  const tier = await DeliveryPricing.findOne({
    minDistanceKm: { $lte: distanceKm },
    maxDistanceKm: { $gte: distanceKm },
    isActive: true
  })
    .sort({ minDistanceKm: 1 })
    .lean();

  if (tier) {
    console.log(`[Delivery API] Range match: ${distanceKm} km -> ${tier.price}₪`);
    const fst = (tier as any).freeShippingThreshold;
    const tierFreeShippingThreshold =
      typeof fst === 'number' && Number.isFinite(fst) && fst >= 0 ? fst : undefined;
    return { distance: distanceKm, price: tier.price, tierFreeShippingThreshold };
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
    const destCoords = await geocodeCityWithGoogle(destinationAddress);
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
