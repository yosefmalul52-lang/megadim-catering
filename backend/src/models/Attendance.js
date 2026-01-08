const mongoose = require('mongoose');

// Attendance Schema
const AttendanceSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  clockIn: {
    type: Date,
    required: true,
    default: Date.now
  },
  clockOut: {
    type: Date,
    required: false
  },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active'
  },
  totalHours: {
    type: Number,
    required: false,
    min: 0
  }
}, {
  timestamps: true,
  collection: 'attendances'
});

// Indexes
AttendanceSchema.index({ employeeId: 1, status: 1 });
AttendanceSchema.index({ clockIn: -1 });

// Pre-save hook to calculate total hours if clockOut exists
AttendanceSchema.pre('save', async function() {
  if (this.clockOut && this.clockIn) {
    const diffMs = this.clockOut.getTime() - this.clockIn.getTime();
    this.totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // Round to 2 decimals
  }
});

// Export the model
const Attendance = mongoose.model('Attendance', AttendanceSchema);

module.exports = Attendance;

