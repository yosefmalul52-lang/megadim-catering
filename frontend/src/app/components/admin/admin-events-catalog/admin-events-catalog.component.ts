import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  EventsCatalogDto,
  EventsCatalogService,
  EventsReceptionTierDto,
  ShabbatCatalogDto
} from '../../../services/events-catalog.service';

type CatalogTab = 'events' | 'shabbat';
type DishListKey = 'saladOptions' | 'firstCourseOptions' | 'mainCourseOptions' | 'sideDishOptions';

@Component({
  selector: 'app-admin-events-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-events-catalog.component.html',
  styleUrls: ['./admin-events-catalog.component.scss']
})
export class AdminEventsCatalogComponent implements OnInit {
  private catalogService = inject(EventsCatalogService);

  activeTab: CatalogTab = 'events';
  eventsCatalog: EventsCatalogDto | null = null;
  shabbatCatalog: ShabbatCatalogDto | null = null;
  isLoading = true;
  isSaving = false;
  errorMessage = '';
  successMessage = '';

  eventsBaseIncludes: string[] = [];
  eventsBaseRemovePick: number | null = null;
  eventsDraft: Record<DishListKey | 'baseIncludes', string> = {
    baseIncludes: '',
    saladOptions: '',
    firstCourseOptions: '',
    mainCourseOptions: '',
    sideDishOptions: ''
  };
  eventsRemovePick: Record<DishListKey, number | null> = {
    saladOptions: null,
    firstCourseOptions: null,
    mainCourseOptions: null,
    sideDishOptions: null
  };
  shabbatDraft: Record<DishListKey, string> = {
    saladOptions: '',
    firstCourseOptions: '',
    mainCourseOptions: '',
    sideDishOptions: ''
  };
  shabbatRemovePick: Record<DishListKey, number | null> = {
    saladOptions: null,
    firstCourseOptions: null,
    mainCourseOptions: null,
    sideDishOptions: null
  };

  readonly eventsDishLists: Array<{ key: DishListKey; label: string }> = [
    { key: 'saladOptions', label: 'סלטים' },
    { key: 'firstCourseOptions', label: 'מנות ראשונות' },
    { key: 'mainCourseOptions', label: 'עיקריות' },
    { key: 'sideDishOptions', label: 'תוספות' }
  ];

  readonly shabbatDishLists: Array<{ key: DishListKey; label: string }> = [
    { key: 'saladOptions', label: 'סלטים' },
    { key: 'firstCourseOptions', label: 'מנות ראשונות' },
    { key: 'mainCourseOptions', label: 'עיקריות' },
    { key: 'sideDishOptions', label: 'תוספות' }
  ];

  ngOnInit(): void {
    this.loadActiveTab();
  }

