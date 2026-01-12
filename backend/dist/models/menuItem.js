"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
// Price Variant Schema (for size-based pricing) - Legacy support
const PriceVariantSchema = new mongoose_1.Schema({
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
const PricingOptionSchema = new mongoose_1.Schema({
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
const RecipeIngredientSchema = new mongoose_1.Schema({
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
// MenuItem Schema for catering menu items
const MenuItemSchema = new mongoose_1.Schema({
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
MenuItemSchema.pre('save', function () {
    return __awaiter(this, void 0, void 0, function* () {
        const hasPrice = this.price !== undefined && this.price !== null;
        const hasVariants = this.pricingVariants && this.pricingVariants.length > 0;
        const hasOptions = this.pricingOptions && this.pricingOptions.length > 0;
        if (!hasPrice && !hasVariants && !hasOptions) {
            throw new Error('Either price, pricingVariants, or pricingOptions must be provided');
        }
        // No next() call needed for async functions
    });
});
// Create indexes for better query performance
MenuItemSchema.index({ category: 1 });
MenuItemSchema.index({ isPopular: 1 });
MenuItemSchema.index({ name: 'text' }); // Text search index
// Export the model with OverwriteModelError prevention
// Check if model already exists before creating a new one
exports.default = mongoose_1.default.models.MenuItem ||
    mongoose_1.default.model('MenuItem', MenuItemSchema);
