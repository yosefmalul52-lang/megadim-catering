import mongoose, { Schema, Model, Document } from 'mongoose';

// Price Variant Schema (for size-based pricing) - Legacy support
const PriceVariantSchema = new Schema({
  size: {
    type: String,
    required: true,
    trim: true
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  weight: {
    type: Number,
    required: false,
    min: 0
  }
}, { _id: false });

// Pricing Options Schema (new structure: label, price, amount)
const PricingOptionSchema = new Schema({
  label: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  amount: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: false });

// Recipe Ingredient Schema (for procurement calculation)
const RecipeIngredientSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    trim: true // e.g., 'kg', 'g', 'bunch', 'piece', 'liter', 'ml'
  },
  category: {
    type: String,
    required: true,
    trim: true // e.g., 'Fish', 'Meat', 'Vegetables', 'Dry Goods', 'Spices'
  }
}, { _id: false });

// MenuItem Interface
export interface IMenuItem extends Document {
  name: string;
  category: string;
  description?: string;
  price?: number;
  pricePer100g?: number;
  pricingVariants?: Array<{
    size: string;
    label: string;
    price: number;
    weight?: number;
  }>;
  pricingOptions?: Array<{
    label: string;
    price: number;
    amount: string;
  }>;
  imageUrl?: string;
  tags: string[];
  isAvailable: boolean;
  isPopular: boolean;
  isFeatured: boolean;
  servingSize?: string;
  recipe?: Array<{
    name: string;
    quantity: number;
    unit: string;
    category: string;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}

// MenuItem Schema for catering menu items
const MenuItemSchema = new Schema<IMenuItem>({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  category: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  // Optional single price for backward compatibility or fixed-price items
  price: {
    type: Number,
    required: false,
    min: 0
  },
  // Price per 100g (for admin-controlled display)
  pricePer100g: {
    type: Number,
    required: false,
    min: 0
  },
  // Array of pricing variants (e.g., 250g: ₪17, 500g: ₪29) - Legacy support
  pricingVariants: {
    type: [PriceVariantSchema],
    required: false,
    default: undefined
  },
  // Array of pricing options (e.g., { label: 'Small Tray', price: 150, amount: '10 people' })
  pricingOptions: {
    type: [PricingOptionSchema],
    required: false,
    default: undefined
  },
  imageUrl: {
    type: String,
    trim: true
  },
  tags: {
    type: [String],
    default: []
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  servingSize: {
    type: String,
    trim: true
  },
  // Recipe: Array of ingredients needed to make this dish
  recipe: {
    type: [RecipeIngredientSchema],
    required: false,
    default: []
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
  collection: 'menuitems'
});

// Pre-save validation: Ensure either price, pricingVariants, or pricingOptions is provided
// Using async function - no next parameter needed
MenuItemSchema.pre('save', async function() {
  const hasPrice = this.price !== undefined && this.price !== null;
  const hasVariants = this.pricingVariants && this.pricingVariants.length > 0;
  const hasOptions = this.pricingOptions && this.pricingOptions.length > 0;
  
  if (!hasPrice && !hasVariants && !hasOptions) {
    throw new Error('Either price, pricingVariants, or pricingOptions must be provided');
  }
  
  // No next() call needed for async functions
});

// Create indexes for better query performance
MenuItemSchema.index({ category: 1 });
MenuItemSchema.index({ isPopular: 1 });
MenuItemSchema.index({ name: 'text' }); // Text search index

// Export the model with OverwriteModelError prevention
// Check if model already exists before creating a new one
export default (mongoose.models.MenuItem as Model<IMenuItem>) || 
  mongoose.model<IMenuItem>('MenuItem', MenuItemSchema);

