const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from root .env file
// Since script is in scripts/ folder, we need to go up one level
const envPath = path.resolve(__dirname, '..', '.env');
console.log(`📄 Loading .env from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn(`⚠️ Warning: Could not load .env file: ${result.error.message}`);
} else {
  console.log(`✅ Loaded .env file (${Object.keys(result.parsed || {}).length} variables found)`);
}

// Get MongoDB connection string
// Support multiple environment variable names for flexibility
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MongoDB connection string is not defined.');
  console.error('Please set MONGODB_URI, DATABASE_URL, or MONGO_URI in your .env file');
  console.error(`\nCurrent environment variables found:`);
  console.error(`- MONGODB_URI: ${process.env.MONGODB_URI ? '✅ Set' : '❌ Not set'}`);
  console.error(`- DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Not set'}`);
  console.error(`- MONGO_URI: ${process.env.MONGO_URI ? '✅ Set' : '❌ Not set'}`);
  process.exit(1);
}

// Import MenuItem model
const MenuItem = require('../backend/src/models/MenuItem');

// Pricing options for salads
const pricingOptions = [
  { label: "250 מ\"ל", amount: "250", price: 17 },
  { label: "500 מ\"ל", amount: "500", price: 27 }
];

// Main function to update salads pricing
async function updateSaladsPricing() {
  try {
    // Connect to MongoDB
    console.log('🔄 Connecting to MongoDB...');
    const conn = await mongoose.connect(MONGODB_URI);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    // Update all salads with standardized pricing
    console.log('🔄 Updating salads pricing...');
    const result = await MenuItem.updateMany(
      { category: 'סלטים' }, // Filter: find all items with category 'סלטים'
      {
        $set: {
          price: 17, // Base price
          pricingOptions: pricingOptions // Set pricing options
        }
      }
    );
    
    console.log(`✅ Update completed!`);
    console.log(`📊 Documents matched: ${result.matchedCount}`);
    console.log(`📝 Documents modified: ${result.modifiedCount}`);
    
    // Verify the update by counting updated documents
    const updatedCount = await MenuItem.countDocuments({ 
      category: 'סלטים',
      pricingOptions: { $exists: true, $ne: [] }
    });
    console.log(`✅ Verified: ${updatedCount} salads now have pricingOptions`);
    
    // Close connection
    await mongoose.connection.close();
    console.log('🔌 Connection closed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error updating salads pricing:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the update
updateSaladsPricing();

