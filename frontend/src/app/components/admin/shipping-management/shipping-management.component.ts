import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ShippingService,
  ShippingGlobalSettings,
  DeliveryCityOverride,
  DeliveryPricingTier
} from '../../../services/shipping.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-shipping-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shipping-management.component.html',
  styleUrls: ['./shipping-management.component.scss']
})
export class ShippingManagementComponent implements OnInit {
  private shipping = inject(ShippingService);
  private toast = inject(ToastService);

  global: ShippingGlobalSettings = {
    freeShippingThreshold: 500,
    isFreeShippingActive: false,
    baseDeliveryFee: 25,
    pricePerKm: 3
  };
  saveAllLoading = false;
  saveAllError = '';

  tiers: DeliveryPricingTier[] = [];
  tiersLoading = false;
  showTierModal = false;
  editingTier: DeliveryPricingTier | null = null;
  tierForm = { minKm: 0, maxKm: 10, price: 50, freeShippingThreshold: '' as number | '', minOrderForDelivery: '' as number | '' };
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
    this.loadCities();
  }

  loadSettings(): void {
    this.tiersLoading = true;
    this.shipping.getGlobalSettings().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.global = {
            ...this.global,
            freeShippingThreshold: res.data.freeShippingThreshold ?? 500,
            isFreeShippingActive: !!res.data.isFreeShippingActive,
            baseDeliveryFee: typeof res.data.baseDeliveryFee === 'number' ? res.data.baseDeliveryFee : this.global.baseDeliveryFee,
            pricePerKm: typeof res.data.pricePerKm === 'number' ? res.data.pricePerKm : this.global.pricePerKm,
            openDates: res.data.openDates,
            minimumLeadDays: res.data.minimumLeadDays
          };
          const rawTiers = Array.isArray(res.data.tiers) ? res.data.tiers : [];
          this.tiers = rawTiers.map((t: any) => ({
            _id: t._id != null ? String(t._id) : '',
            minDistanceKm: t.minDistanceKm,
            maxDistanceKm: t.maxDistanceKm,
            price: t.price,
            isActive: t.isActive,
            freeShippingThreshold: t.hasOwnProperty('freeShippingThreshold') && t.freeShippingThreshold != null ? Number(t.freeShippingThreshold) : undefined,
            minOrderForDelivery: t.hasOwnProperty('minOrderForDelivery') && t.minOrderForDelivery != null ? Number(t.minOrderForDelivery) : undefined
          }));
        }
        this.tiersLoading = false;
      },
      error: () => {
        this.tiersLoading = false;
      }
    });
  }

  saveAllChanges(): void {
    this.saveAllError = '';
    this.saveAllLoading = true;
    const payload: ShippingGlobalSettings = {
      ...this.global,
      tiers: this.tiers.map((t) => ({
        ...t,
        freeShippingThreshold:
          t.freeShippingThreshold === null || (t as any).freeShippingThreshold === ''
            ? undefined
            : (t.freeShippingThreshold as any),
        minOrderForDelivery:
          (t as any).minOrderForDelivery === null || (t as any).minOrderForDelivery === ''
            ? undefined
            : (t as any).minOrderForDelivery
      }))
    };
    console.log('Sending payload:', payload);

    this.shipping.saveAllDeliverySettings(payload).subscribe({
      next: (res) => {
        this.saveAllLoading = false;
        if (res?.success && res.data) {
          this.global = {
            ...this.global,
            freeShippingThreshold: res.data.freeShippingThreshold ?? this.global.freeShippingThreshold,
            isFreeShippingActive: !!res.data.isFreeShippingActive,
            baseDeliveryFee: typeof res.data.baseDeliveryFee === 'number' ? res.data.baseDeliveryFee : this.global.baseDeliveryFee,
            pricePerKm: typeof res.data.pricePerKm === 'number' ? res.data.pricePerKm : this.global.pricePerKm,
            openDates: res.data.openDates,
            minimumLeadDays: res.data.minimumLeadDays
          };
          const rawTiers = Array.isArray(res.data.tiers) ? res.data.tiers : [];
          this.tiers = rawTiers.map((t: any) => ({
            _id: t._id != null ? String(t._id) : '',
            minDistanceKm: t.minDistanceKm,
            maxDistanceKm: t.maxDistanceKm,
            price: t.price,
            isActive: t.isActive,
            freeShippingThreshold: t.hasOwnProperty('freeShippingThreshold') && t.freeShippingThreshold != null ? Number(t.freeShippingThreshold) : undefined,
            minOrderForDelivery: t.hasOwnProperty('minOrderForDelivery') && t.minOrderForDelivery != null ? Number(t.minOrderForDelivery) : undefined
          }));
          this.saveAllDirtyCities();
        }
        this.toast.success('כל השינויים נשמרו בהצלחה');
      },
      error: (err) => {
        this.saveAllLoading = false;
        this.saveAllError = err?.error?.error || err?.error?.message || 'שגיאה בשמירת השינויים';
        this.toast.error(this.saveAllError);
      }
    });
  }

  openAddTier(): void {
    this.editingTier = null;
    this.tierForm = { minKm: 0, maxKm: 10, price: 50, freeShippingThreshold: '', minOrderForDelivery: '' };
    this.tierError = '';
    this.showTierModal = true;
  }

  openEditTier(tier: DeliveryPricingTier): void {
    this.editingTier = tier;
    this.tierForm = {
      minKm: tier.minDistanceKm,
      maxKm: tier.maxDistanceKm,
      price: tier.price,
      freeShippingThreshold: typeof tier.freeShippingThreshold === 'number' ? tier.freeShippingThreshold : '',
      minOrderForDelivery: typeof (tier as any).minOrderForDelivery === 'number' ? (tier as any).minOrderForDelivery : ''
    };
    this.tierError = '';
    this.showTierModal = true;
  }

  closeTierModal(): void {
    this.showTierModal = false;
    this.editingTier = null;
  }

  submitTier(): void {
    const { minKm, maxKm, price, freeShippingThreshold, minOrderForDelivery } = this.tierForm;
    if (minKm > maxKm) {
      this.tierError = 'מינימום ק״מ חייב להיות קטן או שווה למקסימום';
      return;
    }
    this.tierError = '';
    const fst =
      freeShippingThreshold === '' || freeShippingThreshold === null || freeShippingThreshold === undefined
        ? undefined
        : Number(freeShippingThreshold);
    if (fst !== undefined && (Number.isNaN(fst) || fst < 0)) {
      this.tierError = 'משלוח חינם מעל (₪) חייב להיות מספר לא שלילי או ריק';
      return;
    }
    const mod =
      minOrderForDelivery === '' || minOrderForDelivery === null || minOrderForDelivery === undefined
        ? undefined
        : Number(minOrderForDelivery);
    if (mod !== undefined && (Number.isNaN(mod) || mod < 0)) {
      this.tierError = 'מינימום הזמנה (₪) חייב להיות מספר לא שלילי או ריק';
      return;
    }

    if (this.editingTier) {
      this.editingTier.minDistanceKm = minKm;
      this.editingTier.maxDistanceKm = maxKm;
      this.editingTier.price = price;
      (this.editingTier as any).freeShippingThreshold = fst;
      (this.editingTier as any).minOrderForDelivery = mod;
    } else {
      // Local-only tier until Save All (backend will replace IDs on save)
      this.tiers = [
        ...this.tiers,
        {
          _id: 'tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2),
          minDistanceKm: minKm,
          maxDistanceKm: maxKm,
          price,
          isActive: true,
          freeShippingThreshold: fst,
          minOrderForDelivery: mod
        } as any
      ].sort((a, b) => a.minDistanceKm - b.minDistanceKm);
    }

    this.closeTierModal();
  }

  deleteTier(tier: DeliveryPricingTier): void {
    if (!window.confirm(`למחוק טווח ${tier.minDistanceKm}-${tier.maxDistanceKm} ק״מ?`)) return;
    this.tiers = this.tiers.filter((t) => t._id !== tier._id);
    this.toast.info('הטווח הוסר מקומית. לחץ "שמור שינויים" כדי לשמור בשרת.');
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
        this.toast.success('עיר חדשה נוספה בהצלחה');
      },
      error: (err) => {
        this.addError = err.error?.error || 'שגיאה בהוספה';
        this.addSaving = false;
        this.toast.error(this.addError);
      }
    });
  }

  markDirty(city: DeliveryCityOverride): void {
    this.dirtyIds.add(city._id);
  }

  /** After main save (global + tiers) succeeds, persist any dirty city overrides. */
  private saveAllDirtyCities(): void {
    const toSave = this.cities.filter((c) => this.dirtyIds.has(c._id));
    if (toSave.length === 0) return;
    toSave.forEach((city) => {
      this.shipping.updateCityOverride(city._id, { overridePrice: city.overridePrice }).subscribe({
        next: () => {
          this.dirtyIds.delete(city._id);
          this.loadCities();
        },
        error: () => {
          this.toast.error('שגיאה בעדכון מחיר העיר: ' + city.displayName);
        }
      });
    });
  }

  isDirty(city: DeliveryCityOverride): boolean {
    return this.dirtyIds.has(city._id);
  }

  saveCity(city: DeliveryCityOverride): void {
    this.shipping.updateCityOverride(city._id, { overridePrice: city.overridePrice }).subscribe({
      next: () => {
        this.dirtyIds.delete(city._id);
        this.loadCities();
        this.toast.success('מחיר העיר עודכן בהצלחה');
      },
      error: (err) => {
        this.toast.error(err.error?.error || 'שגיאה בעדכון מחיר העיר');
      }
    });
  }

  toggleCityActive(city: DeliveryCityOverride): void {
    const next = !city.isActive;
    this.shipping.updateCityOverride(city._id, { isActive: next }).subscribe({
      next: () => {
        city.isActive = next;
        this.toast.success(next ? 'העיר הופעלה למשלוחים' : 'העיר הושבתה ממשלוחים');
      },
      error: (err) => {
        this.toast.error(err.error?.error || 'שגיאה בעדכון סטטוס העיר');
      }
    });
  }

  deleteCity(city: DeliveryCityOverride): void {
    if (!window.confirm('למחוק את העיר "' + city.displayName + '"?')) return;
    this.shipping.deleteCityOverride(city._id).subscribe({
      next: () => {
        this.loadCities();
        this.toast.success('העיר נמחקה בהצלחה');
      },
      error: (err) => {
        this.toast.error(err.error?.error || 'שגיאה במחיקת העיר');
      }
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
