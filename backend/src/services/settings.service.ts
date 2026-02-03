import SiteSettings, { ISiteSettings } from '../models/siteSettings.model';

export interface UpdateSettingsRequest {
  shabbatMenuUrl?: string;
  eventsMenuUrl?: string;
  contactPhone?: string;
  whatsappLink?: string;
}

export class SettingsService {
  /**
   * Get site settings (singleton - returns the only settings document)
   * If no settings exist, creates a default one
   */
  async getSettings(): Promise<ISiteSettings> {
    let settings = await SiteSettings.findOne();
    
    if (!settings) {
      // Create default settings document
      settings = await SiteSettings.create({
        shabbatMenuUrl: '',
        eventsMenuUrl: '',
        contactPhone: '',
        whatsappLink: ''
      });
    }
    
    return settings;
  }

  /**
   * Update site settings
   * Updates the singleton settings document
   */
  async updateSettings(updateData: UpdateSettingsRequest): Promise<ISiteSettings> {
    // Get or create settings document
    let settings = await SiteSettings.findOne();
    
    if (!settings) {
      // Create new settings document with provided data
      settings = await SiteSettings.create({
        shabbatMenuUrl: updateData.shabbatMenuUrl || '',
        eventsMenuUrl: updateData.eventsMenuUrl || '',
        contactPhone: updateData.contactPhone || '',
        whatsappLink: updateData.whatsappLink || ''
      });
    } else {
      // Update existing settings
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
      
      await settings.save();
    }
    
    return settings;
  }
}

