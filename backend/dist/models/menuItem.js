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
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
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
        trim: true
    },
    category: {
        type: String,
        required: true,
        trim: true
    }
}, { _id: false });
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
    price: {
        type: Number,
        required: false,
        min: 0
    },
    pricePer100g: {
        type: Number,
        required: false,
        min: 0
    },
    pricingVariants: {
        type: [PriceVariantSchema],
        required: false,
        default: undefined
    },
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
    recipe: {
        type: [RecipeIngredientSchema],
        required: false,
        default: []
    }
}, {
    timestamps: true,
    collection: 'menuitems'
});
MenuItemSchema.pre('save', async function () {
    const hasPrice = this.price !== undefined && this.price !== null;
    const hasVariants = this.pricingVariants && this.pricingVariants.length > 0;
    const hasOptions = this.pricingOptions && this.pricingOptions.length > 0;
    if (!hasPrice && !hasVariants && !hasOptions) {
        throw new Error('Either price, pricingVariants, or pricingOptions must be provided');
    }
});
MenuItemSchema.index({ category: 1 });
MenuItemSchema.index({ isPopular: 1 });
MenuItemSchema.index({ name: 'text' });
exports.default = mongoose_1.default.models.MenuItem ||
    mongoose_1.default.model('MenuItem', MenuItemSchema);
//# sourceMappingURL=menuItem.js.map