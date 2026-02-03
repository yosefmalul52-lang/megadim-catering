import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { SiteSettingsService, SiteSettings } from '../../../services/site-settings.service';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-settings.component.html',
  styleUrls: ['./admin-settings.component.scss']
})
export class AdminSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private settingsService = inject(SiteSettingsService);
  private toastr = inject(ToastrService);

  settingsForm!: FormGroup;
  isLoading = false;
  isSaving = false;

  ngOnInit(): void {
    // Initialize form
    this.settingsForm = this.fb.group({
      shabbatMenuUrl: ['', [Validators.required]],
      eventsMenuUrl: ['', [Validators.required]],
      contactPhone: [''],
      whatsappLink: ['']
    });

    // Load current settings
    this.loadSettings();
  }

  loadSettings(): void {
    this.isLoading = true;
    this.settingsService.getSettings().subscribe({
      next: (settings) => {
        console.log('Received settings data:', settings); // Debug log

        // Safely handle null or undefined data
        if (settings) {
          this.settingsForm.patchValue({
            shabbatMenuUrl: settings.shabbatMenuUrl || '',
            eventsMenuUrl: settings.eventsMenuUrl || '',
            contactPhone: settings.contactPhone || '',
            whatsappLink: settings.whatsappLink || ''
          });
        } else {
          // Handle empty data case without crashing
          console.warn('Settings data is null, initializing with defaults.');
          this.settingsForm.patchValue({
            shabbatMenuUrl: '',
            eventsMenuUrl: '',
            contactPhone: '',
            whatsappLink: ''
          });
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading settings:', error);
        this.isLoading = false;
        this.toastr.error('שגיאה בטעינת ההגדרות', 'שגיאה', {
          timeOut: 5000,
          positionClass: 'toast-top-left'
        });
        // Initialize form with empty values on error
        this.settingsForm.patchValue({
          shabbatMenuUrl: '',
          eventsMenuUrl: '',
          contactPhone: '',
          whatsappLink: ''
        });
      }
    });
  }

  onSubmit(): void {
    if (this.settingsForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.settingsForm.controls).forEach(key => {
        this.settingsForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isSaving = true;

    const formData = this.settingsForm.value;

    this.settingsService.updateSettings(formData).subscribe({
      next: (updatedSettings) => {
        this.isSaving = false;
        this.toastr.success('ההגדרות נשמרו בהצלחה!', 'הצלחה', {
          timeOut: 3000,
          positionClass: 'toast-top-left'
        });
      },
      error: (error) => {
        console.error('Error saving settings:', error);
        this.isSaving = false;
        this.toastr.error(error.message || 'שגיאה בשמירת ההגדרות', 'שגיאה', {
          timeOut: 5000,
          positionClass: 'toast-top-left'
        });
      }
    });
  }

  // Helper method to check if field has error
  hasError(fieldName: string): boolean {
    const field = this.settingsForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  // Helper method to get error message
  getErrorMessage(fieldName: string): string {
    const field = this.settingsForm.get(fieldName);
    if (field?.hasError('required')) {
      return 'שדה זה חובה';
    }
    return '';
  }
}

