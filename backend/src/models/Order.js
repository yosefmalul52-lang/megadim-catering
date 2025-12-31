const mongoose = require('mongoose');

// Order Item Schema - snapshot of item at time of order
const OrderItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  selectedOption: { 
    label: String,
    amount: String,
    price: Number
  },
  imageUrl: { type: String, trim: true },
  description: { type: String, trim: true }
}, { _id: false });

// Customer Details Schema
const CustomerDetailsSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  address: { type: String, trim: true },
  notes: { type: String, trim: true }
}, { _id: false });

// Order Schema
const OrderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Optional - allows guest orders
    index: true
  },
  customerDetails: {
    type: CustomerDetailsSchema,
    required: true
  },
  items: {
    type: [OrderItemSchema],
    required: true,
    validate: {
      validator: function(items) {
        return items && items.length > 0;
      },
      message: 'Order must have at least one item'
    }
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['new', 'in-progress', 'ready', 'delivered', 'cancelled'],
    default: 'new',
    index: true
  }
}, {
  timestamps: true,
  collection: 'orders'
});

// Indexes for better query performance
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ 'customerDetails.phone': 1 });
OrderSchema.index({ createdAt: -1 });

// Virtual for formatted date
OrderSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
});

const Order = mongoose.model('Order', OrderSchema);

module.exports = Order;

