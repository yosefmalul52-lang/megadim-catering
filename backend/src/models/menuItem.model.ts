export interface PriceVariant {
  size: string;  // e.g., "250g", "500g", "small", "large"
  label: string; // e.g., "250 גרם", "500 גרם"
  price: number;
  weight?: number; // Optional: weight in grams for sorting
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  description: string;
  price?: number; // Optional: for backward compatibility or fixed-price items
  pricePer100g?: number; // Optional: price per 100 grams (for admin-controlled display)
  pricingVariants?: PriceVariant[]; // Array of size/price variants
  imageUrl: string;
  tags: string[];
  isAvailable?: boolean;
  isPopular?: boolean;
  isFeatured?: boolean; // Optional: Show in Featured section on homepage
  servingSize?: string;
  ingredients?: string[];
  allergens?: string[];
  nutritionInfo?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateMenuItemRequest {
  name: string;
  category: string;
  description: string;
  price?: number; // Optional: for backward compatibility or fixed-price items
  pricePer100g?: number; // Optional: price per 100 grams (for admin-controlled display)
  pricingVariants?: PriceVariant[]; // Array of size/price variants
  imageUrl: string;
  tags: string[];
  isAvailable?: boolean;
  isPopular?: boolean;
  isFeatured?: boolean; // Optional: Show in Featured section on homepage
  servingSize?: string;
  ingredients?: string[];
  allergens?: string[];
  nutritionInfo?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
}

export interface UpdateMenuItemRequest {
  name?: string;
  category?: string;
  description?: string;
  price?: number; // Optional: for backward compatibility or fixed-price items
  pricePer100g?: number; // Optional: price per 100 grams (for admin-controlled display)
  pricingVariants?: PriceVariant[]; // Array of size/price variants
  imageUrl?: string;
  tags?: string[];
  isAvailable?: boolean;
  isPopular?: boolean;
  isFeatured?: boolean; // Optional: Show in Featured section on homepage
  servingSize?: string;
  ingredients?: string[];
  allergens?: string[];
  nutritionInfo?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
}
