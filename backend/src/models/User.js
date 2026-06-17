const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'user', 'driver', 'institution'],
    default: 'user',
    index: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  tags: {
    type: [String],
    default: []
  },
  adminNotes: {
    type: String,
    default: ''
  },
  dietaryInfo: {
    type: String,
    default: ''
  },
  deletedAt: {
    type: Date,
    default: null,
    index: true
  },
  portalSettings: {
    deadlineDay: {
      type: Number,
      min: 0,
      max: 6,
      default: 4
    },
    deadlineTime: {
      type: String,
      trim: true,
      default: '12:00'
    },
    customMessage: {
      type: String,
      trim: true,
      default: ''
    }
  }
}, {
  timestamps: true,
  collection: 'users'
});

// Hash password before saving
// Using async function - no next parameter needed
UserSchema.pre('save', async function() {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return; // Early return if password not modified
  }

  try {
    // Hash password with cost of 10
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    // No next() call needed for async functions
  } catch (error) {
    throw error; // Throw error instead of calling next(error)
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Method to return user without password
UserSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

const User = mongoose.model('User', UserSchema);

module.exports = User;

