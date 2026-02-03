import { Request, Response } from 'express';
import SiteSettings from '../models/siteSettings.model';
import { asyncHandler, createValidationError } from '../middleware/errorHandler';

export class SettingsController {
  /**
   * Get site settings (Public endpoint)
   * CRITICAL: Auto-creates default settings if database is empty (no 404 errors)
   */
  getSettings = asyncHandler(async (req: Request, res: Response) => {
    try {
      let settings = await SiteSettings.findOne();
      
      // CRITICAL FIX: If no settings exist, create default document immediately
      if (!settings) {
        console.log('No settings found in database. Creating default settings...');
        settings = new SiteSettings({
          shabbatMenuUrl: '',
          eventsMenuUrl: '',
          contactPhone: '',
          whatsappLink: ''
        });
        await settings.save();
        console.log('Default site settings created successfully');
      }

      res.status(200).json({
        success: true,
        data: {
          shabbatMenuUrl: settings.shabbatMenuUrl || '',
          eventsMenuUrl: settings.eventsMenuUrl || '',
          contactPhone: settings.contactPhone || '',
          whatsappLink: settings.whatsappLink || ''
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

  /**
   * Update site settings (Admin only - should be protected by auth middleware)
   * CRITICAL: Creates settings document if it doesn't exist (edge case)
   */
  updateSettings = asyncHandler(async (req: Request, res: Response) => {
    try {
      const updateData = req.body;

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

      // Try to find existing settings
      let settings = await SiteSettings.findOne();
      
      // If not existing (edge case), create new one with provided data
      if (!settings) {
        console.log('No settings found during update. Creating new settings document...');
        settings = new SiteSettings({
          shabbatMenuUrl: updateData.shabbatMenuUrl || '',
          eventsMenuUrl: updateData.eventsMenuUrl || '',
          contactPhone: updateData.contactPhone || '',
          whatsappLink: updateData.whatsappLink || ''
        });
      } else {
        // Update existing settings - only update fields that are provided
        if (updateData.shabbatMenuUrl !== undefined) {
          settings.shabbatMenuUrl = updateData.shabbatMenuUrl;
        }
        if (updateData.eventsMenuUrl !== undefined) {
          settings.eventsMenuUrl = updateData.eventsMenuUrl;
        }
        if (updateData.contactPhone !== undefined) {
          settings.contactPhone = updateData.contactPhone;
        }
        if (updateData.whatsappLink !== undefined) {
          settings.whatsappLink = updateData.whatsappLink;
        }
      }

      // Save the settings (either new or updated)
      const updatedSettings = await settings.save();

      res.status(200).json({
        success: true,
        data: {
          shabbatMenuUrl: updatedSettings.shabbatMenuUrl || '',
          eventsMenuUrl: updatedSettings.eventsMenuUrl || '',
          contactPhone: updatedSettings.contactPhone || '',
          whatsappLink: updatedSettings.whatsappLink || ''
        },
        message: 'Site settings updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error updating settings:', error);
      // If it's a validation error, return 400, otherwise 500
      if (error.name === 'ValidationError' || error.message.includes('must be')) {
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
}

