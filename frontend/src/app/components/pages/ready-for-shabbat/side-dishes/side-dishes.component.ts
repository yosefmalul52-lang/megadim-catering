import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MenuService, MenuItem } from '../../../../services/menu.service';
import { CartService } from '../../../../services/cart.service';

@Component({
  selector: 'app-side-dishes',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './side-dishes.component.html',
  styleUrls: ['./side-dishes.component.scss']
})
export class SideDishesComponent implements OnInit {
  sideDishes: MenuItem[] = [];
  isLoading = true;
  selectedOptions: { [key: string]: number } = {};
  selectedVariants: { [key: string]: number } = {};
  validationErrors: { [key: string]: boolean } = {};

  constructor(
    private menuService: MenuService,
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.menuService.getProductsByCategory('sides').subscribe({
      next: (items) => {
        this.sideDishes = items;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading sides:', err);
        this.isLoading = false;
      }
    });
  }

  hasPricingOptions(item: MenuItem): boolean {
    return !!(item.pricingOptions && item.pricingOptions.length > 0);
  }

  getPricingOptions(item: MenuItem): any[] {
    return item.pricingOptions || [];
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

  hasPricingVariants(item: MenuItem): boolean {
    return !!(item.pricingVariants && item.pricingVariants.length > 0);
  }

  getPricingVariants(item: MenuItem): any[] {
    return item.pricingVariants || [];
  }

  selectVariant(itemId: string, variantIndex: number): void {
    this.selectedVariants[itemId] = variantIndex;
    this.validationErrors[itemId] = false;
  }

  getSelectedVariantIndex(itemId: string): number {
    return this.selectedVariants[itemId] ?? -1;
  }

  hasSelectedOption(item: MenuItem): boolean {
    const itemId = item.id || item._id || '';
    if (this.hasPricingOptions(item)) return this.getSelectedOptionIndex(itemId) >= 0;
    if (this.hasPricingVariants(item)) return this.getSelectedVariantIndex(itemId) >= 0;
    return item.price != null || item.pricePer100g != null;
  }

  getSelectedPrice(item: MenuItem): number {
    const itemId = item.id || item._id || '';
    if (this.hasPricingOptions(item)) {
      const idx = this.getSelectedOptionIndex(itemId);
      if (idx >= 0) return this.getPricingOptions(item)[idx]?.price ?? 0;
    }
    if (this.hasPricingVariants(item)) {
      const idx = this.getSelectedVariantIndex(itemId);
      if (idx >= 0) return this.getPricingVariants(item)[idx]?.price ?? 0;
    }
    return this.getPrice(item);
  }

  hasValidationError(itemId: string): boolean {
    return this.validationErrors[itemId] === true;
  }

  isAvailable(item: MenuItem): boolean {
    return item.isAvailable !== false;
  }

  addToCart(item: MenuItem): void {
    if (!this.isAvailable(item)) return;

    const itemId = (item.id || item._id || '').toString();
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

    if (this.hasPricingOptions(item)) {
      const optionIndex = this.getSelectedOptionIndex(itemId);
      const options = this.getPricingOptions(item);
      if (optionIndex >= 0 && options[optionIndex]) {
        const opt = options[optionIndex];
        itemName = `${item.name} (${opt.label} - ${opt.amount})`;
        price = opt.price;
        cartLineId = `${itemId}-size-${optionIndex}`;
      }
    } else if (this.hasPricingVariants(item)) {
      const variantIndex = this.getSelectedVariantIndex(itemId);
      const variants = this.getPricingVariants(item);
      if (variantIndex >= 0 && variants[variantIndex]) {
        const v = variants[variantIndex];
        itemName = `${item.name} (${v.label})`;
        price = v.price;
        cartLineId = `${itemId}-size-${variantIndex}`;
      }
    }

    this.cartService.addToCart(
      {
        id: cartLineId,
        name: itemName,
        price,
        imageUrl: item.imageUrl ?? '',
        description: item.description,
        category: item.category || 'sides'
      },
      1
    );
    this.cartService.openCart();
  }

  viewDetails(item: MenuItem): void {
    const id = item.id || item._id;
    if (id) this.router.navigate(['/ready-for-shabbat/sides', id]);
  }

  getPrice(item: MenuItem): number {
    return item.price ?? item.pricePer100g ?? (item.pricingOptions?.[0]?.price) ?? 0;
  }
}
