"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabase = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error('❌ MONGO_URI is missing in .env file');
    console.error('   Please set MONGO_URI in backend/.env');
    throw new Error('MongoDB connection string (MONGO_URI) is not defined in .env file');
}
const TestConnectionSchema = new mongoose_1.default.Schema({
    message: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    collection: 'test_connections'
});
const TestConnection = mongoose_1.default.model('TestConnection', TestConnectionSchema);
const connectDatabase = async () => {
    try {
        console.log('📡 Connecting to MongoDB...');
        console.log(`   URI: ${MONGO_URI ? MONGO_URI.replace(/:[^:@]+@/, ':****@') : 'Not set'}`);
        const conn = await mongoose_1.default.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000
        });
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}`);
        try {
            const testDoc = new TestConnection({
                message: 'Hello Magadim! Connection Successful'
            });
            const savedDoc = await testDoc.save();
            console.log(`✅ Test document inserted successfully`);
            console.log(`📝 Document ID: ${savedDoc._id}`);
        }
        catch (testError) {
            console.error('⚠️ Test document insertion failed:', testError.message);
        }
        mongoose_1.default.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });
        mongoose_1.default.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected');
        });
        process.on('SIGINT', async () => {
            await mongoose_1.default.connection.close();
            console.log('✅ MongoDB connection closed through app termination');
            process.exit(0);
        });
    }
    catch (error) {
        console.error('❌ Error connecting to MongoDB:');
        console.error('   Message:', error.message);
        console.error('   Code:', error.code);
        console.error('   Full error:', error);
        console.error('');
        console.error('💡 Troubleshooting:');
        console.error('   1. Check if MongoDB is running');
        console.error('   2. Verify MONGODB_URI in .env file');
        console.error('   3. Check network connectivity');
        throw error;
    }
};
exports.connectDatabase = connectDatabase;
exports.default = exports.connectDatabase;
//# sourceMappingURL=database.js.map