  setTab(tab: CatalogTab): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.errorMessage = '';
    this.successMessage = '';
    this.loadActiveTab();
  }

  loadActiveTab(): void {
    this.isLoading = true;
    this.errorMessage = '';
    if (this.activeTab === 'events') {
      this.catalogService.getAdminCatalog().subscribe({
        next: (catalog) => {
          this.eventsCatalog = {
            ...catalog,
            baseIncludes: [...(catalog.baseIncludes || [])],
            saladOptions: [...(catalog.saladOptions || [])],
            firstCourseOptions: [...(catalog.firstCourseOptions || [])],
            mainCourseOptions: [...(catalog.mainCourseOptions || [])],
            sideDishOptions: [...(catalog.sideDishOptions || [])],
            receptionTiers: (catalog.receptionTiers || []).map((t) => ({ ...t }))
          };
          this.eventsBaseIncludes = [...this.eventsCatalog.baseIncludes];
          this.clearDrafts('events');
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err?.error?.message || 'שגיאה בטעינת קטלוג האירועים';
        }
      });
      return;
    }

    this.catalogService.getAdminShabbatCatalog().subscribe({
      next: (catalog) => {
        this.shabbatCatalog = {
          ...catalog,
          saladOptions: [...(catalog.saladOptions || [])],
          firstCourseOptions: [...(catalog.firstCourseOptions || [])],
          mainCourseOptions: [...(catalog.mainCourseOptions || [])],
          sideDishOptions: [...(catalog.sideDishOptions || [])]
        };
        this.clearDrafts('shabbat');
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || 'שגיאה בטעינת קטלוג שבת וחג';
      }
    });
  }

  private clearDrafts(tab: CatalogTab): void {
    if (tab === 'events') {
      this.eventsDraft = {
        baseIncludes: '',
        saladOptions: '',
        firstCourseOptions: '',
        mainCourseOptions: '',
        sideDishOptions: ''
      };
      this.eventsBaseRemovePick = null;
      this.eventsRemovePick = {
        saladOptions: null,
        firstCourseOptions: null,
        mainCourseOptions: null,
        sideDishOptions: null
      };
      return;
    }
    this.shabbatDraft = {
      saladOptions: '',
      firstCourseOptions: '',
      mainCourseOptions: '',
      sideDishOptions: ''
    };
    this.shabbatRemovePick = {
      saladOptions: null,
      firstCourseOptions: null,
      mainCourseOptions: null,
      sideDishOptions: null
    };
  }

  getEventsList(key: DishListKey): string[] {
    return this.eventsCatalog?.[key] || [];
  }

  getShabbatList(key: DishListKey): string[] {
    return this.shabbatCatalog?.[key] || [];
  }

  addToList(list: string[], draftKey: string, drafts: Record<string, string>): void {
    const name = String(drafts[draftKey] || '').trim();
    if (!name) return;
    const exists = list.some((item) => item.trim().toLowerCase() === name.toLowerCase());
    if (exists) {
      this.errorMessage = `"${name}" כבר קיים ברשימה`;
      setTimeout(() => (this.errorMessage = ''), 2500);
      drafts[draftKey] = '';
      return;
    }
    list.push(name);
    drafts[draftKey] = '';
  }

  removeFromList(list: string[], index: number): void {
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
  }

  addEventsBaseInclude(): void {
    this.addToList(this.eventsBaseIncludes, 'baseIncludes', this.eventsDraft);
  }

  removeEventsBaseInclude(): void {
    if (this.eventsBaseRemovePick === null || this.eventsBaseRemovePick === undefined) return;
    this.removeFromList(this.eventsBaseIncludes, this.eventsBaseRemovePick);
    this.eventsBaseRemovePick = null;
  }

  addEventsDish(key: DishListKey): void {
    if (!this.eventsCatalog) return;
    this.addToList(this.eventsCatalog[key], key, this.eventsDraft);
  }

  removeEventsDish(key: DishListKey): void {
    const index = this.eventsRemovePick[key];
    if (index === null || index === undefined || !this.eventsCatalog) return;
    this.removeFromList(this.eventsCatalog[key], index);
    this.eventsRemovePick[key] = null;
  }

  addShabbatDish(key: DishListKey): void {
    if (!this.shabbatCatalog) return;
    this.addToList(this.shabbatCatalog[key], key, this.shabbatDraft);
  }

  removeShabbatDish(key: DishListKey): void {
    const index = this.shabbatRemovePick[key];
    if (index === null || index === undefined || !this.shabbatCatalog) return;
    this.removeFromList(this.shabbatCatalog[key], index);
    this.shabbatRemovePick[key] = null;
  }

  onDraftEnter(
    event: Event,
    list: string[],
    draftKey: string,
    drafts: Record<string, string>
  ): void {
    event.preventDefault();
    this.addToList(list, draftKey, drafts);
  }

  save(): void {
    if (this.isSaving) return;
    if (this.activeTab === 'events') {
      this.saveEvents();
    } else {
      this.saveShabbat();
    }
  }

  private saveEvents(): void {
    if (!this.eventsCatalog) return;
    this.isSaving = true;
    this.errorMessage = '';
    const payload: EventsCatalogDto = {
      ...this.eventsCatalog,
      baseIncludes: [...this.eventsBaseIncludes],
      saladOptions: [...(this.eventsCatalog.saladOptions || [])],
      firstCourseOptions: [...(this.eventsCatalog.firstCourseOptions || [])],
      mainCourseOptions: [...(this.eventsCatalog.mainCourseOptions || [])],
      sideDishOptions: [...(this.eventsCatalog.sideDishOptions || [])],
      receptionTiers: (this.eventsCatalog.receptionTiers || []).map((t) => ({ ...t }))
    };
    this.catalogService.saveAdminCatalog(payload).subscribe({
      next: (catalog) => {
        this.eventsCatalog = {
          ...catalog,
          baseIncludes: [...(catalog.baseIncludes || [])],
          saladOptions: [...(catalog.saladOptions || [])],
          firstCourseOptions: [...(catalog.firstCourseOptions || [])],
          mainCourseOptions: [...(catalog.mainCourseOptions || [])],
          sideDishOptions: [...(catalog.sideDishOptions || [])],
          receptionTiers: (catalog.receptionTiers || []).map((t) => ({ ...t }))
        };
        this.eventsBaseIncludes = [...this.eventsCatalog.baseIncludes];
        this.clearDrafts('events');
        this.isSaving = false;
        this.successMessage = 'קטלוג אירועים נשמר';
        setTimeout(() => (this.successMessage = ''), 3000);
      },
      error: (err) => {
        this.isSaving = false;
        this.errorMessage = err?.error?.message || 'שגיאה בשמירת קטלוג האירועים';
      }
    });
  }

  private saveShabbat(): void {
    if (!this.shabbatCatalog) return;
    this.isSaving = true;
    this.errorMessage = '';
    const payload: ShabbatCatalogDto = {
      ...this.shabbatCatalog,
      saladOptions: [...(this.shabbatCatalog.saladOptions || [])],
      firstCourseOptions: [...(this.shabbatCatalog.firstCourseOptions || [])],
      mainCourseOptions: [...(this.shabbatCatalog.mainCourseOptions || [])],
      sideDishOptions: [...(this.shabbatCatalog.sideDishOptions || [])]
    };
    this.catalogService.saveAdminShabbatCatalog(payload).subscribe({
      next: (catalog) => {
        this.shabbatCatalog = {
          ...catalog,
          saladOptions: [...(catalog.saladOptions || [])],
          firstCourseOptions: [...(catalog.firstCourseOptions || [])],
          mainCourseOptions: [...(catalog.mainCourseOptions || [])],
          sideDishOptions: [...(catalog.sideDishOptions || [])]
        };
        this.clearDrafts('shabbat');
        this.isSaving = false;
        this.successMessage = 'קטלוג שבת וחג נשמר';
        setTimeout(() => (this.successMessage = ''), 3000);
      },
      error: (err) => {
        this.isSaving = false;
        this.errorMessage = err?.error?.message || 'שגיאה בשמירת קטלוג שבת וחג';
      }
    });
  }

  trackTier(_i: number, tier: EventsReceptionTierDto): string {
    return tier.id;
  }

  trackItem(index: number, item: string): string {
    return `${index}-${item}`;
  }
}
