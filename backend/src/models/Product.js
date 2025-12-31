const mongoose = require('mongoose');

// Price Variant Schema (for size-based pricing)
const PriceVariantSchema = new mongoose.Schema({
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

// Nutrition Info Schema
const NutritionInfoSchema = new mongoose.Schema({
  calories: {
    type: Number,
    required: false,
    min: 0
  },
  protein: {
    type: Number,
    required: false,
    min: 0
  },
  carbs: {
    type: Number,
    required: false,
    min: 0
  },
  fat: {
    type: Number,
    required: false,
    min: 0
  }
}, { _id: false });

// Product Schema
const ProductSchema = new mongoose.Schema({
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
    required: true,
    trim: true
  },
  // Optional single price for backward compatibility or fixed-price items
  price: {
    type: Number,
    required: false,
    min: 0
  },
  // Array of pricing variants (e.g., 250g: ₪17, 500g: ₪29)
  pricingVariants: {
    type: [PriceVariantSchema],
    required: false,
    default: undefined
  },
  imageUrl: {
    type: String,
    required: true,
    trim: true
  },
  tags: {
    type: [String],
    required: false,
    default: []
  },
  isAvailable: {
    type: Boolean,
    required: false,
    default: true,
    index: true
  },
  isPopular: {
    type: Boolean,
    required: false,
    default: false,
    index: true
  },
  servingSize: {
    type: String,
    required: false,
    trim: true
  },
  ingredients: {
    type: [String],
    required: false,
    default: []
  },
  allergens: {
    type: [String],
    required: false,
    default: []
  },
  nutritionInfo: {
    type: NutritionInfoSchema,
    required: false
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  collection: 'products'
});

// Indexes for better query performance
ProductSchema.index({ category: 1, isAvailable: 1 });
ProductSchema.index({ isPopular: 1, isAvailable: 1 });
ProductSchema.index({ name: 'text', description: 'text' }); // Text search index

// Validation: Ensure either price or pricingVariants is provided
ProductSchema.pre('validate', function(next) {
  const hasPrice = this.price !== undefined && this.price !== null;
  const hasVariants = this.pricingVariants && this.pricingVariants.length > 0;
  
  if (!hasPrice && !hasVariants) {
    return next(new Error('Either price or pricingVariants must be provided'));
  }
  
  next();
});

// Method to get the effective price (for backward compatibility)
ProductSchema.methods.getEffectivePrice = function() {
  if (this.price !== undefined && this.price !== null) {
    return this.price;
  }
  if (this.pricingVariants && this.pricingVariants.length > 0) {
    // Return the first variant's price as default
    return this.pricingVariants[0].price;
  }
  return null;
};

// Static method to find available products
ProductSchema.statics.findAvailable = function() {
  return this.find({ isAvailable: true });
};

// Static method to find popular products
ProductSchema.statics.findPopular = function(limit = 6) {
  return this.find({ isPopular: true, isAvailable: true }).limit(limit);
};

// Static method to find by category
ProductSchema.statics.findByCategory = function(category) {
  return this.find({ category: category, isAvailable: true });
};

// Export the model
const Product = mongoose.model('Product', ProductSchema);

module.exports = Product;

