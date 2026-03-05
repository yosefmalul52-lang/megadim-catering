import { Request, Response } from 'express';
import SiteSettings, { PAGE_IDS, IPageAnnouncement } from '../models/siteSettings.model';
import StoreSettings from '../models/store-settings.model';
import Setting from '../models/setting.model';
import { asyncHandler, createValidationError } from '../middleware/errorHandler';

function defaultPageAnnouncements(): Record<string, IPageAnnouncement> {
  const out: Record<string, IPageAnnouncement> = {};
  for (const id of PAGE_IDS) {
    out[id] = { bannerText: '', popupTitle: '', popupText: '' };
  }
  return out;
}

/** Normalize pageAnnouncements from document (supports legacy home/catering/holiday fields). */
function normalizePageAnnouncements(doc: any): Record<string, IPageAnnouncement> {
  const out = defaultPageAnnouncements();
  const pa = doc?.pageAnnouncements && typeof doc.pageAnnouncements === 'object' ? doc.pageAnnouncements : {};
  for (const id of PAGE_IDS) {
    if (pa[id] && typeof pa[id] === 'object') {
      out[id] = {
        bannerText: typeof pa[id].bannerText === 'string' ? pa[id].bannerText : '',
        popupTitle: typeof pa[id].popupTitle === 'string' ? pa[id].popupTitle : '',
        popupText: typeof pa[id].popupText === 'string' ? pa[id].popupText : ''
      };
    }
  }
  // Legacy: map old flat fields into pageAnnouncements
  const raw = doc?.toObject ? doc.toObject() : doc;
  if (raw) {
    if (typeof raw.homeAnnouncementTitle === 'string' || typeof raw.homeAnnouncement === 'string') {
      out.home = out.home || { bannerText: '', popupTitle: '', popupText: '' };
      if (typeof raw.homeAnnouncementTitle === 'string') out.home.popupTitle = raw.homeAnnouncementTitle;
      if (typeof raw.homeAnnouncement === 'string') out.home.popupText = raw.homeAnnouncement;
    }
    if (typeof raw.cateringAnnouncement === 'string') {
      out.events = out.events || { bannerText: '', popupTitle: '', popupText: '' };
      out.events.bannerText = raw.cateringAnnouncement;
    }
    if (typeof raw.holidayAnnouncement === 'string') {
      out.holiday = out.holiday || { bannerText: '', popupTitle: '', popupText: '' };
      out.holiday.bannerText = raw.holidayAnnouncement;
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
          contactPhone: '0528240230',
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
          contactPhone: settings.contactPhone || '0528240230',
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

      let settings = await SiteSettings.findOne();

      if (!settings) {
        console.log('No settings found during update. Creating new settings document...');
        settings = new SiteSettings({
          shabbatMenuUrl: updateData.shabbatMenuUrl || '',
          eventsMenuUrl: updateData.eventsMenuUrl || '',
          contactPhone: updateData.contactPhone || '0528240230',
          orderEmail: updateData.orderEmail || 'yosefmalul52@gmail.com',
          whatsappLink: updateData.whatsappLink || '',
          cholentForceOpen: !!updateData.cholentForceOpen,
          cholentCustomMessage: updateData.cholentCustomMessage || '',
          cholentClosedMessage: updateData.cholentClosedMessage !== undefined ? updateData.cholentClosedMessage : 'ההזמנות נפתחות ביום חמישי בין השעות 09:00 ל-17:00',
          pageAnnouncements: normalizePageAnnouncements(updateData)
        });
      } else {
        if (updateData.shabbatMenuUrl !== undefined) settings.shabbatMenuUrl = updateData.shabbatMenuUrl;
        if (updateData.eventsMenuUrl !== undefined) settings.eventsMenuUrl = updateData.eventsMenuUrl;
        if (updateData.contactPhone !== undefined) settings.contactPhone = updateData.contactPhone;
        if (updateData.orderEmail !== undefined) settings.orderEmail = updateData.orderEmail;
        if (updateData.whatsappLink !== undefined) settings.whatsappLink = updateData.whatsappLink;
        if (updateData.cholentForceOpen !== undefined) settings.cholentForceOpen = updateData.cholentForceOpen;
        if (updateData.cholentCustomMessage !== undefined) settings.cholentCustomMessage = updateData.cholentCustomMessage;
        if (updateData.cholentClosedMessage !== undefined) settings.cholentClosedMessage = updateData.cholentClosedMessage;
        if (updateData.pageAnnouncements !== undefined) {
          settings.pageAnnouncements = normalizePageAnnouncements({ pageAnnouncements: updateData.pageAnnouncements });
        }
      }

      const updatedSettings = await settings.save();
      const pageAnnouncements = normalizePageAnnouncements(updatedSettings);

      res.status(200).json({
        success: true,
        data: {
          shabbatMenuUrl: updatedSettings.shabbatMenuUrl || '',
          eventsMenuUrl: updatedSettings.eventsMenuUrl || '',
          contactPhone: updatedSettings.contactPhone || '0528240230',
          orderEmail: updatedSettings.orderEmail || 'yosefmalul52@gmail.com',
          whatsappLink: updatedSettings.whatsappLink || '',
          cholentForceOpen: !!updatedSettings.cholentForceOpen,
          cholentCustomMessage: updatedSettings.cholentCustomMessage || '',
          cholentClosedMessage: updatedSettings.cholentClosedMessage || 'ההזמנות נפתחות ביום חמישי בין השעות 09:00 ל-17:00',
          pageAnnouncements
        },
        message: 'Site settings updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error updating settings:', error);
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

  /** GET /api/settings/delivery – free shipping + allowed days (create default if missing) */
  getDeliverySettings = asyncHandler(async (req: Request, res: Response) => {
    let doc = await StoreSettings.findOne();
    if (!doc) {
      doc = await StoreSettings.create({
        freeShippingThreshold: 500,
        isFreeShippingActive: false,
        allowedDays: [0, 1, 2, 3],
        minimumLeadDays: 2
      });
    }
    const allowedDays = Array.isArray(doc.allowedDays) ? doc.allowedDays : [0, 1, 2, 3];
    const minimumLeadDays = typeof doc.minimumLeadDays === 'number' && doc.minimumLeadDays >= 0 ? doc.minimumLeadDays : 2;
    res.status(200).json({
      success: true,
      data: {
        freeShippingThreshold: doc.freeShippingThreshold ?? 500,
        isFreeShippingActive: !!doc.isFreeShippingActive,
        baseDeliveryFee: typeof (doc as any).baseDeliveryFee === 'number' ? (doc as any).baseDeliveryFee : 25,
        pricePerKm: typeof (doc as any).pricePerKm === 'number' ? (doc as any).pricePerKm : 3,
        allowedDays,
        minimumLeadDays
      }
    });
  });

  /** PUT /api/settings/delivery – update free shipping + allowed days + minimumLeadDays + baseDeliveryFee + pricePerKm */
  updateDeliverySettings = asyncHandler(async (req: Request, res: Response) => {
    const { freeShippingThreshold, isFreeShippingActive, allowedDays, minimumLeadDays, baseDeliveryFee, pricePerKm } = req.body || {};
    if (freeShippingThreshold !== undefined) {
      const n = Number(freeShippingThreshold);
      if (Number.isNaN(n) || n < 0) throw createValidationError('freeShippingThreshold must be a non-negative number');
    }
    if (isFreeShippingActive !== undefined && typeof isFreeShippingActive !== 'boolean') {
      throw createValidationError('isFreeShippingActive must be a boolean');
    }
    if (allowedDays !== undefined) {
      if (!Array.isArray(allowedDays)) throw createValidationError('allowedDays must be an array');
      const valid = allowedDays.every((d: unknown) => typeof d === 'number' && d >= 0 && d <= 6);
      if (!valid) throw createValidationError('allowedDays must contain only numbers 0–6 (0=Sun, 6=Sat)');
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
    if (allowedDays !== undefined) update.allowedDays = allowedDays;
    if (minimumLeadDays !== undefined) update.minimumLeadDays = Number(minimumLeadDays);
    if (baseDeliveryFee !== undefined) update.baseDeliveryFee = Number(baseDeliveryFee);
    if (pricePerKm !== undefined) update.pricePerKm = Number(pricePerKm);
    const doc = await StoreSettings.findOneAndUpdate({}, update, { new: true, upsert: true, setDefaultsOnInsert: true });
    const allowedDaysOut = Array.isArray(doc.allowedDays) ? doc.allowedDays : [0, 1, 2, 3];
    const minimumLeadDaysOut = typeof doc.minimumLeadDays === 'number' && doc.minimumLeadDays >= 0 ? doc.minimumLeadDays : 2;
    res.status(200).json({
      success: true,
      data: {
        freeShippingThreshold: doc.freeShippingThreshold ?? 500,
        isFreeShippingActive: !!doc.isFreeShippingActive,
        baseDeliveryFee: typeof (doc as any).baseDeliveryFee === 'number' ? (doc as any).baseDeliveryFee : 25,
        pricePerKm: typeof (doc as any).pricePerKm === 'number' ? (doc as any).pricePerKm : 3,
        allowedDays: allowedDaysOut,
        minimumLeadDays: minimumLeadDaysOut
      },
      message: 'Delivery settings updated'
    });
  });
}
