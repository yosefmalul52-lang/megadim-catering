const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from root .env file
const envPath = path.join(__dirname, '..', '.env');
console.log(`📄 Loading .env from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn(`⚠️ Warning: Could not load .env file: ${result.error.message}`);
} else {
  console.log(`✅ Loaded .env file (${Object.keys(result.parsed || {}).length} variables found)`);
}

// Get MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('❌ Error: MongoDB connection string is not defined.');
  console.error('Please set MONGODB_URI, DATABASE_URL, or MONGO_URI in your .env file');
  process.exit(1);
}

// Import Order model
const Order = require('../backend/src/models/Order');

// Dummy orders data
const dummyOrders = [
  {
    customerDetails: {
      fullName: 'ישראל ישראלי',
      phone: '052-123-4567',
      email: 'israel@example.com',
      address: 'רחוב הרצל 15, תל אביב',
      notes: 'בבקשה ללא חריף, משלוח עד 18:00'
    },
    items: [
      {
        name: 'סלט חומוס',
        price: 17,
        quantity: 2,
        selectedOption: {
          label: '250 מ"ל',
          amount: '250',
          price: 17
        },
        imageUrl: '/assets/images/salads/hummus.jpg',
        description: 'חומוס קלאסי ביתי עשוי מגרגרי חומוס איכותיים, טחינה משובחת, לימון טרי ושום'
      },
      {
        name: 'שניצל עוף',
        price: 51,
        quantity: 1,
        imageUrl: '/assets/images/placeholder-dish.jpg',
        description: 'שניצל עוף פריך וטעים, מוגש עם לימון'
      }
    ],
    totalPrice: 85,
    status: 'new'
  },
  {
    customerDetails: {
      fullName: 'שרה כהן',
      phone: '054-987-6543',
      email: 'sara@example.com',
      address: 'רחוב בן יהודה 42, ירושלים',
      notes: 'לשבת, משלוח ביום שישי לפני 14:00, אירוע ל-30 איש'
    },
    items: [
      {
        name: 'מגש קייטרינג גדול',
        price: 450,
        quantity: 1,
        selectedOption: {
          label: 'מגש גדול',
          amount: '30 איש',
          price: 450
        },
        imageUrl: '/assets/images/placeholder-dish.jpg',
        description: 'מגש קייטרינג מלא עם מגוון מנות: סלטים, מנות עיקריות, תוספות וקינוחים'
      }
    ],
    totalPrice: 450,
    status: 'in-progress'
  },
  {
    customerDetails: {
      fullName: 'משה לוי',
      phone: '03-555-1234',
      email: 'moshe@example.com',
      address: 'רחוב דיזנגוף 100, תל אביב',
      notes: 'הזמנה הושלמה בהצלחה'
    },
    items: [
      {
        name: 'צ\'ולנט ביתי',
        price: 45,
        quantity: 1,
        imageUrl: '/assets/images/cholent.jpg',
        description: 'צ\'ולנט מסורתי עם בשר, תפוחי אדמה ושעועית'
      },
      {
        name: 'קוגל תפוחי אדמה',
        price: 20,
        quantity: 2,
        imageUrl: '/assets/images/placeholder-dish.jpg',
        description: 'קוגל תפוחי אדמה מסורתי, פריך מבחוץ ורך מבפנים'
      },
      {
        name: 'סלט טחינה',
        price: 17,
        quantity: 1,
        selectedOption: {
          label: '250 מ"ל',
          amount: '250',
          price: 17
        },
        imageUrl: '/assets/images/salads/grinding.jpg',
        description: 'טחינה קרמית ומרוכזת עשויה משומשום איכותי, מתובלת בלימון טרי ושום'
      },
      {
        name: 'סלט חומוס',
        price: 17,
        quantity: 1,
        selectedOption: {
          label: '250 מ"ל',
          amount: '250',
          price: 17
        },
        imageUrl: '/assets/images/salads/hummus.jpg',
        description: 'חומוס קלאסי ביתי עשוי מגרגרי חומוס איכותיים'
      }
    ],
    totalPrice: 120,
    status: 'delivered'
  }
];

// Main function to seed orders
async function seedOrders() {
  try {
    // Connect to MongoDB
    console.log('🔄 Connecting to MongoDB...');
    const conn = await mongoose.connect(MONGODB_URI);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    // Clear existing orders to start fresh
    const deletedCount = await Order.deleteMany({});
    console.log(`🗑️ Deleted ${deletedCount.deletedCount} existing orders`);
    
    // Insert dummy orders
    console.log('🔄 Inserting dummy orders...');
    const insertedOrders = await Order.insertMany(dummyOrders);
    
    console.log(`✅ Seed completed!`);
    console.log(`📝 Inserted ${insertedOrders.length} orders`);
    console.log('✅ Dummy orders created!');
    
    // Display inserted orders
    insertedOrders.forEach((order, index) => {
      console.log(`\n📦 Order ${index + 1}:`);
      console.log(`   ID: ${order._id}`);
      console.log(`   Customer: ${order.customerDetails.fullName} (${order.customerDetails.phone})`);
      console.log(`   Total: ₪${order.totalPrice}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Items: ${order.items.length}`);
    });
    
    // Close connection
    await mongoose.connection.close();
    console.log('\n🔌 Connection closed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error seeding orders:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the seed
seedOrders();

