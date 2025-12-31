require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const User = require('../backend/src/models/User');

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MongoDB connection string is not defined.');
  console.error('Please set MONGODB_URI, DATABASE_URL, or MONGO_URI in your .env file.');
  process.exit(1);
}

async function createAdmin() {
  try {
    // Connect to MongoDB with options
    console.log('🔌 Connecting to MongoDB...');
    console.log('   URI:', MONGODB_URI.replace(/:[^:@]+@/, ':****@')); // Hide password in logs
    
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000, // 45 seconds
      connectTimeoutMS: 30000, // 30 seconds
    });
    
    // Verify connection is ready
    const state = mongoose.connection.readyState;
    console.log('   Connection state:', state === 1 ? 'Connected' : state === 2 ? 'Connecting' : 'Disconnected');
    
    if (state !== 1) {
      throw new Error('MongoDB connection is not ready');
    }
    
    console.log('✅ Connected to MongoDB successfully');
    console.log('   Database:', mongoose.connection.name);
    console.log('   Host:', mongoose.connection.host);

    // Wait a bit to ensure connection is ready and test it
    console.log('⏳ Waiting for connection to be ready...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test connection with a simple operation
    try {
      const db = mongoose.connection.db;
      const collections = await db.listCollections().toArray();
      console.log('✅ Database is accessible');
      console.log('   Collections:', collections.map(c => c.name).join(', '));
    } catch (testError) {
      console.log('⚠️  Could not list collections:', testError.message);
    }

    // Use direct MongoDB operations instead of Mongoose to avoid buffering issues
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Check if admin user already exists
    console.log('🔍 Checking for existing admin user...');
    let existingAdmin = null;
    try {
      existingAdmin = await usersCollection.findOne({ username: 'admin' });
    } catch (findError) {
      console.log('⚠️  Could not check for existing user:', findError.message);
    }
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log('   Username: admin');
      console.log('   ID:', existingAdmin._id);
      console.log('   Role:', existingAdmin.role || 'admin');
      console.log('\n💡 To reset the password, delete the user first or update it manually.');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Hash password manually
    console.log('👤 Creating admin user...');
    const bcrypt = require('../backend/node_modules/bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('123456', salt);

    // Create admin user directly in MongoDB
    const adminUserData = {
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      const result = await usersCollection.insertOne(adminUserData);
      console.log('\n✅ Admin user created successfully!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('   Username: admin');
      console.log('   Password: 123456');
      console.log('   Role: admin');
      console.log('   ID:', result.insertedId);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\n⚠️  IMPORTANT: Change the default password after first login!');
      console.log('   The password has been hashed and stored securely.\n');

      // Close connection
      await mongoose.connection.close();
      console.log('🔌 Database connection closed');
      process.exit(0);
    } catch (saveError) {
      // If it's a duplicate key error, the user already exists
      if (saveError.code === 11000 || saveError.message.includes('duplicate')) {
        console.log('⚠️  Admin user already exists (duplicate key error)!');
        console.log('   Username: admin');
        console.log('\n💡 To reset the password, delete the user first or update it manually.');
        await mongoose.connection.close();
        process.exit(0);
      }
      throw saveError;
    }
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the script
createAdmin();

