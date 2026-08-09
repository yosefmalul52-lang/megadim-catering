import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import {
  catalogToPublicDto,
  getOrCreateEventsCatalog,
  updateEventsCatalog
} from '../services/events-catering-catalog.service';
import {
  getOrCreateShabbatCatalog,
  shabbatCatalogToPublicDto,
  updateShabbatCatalog
} from '../services/shabbat-catering-catalog.service';

export const getPublicEventsCatalog = asyncHandler(async (_req: Request, res: Response) => {
  const doc = await getOrCreateEventsCatalog();
  res.json({ success: true, catalog: catalogToPublicDto(doc) });
});

export const getAdminEventsCatalog = asyncHandler(async (_req: Request, res: Response) => {
  const doc = await getOrCreateEventsCatalog();
  res.json({ success: true, catalog: catalogToPublicDto(doc) });
});

export const putAdminEventsCatalog = asyncHandler(async (req: Request, res: Response) => {
  const doc = await updateEventsCatalog(req.body || {});
  res.json({ success: true, catalog: catalogToPublicDto(doc) });
});

export const getPublicShabbatCatalog = asyncHandler(async (_req: Request, res: Response) => {
  const doc = await getOrCreateShabbatCatalog();
  res.json({ success: true, catalog: shabbatCatalogToPublicDto(doc) });
});

export const getAdminShabbatCatalog = asyncHandler(async (_req: Request, res: Response) => {
  const doc = await getOrCreateShabbatCatalog();
  res.json({ success: true, catalog: shabbatCatalogToPublicDto(doc) });
});

export const putAdminShabbatCatalog = asyncHandler(async (req: Request, res: Response) => {
  const doc = await updateShabbatCatalog(req.body || {});
  res.json({ success: true, catalog: shabbatCatalogToPublicDto(doc) });
});
