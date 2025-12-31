const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Get MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MongoDB connection string is not defined.');
  console.error('Please set MONGODB_URI, DATABASE_URL, or MONGO_URI in your .env file');
  process.exit(1);
}

// Define TestEntry Schema
const TestEntrySchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'test_entries'
});

// Create TestEntry Model
const TestEntry = mongoose.model('TestEntry', TestEntrySchema);

// Main function to test connection
async function testConnection() {
  try {
    // Connect to MongoDB
    console.log('🔄 Connecting to MongoDB...');
    const conn = await mongoose.connect(MONGODB_URI);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    // Create and save test document
    console.log('📝 Creating test document...');
    const testDoc = new TestEntry({
      text: 'Hello Magadim! Database is working.'
    });
    
    const savedDoc = await testDoc.save();
    console.log(`✅ Document saved with ID: ${savedDoc._id}`);
    
    // Success message
    console.log('✅ Successfully connected and saved data!');
    
    // Close connection
    await mongoose.connection.close();
    console.log('🔌 Connection closed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the test
testConnection();

