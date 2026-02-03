import { Request, Response } from 'express';
import { SettingsService, UpdateSettingsRequest } from '../services/settings.service';
import { asyncHandler, createValidationError } from '../middleware/errorHandler';

export class SettingsController {
  private settingsService: SettingsService;

  constructor() {
    this.settingsService = new SettingsService();
  }

  /**
   * Get site settings (Public endpoint)
   */
  getSettings = asyncHandler(async (req: Request, res: Response) => {
    const settings = await this.settingsService.getSettings();

    res.status(200).json({
      success: true,
      data: {
        shabbatMenuUrl: settings.shabbatMenuUrl,
        eventsMenuUrl: settings.eventsMenuUrl,
        contactPhone: settings.contactPhone,
        whatsappLink: settings.whatsappLink
      },
      timestamp: new Date().toISOString()
    });
  });

  /**
   * Update site settings (Admin only - should be protected by auth middleware)
   */
  updateSettings = asyncHandler(async (req: Request, res: Response) => {
    const updateData: UpdateSettingsRequest = req.body;

    // Basic validation
    if (updateData.shabbatMenuUrl !== undefined && typeof updateData.shabbatMenuUrl !== 'string') {
      throw createValidationError('shabbatMenuUrl must be a string');
    }

    if (updateData.eventsMenuUrl !== undefined && typeof updateData.eventsMenuUrl !== 'string') {
      throw createValidationError('eventsMenuUrl must be a string');
    }

    if (updateData.contactPhone !== undefined && typeof updateData.contactPhone !== 'string') {
      throw createValidationError('contactPhone must be a string');
    }

    if (updateData.whatsappLink !== undefined && typeof updateData.whatsappLink !== 'string') {
      throw createValidationError('whatsappLink must be a string');
    }

    // Validate URL format if provided
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

    const updatedSettings = await this.settingsService.updateSettings(updateData);

    res.status(200).json({
      success: true,
      data: {
        shabbatMenuUrl: updatedSettings.shabbatMenuUrl,
        eventsMenuUrl: updatedSettings.eventsMenuUrl,
        contactPhone: updatedSettings.contactPhone,
        whatsappLink: updatedSettings.whatsappLink
      },
      message: 'Site settings updated successfully',
      timestamp: new Date().toISOString()
    });
  });
}

