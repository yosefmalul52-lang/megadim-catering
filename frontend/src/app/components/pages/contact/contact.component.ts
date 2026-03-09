import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContactService } from '../../../services/contact.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss'],
})
export class ContactComponent implements OnInit {
  form = {
    name: '',
    phone: '',
    email: '',
    message: '',
  };
  isSubmitting = false;
  successMessage = '';
  contactInfo: { phone: string; email: string } = { phone: '', email: '' };

  constructor(private contactService: ContactService) {}

  ngOnInit(): void {
    const info = this.contactService.getContactInfo();
    this.contactInfo = { phone: info.phone, email: info.email };
  }

  get displayPhone(): string {
    const p = this.contactInfo.phone || '';
    if (p.length === 10 && p.startsWith('05')) return `${p.slice(0, 3)}-${p.slice(3)}`;
    return p;
  }

  onSubmit(form: { valid: boolean | null }): void {
    if (form.valid !== true || this.isSubmitting) return;
    this.successMessage = '';
    this.isSubmitting = true;
    this.contactService
      .submitContactForm({
        name: this.form.name,
        phone: this.form.phone,
        email: this.form.email,
        message: this.form.message,
      })
      .subscribe({
        next: (res) => {
          this.isSubmitting = false;
          this.successMessage = res.message || 'תודה על פנייתך! נחזור אליך בהקדם.';
          this.form = { name: '', phone: '', email: '', message: '' };
        },
        error: () => {
          this.isSubmitting = false;
        },
      });
  }
}
