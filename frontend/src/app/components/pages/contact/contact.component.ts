import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ContactService } from '../../../services/contact.service';
import { SeoService } from '../../../services/seo.service';
import { MarketingService } from '../../../services/marketing.service';
import { buildWhatsAppHref, WHATSAPP_DEFAULT_MESSAGE } from '../../../constants/contact.constants';
import { LocaleService } from '../../../i18n/locale.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss'],
})
export class ContactComponent implements OnInit {
  private contactService = inject(ContactService);
  private seoService = inject(SeoService);
  private marketingService = inject(MarketingService);
  private translate = inject(TranslateService);
  readonly localeService = inject(LocaleService);

  form = {
    name: '',
    phone: '',
    email: '',
    message: '',
  };
  isSubmitting = false;
  successMessage = '';
  errorMessage = '';
  contactInfo: { phone: string; email: string; whatsapp: string; businessHours: string } = {
    phone: '',
    email: '',
    whatsapp: '',
    businessHours: ''
  };

  ngOnInit(): void {
    this.seoService.updatePage('contact');
    const info = this.contactService.getContactInfo();
    this.contactInfo = {
      phone: info.phone,
      email: info.email,
      whatsapp: info.whatsapp,
      businessHours: info.businessHours
    };
  }

  get whatsappHref(): string {
    return buildWhatsAppHref(this.contactInfo.whatsapp, WHATSAPP_DEFAULT_MESSAGE);
  }

  get displayPhone(): string {
    const p = this.contactInfo.phone || '';
    if (p.length === 10 && p.startsWith('05')) return `${p.slice(0, 3)}-${p.slice(3)}`;
    return p;
  }

  onSubmit(form: { valid: boolean | null }): void {
    if (form.valid !== true || this.isSubmitting) return;
    this.successMessage = '';
    this.errorMessage = '';
    this.isSubmitting = true;
    const utms = this.marketingService.getUtms();
    this.contactService
      .submitContactForm({
        name: this.form.name,
        phone: this.form.phone,
        email: this.form.email,
        message: this.form.message,
        ...(Object.keys(utms).length > 0 ? { marketingData: utms } : {})
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting = false;
          this.successMessage =
            res.message || this.translate.instant('CONTACT_PAGE.SUCCESS_DEFAULT');
          this.form = { name: '', phone: '', email: '', message: '' };
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage =
            err?.error?.message || this.translate.instant('CONTACT_PAGE.ERROR_DEFAULT');
        },
      });
  }
}
