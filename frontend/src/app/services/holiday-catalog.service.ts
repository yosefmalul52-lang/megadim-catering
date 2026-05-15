import { Injectable } from '@angular/core';
import { MenuItem } from './menu.service';

/** In-memory catalog for active holiday products (ids: he:eventId:productId). */
@Injectable({
  providedIn: 'root'
})
export class HolidayCatalogService {
  private catalog = new Map<string, MenuItem>();

  setItems(items: MenuItem[]): void {
    this.catalog.clear();
    for (const item of items) {
      const id = (item.id || item._id || '').toString();
      if (id) this.catalog.set(id, item);
    }
  }

  getById(id: string): MenuItem | null {
    return this.catalog.get(id) ?? null;
  }

  clear(): void {
    this.catalog.clear();
  }
}
