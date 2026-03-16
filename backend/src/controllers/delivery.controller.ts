import { Request, Response } from 'express';
import { calculateDeliveryFee } from '../services/delivery.service';
import StoreSettings from '../models/store-settings.model';
import DeliveryPricing from '../models/delivery-pricing.model';
import DeliveryCityOverride from '../models/delivery-city-override.model';

function normalizeCityName(city: string): string {
  return (city || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function postCalculateFee(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body || {};
    const destinationCity =
      typeof body.destinationCity === 'string'
        ? body.destinationCity.trim()
        : typeof body.city === 'string'
          ? body.city.trim()
          : undefined;
    const cartTotal = typeof body.cartTotal === 'number' ? body.cartTotal : Number(body.cartTotal);
    const cartTotalNum = Number.isNaN(cartTotal) ? 0 : cartTotal;

    if (!destinationCity) {
      res.status(400).json({ error: 'City is required' });
      return;
    }

    console.log(`[Delivery API] Request received for destination: ${destinationCity}, cartTotal: ${cartTotalNum}`);

    const mapsKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!mapsKey) {
      console.error(
        '[Production Alert] Delivery calculation skipped: GOOGLE_MAPS_API_KEY is undefined or empty in this environment.'
      );
      console.warn('[Delivery API] GOOGLE_MAPS_API_KEY missing – using flat-rate fallback so checkout does not break.');
      const storeSettings = await StoreSettings.findOne().lean();
      const freeShippingThreshold = storeSettings?.freeShippingThreshold ?? 500;
      const isFreeShippingActive = !!storeSettings?.isFreeShippingActive;
      const flatFee = typeof (storeSettings as any)?.baseDeliveryFee === 'number' ? (storeSettings as any).baseDeliveryFee : 50;
      if (isFreeShippingActive && cartTotalNum >= freeShippingThreshold) {
        res.status(200).json({ distance: 0, price: 0, originalPrice: flatFee, isFree: true });
        return;
      }
      res.status(200).json({ distance: 0, price: flatFee, isFree: false });
      return;
    }

    const result = await calculateDeliveryFee(destinationCity);
    if (result === null) {
      res.status(400).json({ error: 'מחוץ לאזור המשלוחים' });
      return;
    }

    const storeSettings = await StoreSettings.findOne().lean();
    const freeShippingThreshold = storeSettings?.freeShippingThreshold ?? 500;
    const isFreeShippingActive = !!storeSettings?.isFreeShippingActive;

    // Priority 1: Free shipping above threshold (only when in delivery area)
    if (isFreeShippingActive && cartTotalNum >= freeShippingThreshold) {
      res.status(200).json({
        distance: result.distance,
        price: 0,
        originalPrice: result.price,
        isFree: true
      });
      return;
    }

    res.status(200).json({
      distance: result.distance,
      price: result.price,
      isFree: false
    });
    return;
  } catch (err: any) {
    console.error('❌ [Delivery Controller Error] Crash occurred in calculateFee:');
    if (err?.response) {
      console.error('Data:', err.response.data);
      console.error('Status:', err.response.status);
    } else if (err?.request) {
      console.error('No response received (request object present):', typeof err.request);
    } else {
      console.error('Error Message:', err?.message);
    }
    console.error('Stack Trace:', err?.stack);

    const details = err?.message ? String(err.message) : undefined;
    const hasMapsKey = !!process.env.GOOGLE_MAPS_API_KEY;
    res.status(500).json({
      error: 'שגיאת שרת פנימית בחישוב המשלוח',
      ...(details && { details }),
      debugInfo: {
        hasKey: hasMapsKey
      }
    });
    return;
  }
}

/** GET /api/delivery/pricing – fetch all tiers sorted by minDistanceKm */
export async function getPricing(req: Request, res: Response): Promise<void> {
  try {
    const tiers = await DeliveryPricing.find({}).sort({ minDistanceKm: 1 }).lean();
    res.status(200).json(tiers);
  } catch (err: any) {
    console.error('Delivery getPricing error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch pricing tiers' });
  }
}

