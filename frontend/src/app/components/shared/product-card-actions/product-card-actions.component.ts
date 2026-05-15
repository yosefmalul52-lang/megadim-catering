import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MenuItem } from '../../../services/menu.service';
import { CartService } from '../../../services/cart.service';
import { QuantitySelectorComponent } from '../quantity-selector/quantity-selector.component';

/** Pricing, quantity, and add-to-cart block for unified product cards (sides, holiday, etc.). */
@Component({
  selector: 'app-product-card-actions',
  standalone: true,
  imports: [CommonModule, MatIconModule, QuantitySelectorComponent],
  templateUrl: './product-card-actions.component.html',
  styleUrls: ['./product-card-actions.component.scss']
})
export class ProductCardActionsComponent {
  private cartService = inject(CartService);

  @Input({ required: true }) item!: MenuItem;
  @Input() cartCategory = '';
  @Input() disabled = false;

  selectedOptions: Record<string, number> = {};
  selectedVariants: Record<string, number> = {};
  validationErrors: Record<string, boolean> = {};
  /** Units or 100g steps for fixed-price items without variants */
  fixedQuantities: Record<string, number> = {};

  get itemId(): string {
    return (this.item?.id || this.item?._id || '').toString();
  }

  hasPricingOptions(item: MenuItem = this.item): boolean {
    return !!(item.pricingOptions && item.pricingOptions.length > 0);
  }

  hasPricingVariants(item: MenuItem = this.item): boolean {
    return !!(item.pricingVariants && item.pricingVariants.length > 0);
  }

  isWeightFixed(item: MenuItem = this.item): boolean {
    return (
      !this.hasPricingOptions(item) &&
      !this.hasPricingVariants(item) &&
      item.pricePer100g != null &&
      item.pricePer100g > 0
    );
  }

  isUnitFixed(item: MenuItem = this.item): boolean {
    return (
      !this.hasPricingOptions(item) &&
      !this.hasPricingVariants(item) &&
      item.price != null &&
      item.price > 0 &&
      !this.isWeightFixed(item)
    );
  }

  showQuantitySelector(item: MenuItem = this.item): boolean {
    return this.isWeightFixed(item) || this.isUnitFixed(item);
  }

  getQuantity(item: MenuItem = this.item): number {
    const id = (item.id || item._id || '').toString();
    return this.fixedQuantities[id] ?? 1;
  }

  setQuantity(item: MenuItem, qty: number): void {
    const id = (item.id || item._id || '').toString();
    if (!id) return;
    this.fixedQuantities[id] = Math.max(1, Math.min(99, qty));
  }

  selectPricingOption(itemId: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const optionIndex = parseInt(select.value, 10);
    if (!isNaN(optionIndex)) {
      this.selectedOptions[itemId] = optionIndex;
      this.validationErrors[itemId] = false;
    }
  }

  getSelectedOptionIndex(itemId: string): number {
    return this.selectedOptions[itemId] ?? -1;
  }

  selectVariant(itemId: string, variantIndex: number): void {
    this.selectedVariants[itemId] = variantIndex;
    this.validationErrors[itemId] = false;
  }

  getSelectedVariantIndex(itemId: string): number {
    return this.selectedVariants[itemId] ?? -1;
  }

  hasSelectedOption(item: MenuItem = this.item): boolean {
    const id = (item.id || item._id || '').toString();
    if (this.hasPricingOptions(item)) return this.getSelectedOptionIndex(id) >= 0;
    if (this.hasPricingVariants(item)) return this.getSelectedVariantIndex(id) >= 0;
    return this.isWeightFixed(item) || this.isUnitFixed(item);
  }

  getUnitRate(item: MenuItem = this.item): number {
    if (this.isWeightFixed(item)) return item.pricePer100g ?? 0;
    if (this.isUnitFixed(item)) return item.price ?? 0;
    return this.getBasePrice(item);
  }

  getBasePrice(item: MenuItem = this.item): number {
    return item.price ?? item.pricePer100g ?? item.pricingOptions?.[0]?.price ?? 0;
  }

  getSelectedPrice(item: MenuItem = this.item): number {
    const id = (item.id || item._id || '').toString();
    if (this.hasPricingOptions(item)) {
      const idx = this.getSelectedOptionIndex(id);
      if (idx >= 0) return item.pricingOptions![idx]?.price ?? 0;
    }
    if (this.hasPricingVariants(item)) {
      const idx = this.getSelectedVariantIndex(id);
      if (idx >= 0) return item.pricingVariants![idx]?.price ?? 0;
    }
    return this.getBasePrice(item);
  }

  getLineTotal(item: MenuItem = this.item): number {
    const rate = this.getUnitRate(item);
    const qty = this.getQuantity(item);
    return Math.round(rate * qty * 100) / 100;
  }

  hasValidationError(itemId: string): boolean {
    return this.validationErrors[itemId] === true;
  }

  addToCart(): void {
    if (this.disabled) return;
    const item = this.item;
    const itemId = this.itemId;
    if (!itemId) return;

    const requiresSelection = this.hasPricingOptions(item) || this.hasPricingVariants(item);
    if (requiresSelection && !this.hasSelectedOption(item)) {
      this.validationErrors[itemId] = true;
      return;
    }
    this.validationErrors[itemId] = false;

    let itemName = item.name;
    let price = this.getSelectedPrice(item);
    let cartLineId = itemId;
    let quantity = 1;

    if (this.hasPricingOptions(item)) {
      const optionIndex = this.getSelectedOptionIndex(itemId);
      const options = item.pricingOptions || [];
      if (optionIndex >= 0 && options[optionIndex]) {
        const opt = options[optionIndex];
        itemName = `${item.name} (${opt.label} - ${opt.amount})`;
        price = opt.price;
        cartLineId = `${itemId}-size-${optionIndex}`;
      }
    } else if (this.hasPricingVariants(item)) {
      const variantIndex = this.getSelectedVariantIndex(itemId);
      const variants = item.pricingVariants || [];
      if (variantIndex >= 0 && variants[variantIndex]) {
        const v = variants[variantIndex];
        itemName = `${item.name} (${v.label})`;
        price = v.price;
        cartLineId = `${itemId}-size-${variantIndex}`;
      }
    } else if (this.isWeightFixed(item) || this.isUnitFixed(item)) {
      quantity = this.getQuantity(item);
      price = this.getUnitRate(item);
      if (this.isWeightFixed(item)) {
        itemName = `${item.name} (${quantity * 100} גרם)`;
      }
    }

    if (price <= 0) return;

    this.cartService.addToCart(
      {
        id: cartLineId,
        name: itemName,
        price,
        imageUrl: item.imageUrl ?? '',
        description: item.description,
        category: this.cartCategory || item.category
      },
      quantity
    );
    this.cartService.openCart();
  }
}
