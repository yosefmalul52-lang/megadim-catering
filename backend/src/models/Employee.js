const mongoose = require('mongoose');

// Employee Schema
const EmployeeSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    required: true,
    trim: true,
    enum: ['Chef', 'Driver', 'Cleaner', 'Manager', 'Other']
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  hourlyRate: {
    type: Number,
    required: true,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  pinCode: {
    type: String,
    required: true,
    trim: true,
    minlength: 4,
    maxlength: 6
  }
}, {
  timestamps: true,
  collection: 'employees'
});

// Indexes
EmployeeSchema.index({ isActive: 1 });
EmployeeSchema.index({ role: 1 });

// Virtual for full name
EmployeeSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Export the model
const Employee = mongoose.model('Employee', EmployeeSchema);

module.exports = Employee;

