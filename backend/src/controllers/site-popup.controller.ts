import { Request, Response } from 'express';
import { asyncHandler, createValidationError, createNotFoundError } from '../middleware/errorHandler';
import SitePopup, {
  IPopupLocaleContent,
  POPUP_FREQUENCIES,
  POPUP_PAGE_IDS,
  POPUP_PLACEMENTS,
  POPUP_STATUSES,
  POPUP_TEMPLATES,
  PopupFrequency,
  PopupPageId,
  PopupPlacement,
  PopupStatus,
  PopupTemplate
} from '../models/site-popup.model';
import SiteSettings, { PAGE_IDS } from '../models/siteSettings.model';

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function parseLocale(raw: unknown): IPopupLocaleContent {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    title: str(o.title),
    body: str(o.body),
    ctaLabel: str(o.ctaLabel),
    ctaUrl: str(o.ctaUrl),
    imageUrl: str(o.imageUrl)
  };
}

function parseDate(v: unknown): Date | null {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseBody(body: Record<string, unknown>) {
  const internalName = str(body.internalName);
  if (!internalName) throw createValidationError('internalName is required');

  const status = str(body.status) as PopupStatus;
  if (!POPUP_STATUSES.includes(status)) throw createValidationError('invalid status');

  const template = (str(body.template) || 'info') as PopupTemplate;
  if (!POPUP_TEMPLATES.includes(template)) throw createValidationError('invalid template');

  const placement = (str(body.placement) || 'modal') as PopupPlacement;
  if (!POPUP_PLACEMENTS.includes(placement)) throw createValidationError('invalid placement');

  const frequency = (str(body.frequency) || 'session') as PopupFrequency;
  if (!POPUP_FREQUENCIES.includes(frequency)) throw createValidationError('invalid frequency');

  const targetAllPages = body.targetAllPages === true || body.targetAllPages === 'true';
  let pageTargets: PopupPageId[] = [];
  if (!targetAllPages) {
    const raw = Array.isArray(body.pageTargets) ? body.pageTargets : [];
    pageTargets = raw
      .map((p) => String(p).trim())
      .filter((p): p is PopupPageId => (POPUP_PAGE_IDS as readonly string[]).includes(p));
    if (pageTargets.length === 0) {
      throw createValidationError('Select at least one page, or enable targetAllPages');
    }
  }

  const priority = Number(body.priority);
  const maxViewsRaw = body.maxViews;
  const maxViews =
    maxViewsRaw === undefined || maxViewsRaw === null || maxViewsRaw === ''
      ? null
      : Math.max(1, Math.trunc(Number(maxViewsRaw)) || 1);

  const contentRaw =
    body.content && typeof body.content === 'object' ? (body.content as Record<string, unknown>) : {};

  return {
    internalName,
    status,
    template,
    placement,
    targetAllPages,
    pageTargets: targetAllPages ? [] : pageTargets,
    priority: Number.isFinite(priority) ? priority : 0,
    startAt: parseDate(body.startAt),
    endAt: parseDate(body.endAt),
    frequency,
    maxViews: frequency === 'max' ? maxViews : null,
    content: {
      he: parseLocale(contentRaw.he),
      en: parseLocale(contentRaw.en)
    }
  };
}

function isCurrentlyActive(doc: {
  status: string;
  startAt?: Date | null;
  endAt?: Date | null;
}): boolean {
  if (doc.status !== 'active') return false;
  const now = Date.now();
  if (doc.startAt && new Date(doc.startAt).getTime() > now) return false;
  if (doc.endAt && new Date(doc.endAt).getTime() < now) return false;
  return true;
}

function matchesPage(
  doc: { targetAllPages?: boolean; pageTargets?: string[] },
  page: string
): boolean {
  if (doc.targetAllPages) return true;
  return Array.isArray(doc.pageTargets) && doc.pageTargets.includes(page);
}

function toPublicDto(
  doc: InstanceType<typeof SitePopup>,
  locale: 'he' | 'en'
) {
  const loc = locale === 'en' ? doc.content?.en : doc.content?.he;
  const fallback = doc.content?.he;
  return {
    id: String(doc._id),
    template: doc.template,
    placement: doc.placement,
    priority: doc.priority,
    frequency: doc.frequency,
    maxViews: doc.maxViews ?? null,
    title: loc?.title || fallback?.title || '',
    body: loc?.body || fallback?.body || '',
    ctaLabel: loc?.ctaLabel || fallback?.ctaLabel || '',
    ctaUrl: loc?.ctaUrl || fallback?.ctaUrl || '',
    imageUrl: loc?.imageUrl || fallback?.imageUrl || ''
  };
}

/** Map legacy settings page ids → popup page ids. */
const LEGACY_PAGE_MAP: Record<string, PopupPageId> = {
  home: 'home',
  events: 'events',
  holiday: 'holiday',
  cholent: 'cholent',
  salads: 'salads',
  fish: 'fish',
  desserts: 'desserts'
};

export const listPopups = asyncHandler(async (_req: Request, res: Response) => {
  const list = await SitePopup.find().sort({ priority: -1, updatedAt: -1 }).lean();
  res.json({ success: true, data: list });
});

export const getPopup = asyncHandler(async (req: Request, res: Response) => {
  const doc = await SitePopup.findById(req.params.id).lean();
  if (!doc) throw createNotFoundError('Popup');
  res.json({ success: true, data: doc });
});

export const createPopup = asyncHandler(async (req: Request, res: Response) => {
  const data = parseBody(req.body || {});
  const doc = await SitePopup.create(data);
  res.status(201).json({ success: true, data: doc });
});

export const updatePopup = asyncHandler(async (req: Request, res: Response) => {
  const data = parseBody(req.body || {});
  const doc = await SitePopup.findByIdAndUpdate(req.params.id, data, {
    new: true,
    runValidators: true
  });
  if (!doc) throw createNotFoundError('Popup');
  res.json({ success: true, data: doc });
});

export const deletePopup = asyncHandler(async (req: Request, res: Response) => {
  const doc = await SitePopup.findByIdAndDelete(req.params.id);
  if (!doc) throw createNotFoundError('Popup');
  res.json({ success: true, message: 'Deleted' });
});

/**
 * Public: active popups for a page + locale.
 * Client still applies frequency/dismiss rules locally.
 */
export const getActivePopups = asyncHandler(async (req: Request, res: Response) => {
  const page = str(req.query.page) || 'home';
  if (!(POPUP_PAGE_IDS as readonly string[]).includes(page) && page !== 'all') {
    // allow unknown page keys to return site-wide only
  }
  const locale = str(req.query.locale) === 'en' ? 'en' : 'he';

  const candidates = await SitePopup.find({ status: 'active' })
    .sort({ priority: -1, updatedAt: -1 })
    .lean();

  const filtered = candidates.filter(
    (d) => isCurrentlyActive(d) && matchesPage(d, page)
  );

  // One winner per placement
  const byPlacement = new Map<string, (typeof filtered)[0]>();
  for (const d of filtered) {
    if (!byPlacement.has(d.placement)) byPlacement.set(d.placement, d);
  }

  const data = {
    modal: null as ReturnType<typeof toPublicDto> | null,
    banner_top: null as ReturnType<typeof toPublicDto> | null,
    sticky_bottom: null as ReturnType<typeof toPublicDto> | null
  };

  for (const [placement, doc] of byPlacement) {
    const dto = toPublicDto(doc as InstanceType<typeof SitePopup>, locale);
    if (!dto.title && !dto.body && !dto.imageUrl) continue;
    if (placement === 'modal') data.modal = dto;
    if (placement === 'banner_top') data.banner_top = dto;
    if (placement === 'sticky_bottom') data.sticky_bottom = dto;
  }

  res.json({ success: true, data });
});

/** One-time migration from SiteSettings.pageAnnouncements → site_popups. */
export const migrateFromSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await SiteSettings.findOne().lean();
  const pa =
    settings?.pageAnnouncements && typeof settings.pageAnnouncements === 'object'
      ? settings.pageAnnouncements
      : {};

  let created = 0;
  for (const legacyId of PAGE_IDS) {
    const pageId = LEGACY_PAGE_MAP[legacyId];
    if (!pageId) continue;
    const a = (pa as Record<string, Record<string, string>>)[legacyId] || {};
    const bannerText = str(a.bannerText);
    const popupTitle = str(a.popupTitle);
    const popupText = str(a.popupText);
    const popupLinkText = str(a.popupLinkText);
    const popupLinkUrl = str(a.popupLinkUrl);

    if (bannerText) {
      const exists = await SitePopup.findOne({
        internalName: `migrated-banner-${legacyId}`
      }).lean();
      if (!exists) {
        await SitePopup.create({
          internalName: `migrated-banner-${legacyId}`,
          status: 'active',
          template: 'ops',
          placement: 'banner_top',
          targetAllPages: false,
          pageTargets: [pageId],
          priority: 10,
          frequency: 'session',
          content: {
            he: { title: '', body: bannerText, ctaLabel: '', ctaUrl: '', imageUrl: '' },
            en: { title: '', body: bannerText, ctaLabel: '', ctaUrl: '', imageUrl: '' }
          }
        });
        created += 1;
      }
    }

    if (popupTitle || popupText) {
      const exists = await SitePopup.findOne({
        internalName: `migrated-modal-${legacyId}`
      }).lean();
      if (!exists) {
        await SitePopup.create({
          internalName: `migrated-modal-${legacyId}`,
          status: 'active',
          template: 'info',
          placement: 'modal',
          targetAllPages: false,
          pageTargets: [pageId],
          priority: 20,
          frequency: 'session',
          content: {
            he: {
              title: popupTitle,
              body: popupText,
              ctaLabel: popupLinkText,
              ctaUrl: popupLinkUrl,
              imageUrl: ''
            },
            en: {
              title: popupTitle,
              body: popupText,
              ctaLabel: popupLinkText,
              ctaUrl: popupLinkUrl,
              imageUrl: ''
            }
          }
        });
        created += 1;
      }
    }
  }

  res.json({ success: true, created });
});