/** POST /api/delivery/pricing – create a new tier */
export async function createPricing(req: Request, res: Response): Promise<void> {
  try {
    const { minDistanceKm, maxDistanceKm, price } = req.body ?? {};

    if (minDistanceKm === undefined || maxDistanceKm === undefined || price === undefined) {
      res.status(400).json({ error: 'נא למלא את כל השדות: ממרחק, עד מרחק, ומחיר.' });
      return;
    }

    const min = Number(minDistanceKm);
    const max = Number(maxDistanceKm);
    const prc = Number(price);

    if (Number.isNaN(min) || Number.isNaN(max) || Number.isNaN(prc)) {
      res.status(400).json({ error: 'הערכים חייבים להיות מספרים תקינים.' });
      return;
    }

    const newTier = new DeliveryPricing({ minDistanceKm: min, maxDistanceKm: max, price: prc, isActive: true });
    const savedTier = await newTier.save();

    res.status(201).json(savedTier);
    return;
  } catch (error: any) {
    console.error('❌ [Create Pricing Tier Error]:', error);
    res.status(500).json({
      error: 'שגיאת שרת פנימית בעת שמירת אזור החלוקה',
      details: error?.message
    });
    return;
  }
}

/** PUT /api/delivery/pricing/:id – update a tier */
export async function updatePricing(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { minDistanceKm, maxDistanceKm, price, isActive } = req.body || {};
    const update: Record<string, unknown> = {};
    if (typeof minDistanceKm === 'number') update.minDistanceKm = minDistanceKm;
    if (typeof maxDistanceKm === 'number') update.maxDistanceKm = maxDistanceKm;
    if (typeof price === 'number') update.price = price;
    if (typeof isActive === 'boolean') update.isActive = isActive;
    const doc = await DeliveryPricing.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!doc) {
      res.status(404).json({ error: 'Pricing tier not found' });
      return;
    }
    res.status(200).json(doc);
  } catch (err: any) {
    console.error('Delivery updatePricing error:', err);
    res.status(500).json({ error: err.message || 'Failed to update pricing tier' });
  }
}

/** DELETE /api/delivery/pricing/:id – delete a tier */
export async function deletePricing(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const doc = await DeliveryPricing.findByIdAndDelete(id);
    if (!doc) {
      res.status(404).json({ error: 'Pricing tier not found' });
      return;
    }
    res.status(200).json({ deleted: true, id });
  } catch (err: any) {
    console.error('Delivery deletePricing error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete pricing tier' });
  }
}

// ---------- City overrides (override price per city) ----------

/** GET /api/delivery/cities – list all city overrides */
export async function getCityOverrides(req: Request, res: Response): Promise<void> {
  try {
    const list = await DeliveryCityOverride.find({}).sort({ displayName: 1 }).lean();
    res.status(200).json(list);
  } catch (err: any) {
    console.error('Delivery getCityOverrides error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch city overrides' });
  }
}

/** POST /api/delivery/cities – create city override */
export async function createCityOverride(req: Request, res: Response): Promise<void> {
  try {
    const { displayName, overridePrice } = req.body ?? {};
    const name = (displayName ?? '').toString().trim();
    if (!name) {
      res.status(400).json({ error: 'שם העיר חובה' });
      return;
    }
    const price = Number(overridePrice);
    if (Number.isNaN(price) || price < 0) {
      res.status(400).json({ error: 'מחיר override חייב להיות מספר לא שלילי' });
      return;
    }
    const cityName = normalizeCityName(name);
    const existing = await DeliveryCityOverride.findOne({ cityName }).lean();
    if (existing) {
      res.status(409).json({ error: 'עיר עם שם זה כבר קיימת' });
      return;
    }
    const doc = await DeliveryCityOverride.create({
      cityName,
      displayName: name,
      overridePrice: price,
      isActive: true
    });
    res.status(201).json(doc);
  } catch (err: any) {
    console.error('Delivery createCityOverride error:', err);
    res.status(500).json({ error: err.message || 'Failed to create city override' });
  }
}

/** PUT /api/delivery/cities/:id – update city override */
export async function updateCityOverride(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { displayName, overridePrice, isActive } = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (typeof displayName === 'string' && displayName.trim()) {
      update.displayName = displayName.trim();
      update.cityName = normalizeCityName(displayName);
    }
    if (typeof overridePrice === 'number' && overridePrice >= 0) update.overridePrice = overridePrice;
    if (typeof isActive === 'boolean') update.isActive = isActive;
    const doc = await DeliveryCityOverride.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!doc) {
      res.status(404).json({ error: 'City override not found' });
      return;
    }
    res.status(200).json(doc);
  } catch (err: any) {
    console.error('Delivery updateCityOverride error:', err);
    res.status(500).json({ error: err.message || 'Failed to update city override' });
  }
}

/** DELETE /api/delivery/cities/:id – delete city override */
export async function deleteCityOverride(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const doc = await DeliveryCityOverride.findByIdAndDelete(id);
    if (!doc) {
      res.status(404).json({ error: 'City override not found' });
      return;
    }
    res.status(200).json({ deleted: true, id });
  } catch (err: any) {
    console.error('Delivery deleteCityOverride error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete city override' });
  }
}
