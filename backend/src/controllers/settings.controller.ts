import { Request, Response } from 'express';
import SiteSettings, { PAGE_IDS, IPageAnnouncement } from '../models/siteSettings.model';
import StoreSettings from '../models/store-settings.model';
import Setting from '../models/setting.model';
import { asyncHandler, createValidationError } from '../middleware/errorHandler';

function defaultPageAnnouncements(): Record<string, IPageAnnouncement> {
  const out: Record<string, IPageAnnouncement> = {};
  for (const id of PAGE_IDS) {
    out[id] = { bannerText: '', popupTitle: '', popupText: '', popupLinkText: '', popupLinkUrl: '' };
  }
  return out;
}

/** Normalize pageAnnouncements from document (supports legacy home/catering/holiday fields). */
function normalizePageAnnouncements(doc: any): Record<string, IPageAnnouncement> {
  const out = defaultPageAnnouncements();
  const pa = doc?.pageAnnouncements && typeof doc.pageAnnouncements === 'object' ? doc.pageAnnouncements : {};
  const emptyPage = (): IPageAnnouncement => ({ bannerText: '', popupTitle: '', popupText: '', popupLinkText: '', popupLinkUrl: '' });
  for (const id of PAGE_IDS) {
    if (pa[id] && typeof pa[id] === 'object') {
      const v = pa[id];
      out[id] = {
        bannerText: typeof v.bannerText === 'string' ? v.bannerText : '',
        popupTitle: typeof v.popupTitle === 'string' ? v.popupTitle : '',
        popupText: typeof v.popupText === 'string' ? v.popupText : '',
        popupLinkText: typeof v.popupLinkText === 'string' ? v.popupLinkText : '',
        popupLinkUrl: typeof v.popupLinkUrl === 'string' ? v.popupLinkUrl : ''
      };
    }
  }
  // Legacy: use root fields only when pageAnnouncements has no value (new data wins)
  const raw = doc?.toObject ? doc.toObject() : doc;
  if (raw) {
    if (typeof raw.homeAnnouncementTitle === 'string' || typeof raw.homeAnnouncement === 'string') {
      out.home = out.home || emptyPage();
      if (typeof raw.homeAnnouncementTitle === 'string' && !(out.home!.popupTitle?.trim())) out.home!.popupTitle = raw.homeAnnouncementTitle;
      if (typeof raw.homeAnnouncement === 'string' && !(out.home!.popupText?.trim())) out.home!.popupText = raw.homeAnnouncement;
    }
    if (typeof raw.cateringAnnouncement === 'string') {
      out.events = out.events || emptyPage();
      if (!(out.events!.bannerText?.trim())) out.events!.bannerText = raw.cateringAnnouncement;
    }
    if (typeof raw.holidayAnnouncement === 'string') {
      out.holiday = out.holiday || emptyPage();
      if (!(out.holiday!.bannerText?.trim())) out.holiday!.bannerText = raw.holidayAnnouncement;
    }
  }
  return out;
}

