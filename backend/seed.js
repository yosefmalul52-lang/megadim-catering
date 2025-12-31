const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import the Product model
const Product = require('./src/models/Product');

// MongoDB connection string from environment
// Support multiple environment variable names for flexibility
const MONGO_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ Error: MongoDB connection string is not defined in environment variables');
  console.error('Please make sure .env file exists with MONGODB_URI, DATABASE_URL, or MONGO_URI');
  process.exit(1);
}

// Path to the JSON data file
const dataFilePath = path.join(__dirname, 'src', 'data', 'menuItems.json');

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message);
    process.exit(1);
  }
};

// Read and parse JSON file
const loadDataFromFile = () => {
  try {
    if (!fs.existsSync(dataFilePath)) {
      throw new Error(`Data file not found at: ${dataFilePath}`);
    }
    
    const fileContent = fs.readFileSync(dataFilePath, 'utf-8');
    const data = JSON.parse(fileContent);
    
    if (!Array.isArray(data)) {
      throw new Error('Data file must contain an array of items');
    }
    
    console.log(`📄 Loaded ${data.length} items from JSON file`);
    return data;
  } catch (error) {
    console.error('❌ Error reading data file:', error.message);
    process.exit(1);
  }
};

// Transform JSON data to match Product schema
const transformItem = (item) => {
  // Remove 'id' field (MongoDB will generate _id)
  const { id, ...rest } = item;
  
  // Ensure required fields are present
  const transformed = {
    ...rest,
    name: item.name || 'Unnamed Product',
    category: item.category || 'Uncategorized',
    description: item.description || '',
    imageUrl: item.imageUrl || '/assets/images/placeholder-dish.jpg',
    tags: item.tags || [],
    isAvailable: item.isAvailable !== undefined ? item.isAvailable : true,
    isPopular: item.isPopular || false
  };
  
  // Handle pricing variants if they exist
  if (item.pricingVariants && Array.isArray(item.pricingVariants)) {
    transformed.pricingVariants = item.pricingVariants;
    // Remove price if variants exist
    if (transformed.pricingVariants.length > 0) {
      transformed.price = undefined;
    }
  } else if (item.price !== undefined && item.price !== null) {
    // Keep single price if no variants
    transformed.price = item.price;
    transformed.pricingVariants = undefined;
  }
  
  // Convert date strings to Date objects if they exist
  if (item.createdAt) {
    transformed.createdAt = new Date(item.createdAt);
  }
  if (item.updatedAt) {
    transformed.updatedAt = new Date(item.updatedAt);
  }
  
  return transformed;
};

// Seed the database
const seedDatabase = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Load data from JSON file
    const items = loadDataFromFile();
    
    if (items.length === 0) {
      console.log('⚠️ No items to seed');
      await mongoose.connection.close();
      process.exit(0);
    }
    
    console.log('\n🔄 Starting database seeding...\n');
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Option 1: Clear existing products first (uncomment if needed)
    // console.log('🗑️  Clearing existing products...');
    // await Product.deleteMany({});
    // console.log('✅ Existing products cleared\n');
    
    // Insert items one by one to handle errors gracefully
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const transformedItem = transformItem(item);
        
        // Check if product already exists (by name and category)
        const existing = await Product.findOne({
          name: transformedItem.name,
          category: transformedItem.category
        });
        
        if (existing) {
          console.log(`⏭️  Skipping "${transformedItem.name}" - already exists`);
          continue;
        }
        
        // Create and save product
        const product = new Product(transformedItem);
        await product.save();
        
        successCount++;
        console.log(`✅ [${i + 1}/${items.length}] Inserted: ${transformedItem.name}`);
      } catch (error) {
        errorCount++;
        const errorMsg = `❌ [${i + 1}/${items.length}] Failed to insert "${item.name || 'Unknown'}": ${error.message}`;
        console.error(errorMsg);
        errors.push({
          item: item.name || 'Unknown',
          error: error.message
        });
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Seeding Summary:');
    console.log('='.repeat(50));
    console.log(`✅ Successfully inserted: ${successCount} items`);
    console.log(`❌ Failed: ${errorCount} items`);
    console.log(`📦 Total processed: ${items.length} items`);
    
    if (errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      errors.forEach((err, index) => {
        console.log(`   ${index + 1}. ${err.item}: ${err.error}`);
      });
    }
    
    console.log('='.repeat(50) + '\n');
    
    // Close database connection
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    console.log('🎉 Seeding completed!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error during seeding:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the seed script
seedDatabase();

