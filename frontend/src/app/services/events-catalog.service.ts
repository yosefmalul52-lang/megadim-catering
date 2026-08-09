import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EventsReceptionTierDto {
  id: 'regular' | 'upgraded';
  backendId: 'standard' | 'premium';
  title: string;
  pricePerPortion: number;
  stations: number;
  features: string[];
}

export interface EventsCatalogDto {
  basePrice: number;
  baseTitle: string;
  baseIncludes: string[];
  firstCourseUpgradePrice: number;
  firstCourseUpgradeTitle: string;
  dessertsUpgradePrice: number;
  dessertsUpgradeTitle: string;
  kosherUpgradePrice: number;
  receptionTiers: EventsReceptionTierDto[];
  saladOptions: string[];
  firstCourseOptions: string[];
  mainCourseOptions: string[];
  sideDishOptions: string[];
  saladSlotCount: number;
  mainCourseSlotCount: number;
  sideSlotCount: number;
  firstCourseSlotCount: number;
  updatedAt?: string | null;
}

export interface ShabbatCatalogDto {
  singleMealPrice: number;
  bothMealsPrice: number;
  firstCourseUpgradePrice: number;
  seudaShlishitPrice: number;
  fishUpgradePrice: number;
  dessertsPrice: number;
  kosherUpgradePrice: number;
  saladOptions: string[];
  firstCourseOptions: string[];
  mainCourseOptions: string[];
  sideDishOptions: string[];
  saladSlotCount: number;
  saladMinCount: number;
  saladMaxCount: number;
  firstCourseSlotCount: number;
  mainCourseSlotCount: number;
  sideSlotCount: number;
  updatedAt?: string | null;
}

@Injectable({ providedIn: 'root' })
export class EventsCatalogService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/events-catalog`;

  getPublicCatalog(): Observable<EventsCatalogDto> {
    return this.http
      .get<{ success?: boolean; catalog: EventsCatalogDto }>(`${this.apiUrl}/public`)
      .pipe(map((res) => res.catalog));
  }

  getAdminCatalog(): Observable<EventsCatalogDto> {
    return this.http
      .get<{ success?: boolean; catalog: EventsCatalogDto }>(this.apiUrl)
      .pipe(map((res) => res.catalog));
  }

  saveAdminCatalog(catalog: Partial<EventsCatalogDto>): Observable<EventsCatalogDto> {
    return this.http
      .put<{ success?: boolean; catalog: EventsCatalogDto }>(this.apiUrl, catalog)
      .pipe(map((res) => res.catalog));
  }

  getPublicShabbatCatalog(): Observable<ShabbatCatalogDto> {
    return this.http
      .get<{ success?: boolean; catalog: ShabbatCatalogDto }>(`${this.apiUrl}/shabbat/public`)
      .pipe(map((res) => res.catalog));
  }

  getAdminShabbatCatalog(): Observable<ShabbatCatalogDto> {
    return this.http
      .get<{ success?: boolean; catalog: ShabbatCatalogDto }>(`${this.apiUrl}/shabbat`)
      .pipe(map((res) => res.catalog));
  }

  saveAdminShabbatCatalog(catalog: Partial<ShabbatCatalogDto>): Observable<ShabbatCatalogDto> {
    return this.http
      .put<{ success?: boolean; catalog: ShabbatCatalogDto }>(`${this.apiUrl}/shabbat`, catalog)
      .pipe(map((res) => res.catalog));
  }
}