export class SettingsController {
  getSettings = asyncHandler(async (req: Request, res: Response) => {
    try {
      let settings = await SiteSettings.findOne();

      if (!settings) {
        console.log('No settings found in database. Creating default settings...');
        settings = new SiteSettings({
          shabbatMenuUrl: '',
          eventsMenuUrl: '',
          contactPhone: '073-367-8399',
          orderEmail: 'yosefmalul52@gmail.com',
          whatsappLink: '',
          cholentForceOpen: false,
          cholentCustomMessage: '',
          cholentClosedMessage: 'ההזמנות נפתחות ביום חמישי בין השעות 09:00 ל-17:00',
          pageAnnouncements: defaultPageAnnouncements()
        });
        await settings.save();
        console.log('Default site settings created successfully');
      }

      const pageAnnouncements = normalizePageAnnouncements(settings);

      res.status(200).json({
        success: true,
        data: {
          shabbatMenuUrl: settings.shabbatMenuUrl || '',
          eventsMenuUrl: settings.eventsMenuUrl || '',
          contactPhone: settings.contactPhone || '073-367-8399',
          orderEmail: settings.orderEmail || 'yosefmalul52@gmail.com',
          whatsappLink: settings.whatsappLink || '',
          cholentForceOpen: !!settings.cholentForceOpen,
          cholentCustomMessage: settings.cholentCustomMessage || '',
          cholentClosedMessage: settings.cholentClosedMessage || 'ההזמנות נפתחות ביום חמישי בין השעות 09:00 ל-17:00',
          pageAnnouncements
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching settings',
        error: error.message
      });
    }
  });

  updateSettings = asyncHandler(async (req: Request, res: Response) => {
    try {
      const updateData = req.body;

      if (updateData.shabbatMenuUrl !== undefined && typeof updateData.shabbatMenuUrl !== 'string') {
        throw createValidationError('shabbatMenuUrl must be a string');
      }
      if (updateData.eventsMenuUrl !== undefined && typeof updateData.eventsMenuUrl !== 'string') {
        throw createValidationError('eventsMenuUrl must be a string');
      }
      if (updateData.contactPhone !== undefined && typeof updateData.contactPhone !== 'string') {
        throw createValidationError('contactPhone must be a string');
      }
      if (updateData.orderEmail !== undefined && typeof updateData.orderEmail !== 'string') {
        throw createValidationError('orderEmail must be a string');
      }
      if (updateData.whatsappLink !== undefined && typeof updateData.whatsappLink !== 'string') {
        throw createValidationError('whatsappLink must be a string');
      }
      if (updateData.cholentForceOpen !== undefined && typeof updateData.cholentForceOpen !== 'boolean') {
        throw createValidationError('cholentForceOpen must be a boolean');
      }
      if (updateData.cholentCustomMessage !== undefined && typeof updateData.cholentCustomMessage !== 'string') {
        throw createValidationError('cholentCustomMessage must be a string');
      }
      if (updateData.cholentClosedMessage !== undefined && typeof updateData.cholentClosedMessage !== 'string') {
        throw createValidationError('cholentClosedMessage must be a string');
      }
      if (updateData.pageAnnouncements !== undefined) {
        if (typeof updateData.pageAnnouncements !== 'object' || updateData.pageAnnouncements === null) {
          throw createValidationError('pageAnnouncements must be an object');
        }
        for (const key of Object.keys(updateData.pageAnnouncements)) {
          const v = updateData.pageAnnouncements[key];
          if (v != null && typeof v !== 'object') {
            throw createValidationError(`pageAnnouncements.${key} must be an object`);
          }
          if (v != null) {
            if (v.bannerText !== undefined && typeof v.bannerText !== 'string') {
              throw createValidationError(`pageAnnouncements.${key}.bannerText must be a string`);
            }
            if (v.popupTitle !== undefined && typeof v.popupTitle !== 'string') {
              throw createValidationError(`pageAnnouncements.${key}.popupTitle must be a string`);
            }
            if (v.popupText !== undefined && typeof v.popupText !== 'string') {
              throw createValidationError(`pageAnnouncements.${key}.popupText must be a string`);
            }
            if (v.popupLinkText !== undefined && typeof v.popupLinkText !== 'string') {
              throw createValidationError(`pageAnnouncements.${key}.popupLinkText must be a string`);
            }
            if (v.popupLinkUrl !== undefined && typeof v.popupLinkUrl !== 'string') {
              throw createValidationError(`pageAnnouncements.${key}.popupLinkUrl must be a string`);
            }
          }
        }
      }

      if (updateData.shabbatMenuUrl && updateData.shabbatMenuUrl.trim() !== '') {
        try {
          new URL(updateData.shabbatMenuUrl);
        } catch {
          throw createValidationError('shabbatMenuUrl must be a valid URL');
        }
      }
      if (updateData.eventsMenuUrl && updateData.eventsMenuUrl.trim() !== '') {
        try {
          new URL(updateData.eventsMenuUrl);
        } catch {
          throw createValidationError('eventsMenuUrl must be a valid URL');
        }
      }
      if (updateData.whatsappLink && updateData.whatsappLink.trim() !== '') {
        try {
          new URL(updateData.whatsappLink);
        } catch {
          throw createValidationError('whatsappLink must be a valid URL');
        }
      }

      console.log('SERVER RECEIVED DATA:', JSON.stringify(updateData.pageAnnouncements?.home, null, 2));

      // Sync legacy root fields for backward compatibility (so old clients reading homeAnnouncement etc. see current data)
      if (updateData.pageAnnouncements?.home) {
        updateData.homeAnnouncement = updateData.pageAnnouncements.home.popupText ?? '';
        updateData.homeAnnouncementTitle = updateData.pageAnnouncements.home.popupTitle ?? '';
      }
      if (updateData.pageAnnouncements?.events) {
        updateData.cateringAnnouncement = updateData.pageAnnouncements.events.bannerText ?? '';
      }
      if (updateData.pageAnnouncements?.holiday) {
        updateData.holidayAnnouncement = updateData.pageAnnouncements.holiday.bannerText ?? '';
      }

      const result = await SiteSettings.findOneAndUpdate(
        {},
        { $set: updateData },
        { upsert: true, new: true, runValidators: false, strict: false }
      );

      if (!result) {
        throw new Error('findOneAndUpdate returned null');
      }

      console.log('✅ DB UPDATED SUCCESSFULLY');
      const pageAnnouncements = normalizePageAnnouncements(result);

      res.status(200).json({
        success: true,
        data: {
          shabbatMenuUrl: result.shabbatMenuUrl || '',
          eventsMenuUrl: result.eventsMenuUrl || '',
          contactPhone: result.contactPhone || '073-367-8399',
          orderEmail: result.orderEmail || 'yosefmalul52@gmail.com',
          whatsappLink: result.whatsappLink || '',
          cholentForceOpen: !!result.cholentForceOpen,
          cholentCustomMessage: result.cholentCustomMessage || '',
          cholentClosedMessage: result.cholentClosedMessage || 'ההזמנות נפתחות ביום חמישי בין השעות 09:00 ל-17:00',
          pageAnnouncements
        },
        message: 'Site settings updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ DB UPDATE FAILED:', error);
      if (error.name === 'ValidationError' || error.message?.includes('must be')) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Server error while updating settings',
          error: error.message
        });
      }
    }
  });

  /** GET /api/settings (global store settings) – single document; create default if missing. Used by shipping dashboard. */
  getStoreSettings = asyncHandler(async (req: Request, res: Response) => {
    let doc = await Setting.findOne();
    if (!doc) {
      doc = await Setting.create({
        freeShippingThreshold: 0,
        baseDeliveryFee: 0,
        pricePerKm: 0
      });
    }
    res.status(200).json({
      success: true,
      data: {
        freeShippingThreshold: doc.freeShippingThreshold ?? 0,
        baseDeliveryFee: doc.baseDeliveryFee ?? 0,
        pricePerKm: doc.pricePerKm ?? 0
      },
      timestamp: new Date().toISOString()
    });
  });

  /** PUT /api/settings (global store settings) – update single document. Admin only. */
  updateStoreSettings = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body || {};
    const update: Record<string, number> = {};
    if (body.freeShippingThreshold !== undefined) {
      const n = Number(body.freeShippingThreshold);
      if (Number.isNaN(n) || n < 0) throw createValidationError('freeShippingThreshold must be a non-negative number');
      update.freeShippingThreshold = n;
    }
    if (body.baseDeliveryFee !== undefined) {
      const n = Number(body.baseDeliveryFee);
      if (Number.isNaN(n) || n < 0) throw createValidationError('baseDeliveryFee must be a non-negative number');
      update.baseDeliveryFee = n;
    }
    if (body.pricePerKm !== undefined) {
      const n = Number(body.pricePerKm);
      if (Number.isNaN(n) || n < 0) throw createValidationError('pricePerKm must be a non-negative number');
      update.pricePerKm = n;
    }
    const doc = await Setting.findOneAndUpdate({}, update, { new: true, upsert: true, setDefaultsOnInsert: true });
    res.status(200).json({
      success: true,
      data: {
        freeShippingThreshold: doc.freeShippingThreshold ?? 0,
        baseDeliveryFee: doc.baseDeliveryFee ?? 0,
        pricePerKm: doc.pricePerKm ?? 0
      },
      message: 'Settings updated successfully',
      timestamp: new Date().toISOString()
    });
  });

  /** GET /api/settings/delivery – free shipping + openDates + minimumLeadDays (create default if missing) */
  getDeliverySettings = asyncHandler(async (req: Request, res: Response) => {
    let doc = await StoreSettings.findOne();
    if (!doc) {
      doc = await StoreSettings.create({
        freeShippingThreshold: 500,
        isFreeShippingActive: false,
        openDates: [],
        minimumLeadDays: 2
      });
    }
    const openDates = Array.isArray((doc as any).openDates)
      ? (doc as any).openDates.filter((s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s as string))
      : [];
    const minimumLeadDays = typeof doc.minimumLeadDays === 'number' && doc.minimumLeadDays >= 0 ? doc.minimumLeadDays : 2;
    res.status(200).json({
      success: true,
      data: {
        freeShippingThreshold: doc.freeShippingThreshold ?? 500,
        isFreeShippingActive: !!doc.isFreeShippingActive,
        baseDeliveryFee: typeof (doc as any).baseDeliveryFee === 'number' ? (doc as any).baseDeliveryFee : 25,
        pricePerKm: typeof (doc as any).pricePerKm === 'number' ? (doc as any).pricePerKm : 3,
        openDates,
        minimumLeadDays
      }
    });
  });

  /** PUT /api/settings/delivery – update free shipping + openDates + minimumLeadDays + baseDeliveryFee + pricePerKm */
  updateDeliverySettings = asyncHandler(async (req: Request, res: Response) => {
    const { freeShippingThreshold, isFreeShippingActive, openDates, minimumLeadDays, baseDeliveryFee, pricePerKm } = req.body || {};
    if (freeShippingThreshold !== undefined) {
      const n = Number(freeShippingThreshold);
      if (Number.isNaN(n) || n < 0) throw createValidationError('freeShippingThreshold must be a non-negative number');
    }
    if (isFreeShippingActive !== undefined && typeof isFreeShippingActive !== 'boolean') {
      throw createValidationError('isFreeShippingActive must be a boolean');
    }
    const YYYYMMDD = /^\d{4}-\d{2}-\d{2}$/;
    if (openDates !== undefined) {
      if (!Array.isArray(openDates)) throw createValidationError('openDates must be an array');
      const valid = openDates.every((s: unknown) => typeof s === 'string' && YYYYMMDD.test(s as string));
      if (!valid) throw createValidationError('openDates must contain only strings in YYYY-MM-DD format');
    }
    if (minimumLeadDays !== undefined) {
      const n = Number(minimumLeadDays);
      if (Number.isNaN(n) || n < 0 || !Number.isInteger(n)) {
        throw createValidationError('minimumLeadDays must be a non-negative integer');
      }
    }
    if (baseDeliveryFee !== undefined) {
      const n = Number(baseDeliveryFee);
      if (Number.isNaN(n) || n < 0) throw createValidationError('baseDeliveryFee must be a non-negative number');
    }
    if (pricePerKm !== undefined) {
      const n = Number(pricePerKm);
      if (Number.isNaN(n) || n < 0) throw createValidationError('pricePerKm must be a non-negative number');
    }
    const update: Record<string, unknown> = {};
    if (freeShippingThreshold !== undefined) update.freeShippingThreshold = Number(freeShippingThreshold);
    if (isFreeShippingActive !== undefined) update.isFreeShippingActive = isFreeShippingActive;
    if (openDates !== undefined) update.openDates = openDates;
    if (minimumLeadDays !== undefined) update.minimumLeadDays = Number(minimumLeadDays);
    if (baseDeliveryFee !== undefined) update.baseDeliveryFee = Number(baseDeliveryFee);
    if (pricePerKm !== undefined) update.pricePerKm = Number(pricePerKm);
    const doc = await StoreSettings.findOneAndUpdate({}, update, { new: true, upsert: true, setDefaultsOnInsert: true });
    const openDatesOut = Array.isArray((doc as any).openDates)
      ? (doc as any).openDates.filter((s: unknown) => typeof s === 'string' && YYYYMMDD.test(s as string))
      : [];
    const minimumLeadDaysOut = typeof doc.minimumLeadDays === 'number' && doc.minimumLeadDays >= 0 ? doc.minimumLeadDays : 2;
    res.status(200).json({
      success: true,
      data: {
        freeShippingThreshold: doc.freeShippingThreshold ?? 500,
        isFreeShippingActive: !!doc.isFreeShippingActive,
        baseDeliveryFee: typeof (doc as any).baseDeliveryFee === 'number' ? (doc as any).baseDeliveryFee : 25,
        pricePerKm: typeof (doc as any).pricePerKm === 'number' ? (doc as any).pricePerKm : 3,
        openDates: openDatesOut,
        minimumLeadDays: minimumLeadDaysOut
      },
      message: 'Delivery settings updated'
    });
  });
}
