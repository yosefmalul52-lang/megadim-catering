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
// Order Schema - userId MUST be at root level
const OrderSchema = new mongoose_1.Schema({
    // userId is optional - null for guest orders
    userId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: false, // Optional - allows guest orders
        default: null,
        index: true
    },
    customerDetails: {
        type: Object,
        required: true
    },
    items: [{
            productId: String,
            name: String,
            price: Number,
            quantity: Number,
            category: String,
            selectedOption: {
                label: String,
                amount: String,
                price: Number
            },
            imageUrl: String,
            description: String
        }],
    totalPrice: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['new', 'in-progress', 'ready', 'delivered', 'cancelled'],
        default: 'new'
    }
}, {
    timestamps: true,
    collection: 'orders',
    strict: true // Ensure strict mode - only save fields defined in schema
});
// Indexes for better query performance
OrderSchema.index({ userId: 1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ createdAt: -1 });
// Create and export the model
const Order = mongoose_1.default.model('Order', OrderSchema);
exports.default = Order;
