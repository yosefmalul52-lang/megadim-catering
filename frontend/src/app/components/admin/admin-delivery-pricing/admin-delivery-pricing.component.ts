import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { AdminDeliveryService, DeliveryPricingTier } from '../../../services/admin-delivery.service';

@Component({
  selector: 'app-admin-delivery-pricing',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './admin-delivery-pricing.component.html',
  styleUrls: ['./admin-delivery-pricing.component.scss']
})
export class AdminDeliveryPricingComponent implements OnInit {
  private fb = inject(FormBuilder);
  private adminDelivery = inject(AdminDeliveryService);

  form!: FormGroup;
  tiers: DeliveryPricingTier[] = [];
  isLoading = false;
  isSaving = false;
  errorMessage = '';
  /** When set, we're editing this tier; otherwise adding new */
  editingId: string | null = null;

  /** Free shipping promo settings */
  freeShippingActive = false;
  freeShippingThreshold = 500;
  isSavingSettings = false;

  ngOnInit(): void {
    this.form = this.fb.group({
      minDistanceKm: [0, [Validators.required, Validators.min(0)]],
      maxDistanceKm: [15, [Validators.required, Validators.min(0)]],
      price: [50, [Validators.required, Validators.min(0)]]
    });
    this.loadTiers();
    this.loadDeliverySettings();
  }

  loadDeliverySettings(): void {
    this.adminDelivery.getDeliverySettings().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.freeShippingActive = res.data.isFreeShippingActive ?? false;
          this.freeShippingThreshold = res.data.freeShippingThreshold ?? 500;
        }
      },
      error: () => {}
    });
  }

  saveDeliverySettings(): void {
    this.isSavingSettings = true;
    this.adminDelivery.updateDeliverySettings({
      isFreeShippingActive: this.freeShippingActive,
      freeShippingThreshold: this.freeShippingThreshold
    }).subscribe({
      next: () => {
        this.isSavingSettings = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.error || 'שגיאה בשמירת הגדרות המשלוח';
        this.isSavingSettings = false;
      }
    });
  }

  loadTiers(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.adminDelivery.getAllPricing().subscribe({
      next: (list) => {
        this.tiers = list;
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.error || 'שגיאה בטעינת טווחי המחירים';
        this.isLoading = false;
      }
    });
  }

  submitTier(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.value;
    const min = Number(value.minDistanceKm);
    const max = Number(value.maxDistanceKm);
    const price = Number(value.price);
    if (min > max) {
      this.errorMessage = 'מרחק מינימלי חייב להיות קטן או שווה למרחק מקסימלי';
      return;
    }
    this.isSaving = true;
    this.errorMessage = '';

    if (this.editingId) {
      this.adminDelivery.updatePricing(this.editingId, { minDistanceKm: min, maxDistanceKm: max, price }).subscribe({
        next: () => {
          this.loadTiers();
          this.cancelEdit();
          this.isSaving = false;
        },
        error: (err) => {
          this.errorMessage = err.error?.error || 'שגיאה בעדכון הטווח';
          this.isSaving = false;
        }
      });
    } else {
      this.adminDelivery.createPricing({ minDistanceKm: min, maxDistanceKm: max, price }).subscribe({
        next: () => {
          this.loadTiers();
          this.form.reset({ minDistanceKm: 0, maxDistanceKm: 15, price: 50 });
          this.isSaving = false;
        },
        error: (err) => {
          this.errorMessage = err.error?.error || 'שגיאה בהוספת הטווח';
          this.isSaving = false;
        }
      });
    }
  }

  editTier(tier: DeliveryPricingTier): void {
    this.editingId = tier._id;
    this.form.patchValue({
      minDistanceKm: tier.minDistanceKm,
      maxDistanceKm: tier.maxDistanceKm,
      price: tier.price
    });
  }

  cancelEdit(): void {
    this.editingId = null;
    this.form.reset({ minDistanceKm: 0, maxDistanceKm: 15, price: 50 });
  }

  deleteTier(tier: DeliveryPricingTier): void {
    if (!confirm('האם אתה בטוח שברצונך למחוק טווח זה?')) return;
    this.adminDelivery.deletePricing(tier._id).subscribe({
      next: () => this.loadTiers(),
      error: (err) => {
        this.errorMessage = err.error?.error || 'שגיאה במחיקת הטווח';
      }
    });
  }
}
