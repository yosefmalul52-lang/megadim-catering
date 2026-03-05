import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ShippingService,
  ShippingGlobalSettings,
  DeliveryCityOverride,
  DeliveryPricingTier
} from '../../../services/shipping.service';

@Component({
  selector: 'app-shipping-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shipping-management.component.html',
  styleUrls: ['./shipping-management.component.scss']
})
export class ShippingManagementComponent implements OnInit {
  private shipping = inject(ShippingService);

  global: ShippingGlobalSettings = {
    freeShippingThreshold: 500,
    isFreeShippingActive: false,
    baseDeliveryFee: 25,
    pricePerKm: 3
  };
  globalSaving = false;
  globalSaveError = '';

  tiers: DeliveryPricingTier[] = [];
  tiersLoading = false;
  showTierModal = false;
  editingTier: DeliveryPricingTier | null = null;
  tierForm = { minKm: 0, maxKm: 10, price: 50 };
  tierSaving = false;
  tierError = '';

  cities: DeliveryCityOverride[] = [];
  citiesLoading = false;
  citySearch = '';

  get filteredCities(): DeliveryCityOverride[] {
    const q = (this.citySearch || '').trim().toLowerCase();
    if (!q) return this.cities;
    return this.cities.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) || c.cityName.toLowerCase().includes(q)
    );
  }

  showAddModal = false;
  newCityName = '';
  newCityPrice = 30;
  addSaving = false;
  addError = '';

  testAddress = '';
  testCartTotal = 0;
  testLoading = false;
  testError: string | null = null;
  testResult: {
    price: number;
    distance: number;
    isFree?: boolean;
    originalPrice?: number;
    outOfArea?: boolean;
  } | null = null;

  private dirtyIds = new Set<string>();

  ngOnInit(): void {
    this.loadSettings();
    this.loadTiers();
    this.loadCities();
  }

  loadSettings(): void {
    this.shipping.getGlobalSettings().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.global = {
            ...this.global,
            freeShippingThreshold: res.data.freeShippingThreshold ?? 500,
            isFreeShippingActive: !!res.data.isFreeShippingActive
          };
        }
      },
      error: () => {}
    });
  }

  saveGlobal(): void {
    this.globalSaveError = '';
    this.globalSaving = true;
    this.shipping
      .updateGlobalSettings({
        freeShippingThreshold: this.global.freeShippingThreshold,
        isFreeShippingActive: this.global.isFreeShippingActive
      })
      .subscribe({
        next: () => (this.globalSaving = false),
        error: (err) => {
          this.globalSaveError = err.error?.error || 'שגיאה בשמירה';
          this.globalSaving = false;
        }
      });
  }

  loadTiers(): void {
    this.tiersLoading = true;
    this.shipping.getPricingTiers().subscribe({
      next: (list) => {
        this.tiers = list;
        this.tiersLoading = false;
      },
      error: () => (this.tiersLoading = false)
    });
  }

  openAddTier(): void {
    this.editingTier = null;
    this.tierForm = { minKm: 0, maxKm: 10, price: 50 };
    this.tierError = '';
    this.showTierModal = true;
  }

  openEditTier(tier: DeliveryPricingTier): void {
    this.editingTier = tier;
    this.tierForm = {
      minKm: tier.minDistanceKm,
      maxKm: tier.maxDistanceKm,
      price: tier.price
    };
    this.tierError = '';
    this.showTierModal = true;
  }

  closeTierModal(): void {
    this.showTierModal = false;
    this.editingTier = null;
  }

  submitTier(): void {
    const { minKm, maxKm, price } = this.tierForm;
    if (minKm > maxKm) {
      this.tierError = 'מינימום ק״מ חייב להיות קטן או שווה למקסימום';
      return;
    }
    this.tierError = '';
    this.tierSaving = true;
    const body = { minDistanceKm: minKm, maxDistanceKm: maxKm, price };
    if (this.editingTier) {
      this.shipping.updatePricingTier(this.editingTier._id, body).subscribe({
        next: () => {
          this.loadTiers();
          this.closeTierModal();
          this.tierSaving = false;
        },
        error: (err) => {
          this.tierError = err.error?.error || 'שגיאה בשמירה';
          this.tierSaving = false;
        }
      });
    } else {
      this.shipping.createPricingTier(body).subscribe({
        next: () => {
          this.loadTiers();
          this.closeTierModal();
          this.tierSaving = false;
        },
        error: (err) => {
          this.tierError = err.error?.error || 'שגיאה בהוספה';
          this.tierSaving = false;
        }
      });
    }
  }

  deleteTier(tier: DeliveryPricingTier): void {
    if (!window.confirm(`למחוק טווח ${tier.minDistanceKm}-${tier.maxDistanceKm} ק״מ?`)) return;
    this.shipping.deletePricingTier(tier._id).subscribe({
      next: () => this.loadTiers(),
      error: () => {}
    });
  }

  loadCities(): void {
    this.citiesLoading = true;
    this.shipping.getCityOverrides().subscribe({
      next: (list) => {
        this.cities = list;
        this.citiesLoading = false;
      },
      error: () => (this.citiesLoading = false)
    });
  }

  openAddCity(): void {
    this.showAddModal = true;
    this.newCityName = '';
    this.newCityPrice = 30;
    this.addError = '';
  }

  closeAddCity(): void {
    this.showAddModal = false;
  }

  submitAddCity(): void {
    const name = (this.newCityName || '').trim();
    if (!name) return;
    this.addError = '';
    this.addSaving = true;
    this.shipping.createCityOverride(name, this.newCityPrice).subscribe({
      next: () => {
        this.loadCities();
        this.closeAddCity();
        this.addSaving = false;
      },
      error: (err) => {
        this.addError = err.error?.error || 'שגיאה בהוספה';
        this.addSaving = false;
      }
    });
  }

  markDirty(city: DeliveryCityOverride): void {
    this.dirtyIds.add(city._id);
  }

  isDirty(city: DeliveryCityOverride): boolean {
    return this.dirtyIds.has(city._id);
  }

  saveCity(city: DeliveryCityOverride): void {
    this.shipping.updateCityOverride(city._id, { overridePrice: city.overridePrice }).subscribe({
      next: () => {
        this.dirtyIds.delete(city._id);
        this.loadCities();
      },
      error: () => {}
    });
  }

  toggleCityActive(city: DeliveryCityOverride): void {
    const next = !city.isActive;
    this.shipping.updateCityOverride(city._id, { isActive: next }).subscribe({
      next: () => {
        city.isActive = next;
      },
      error: () => {}
    });
  }

  deleteCity(city: DeliveryCityOverride): void {
    if (!window.confirm('למחוק את העיר "' + city.displayName + '"?')) return;
    this.shipping.deleteCityOverride(city._id).subscribe({
      next: () => this.loadCities(),
      error: () => {}
    });
  }

  runTest(): void {
    const addr = (this.testAddress || '').trim();
    if (!addr) return;
    this.testError = null;
    this.testResult = null;
    this.testLoading = true;
    const cartTotal = Number(this.testCartTotal) || 0;
    this.shipping.calculateFee(addr, cartTotal).subscribe({
      next: (res) => {
        this.testResult = {
          price: res.price,
          distance: res.distance,
          isFree: res.isFree,
          originalPrice: res.originalPrice,
          outOfArea: false
        };
        this.testLoading = false;
      },
      error: (err) => {
        const msg = err.error?.error || err.message || 'שגיאה בחישוב';
        if (msg.includes('מחוץ לאזור') || err.status === 400) {
          this.testResult = {
            price: 0,
            distance: 0,
            outOfArea: true
          };
        } else {
          this.testError = msg;
        }
        this.testLoading = false;
      }
    });
  }
}
