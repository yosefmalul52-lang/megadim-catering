"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabase = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
// NOTE: dotenv.config() is already called in server.ts, so we don't need it here
// Read MONGO_URI from process.env (standardized to MONGO_URI in backend/.env)
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error('❌ MONGO_URI is missing in .env file');
    console.error('   Please set MONGO_URI in backend/.env');
    throw new Error('MongoDB connection string (MONGO_URI) is not defined in .env file');
}
// Test Connection Schema
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
const connectDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('📡 Connecting to MongoDB...');
        console.log(`   URI: ${MONGO_URI ? MONGO_URI.replace(/:[^:@]+@/, ':****@') : 'Not set'}`);
        const conn = yield mongoose_1.default.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 10000, // 10 seconds timeout
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000
        });
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}`);
        // Test connection by inserting a test document
        try {
            const testDoc = new TestConnection({
                message: 'Hello Magadim! Connection Successful'
            });
            const savedDoc = yield testDoc.save();
            console.log(`✅ Test document inserted successfully`);
            console.log(`📝 Document ID: ${savedDoc._id}`);
        }
        catch (testError) {
            console.error('⚠️ Test document insertion failed:', testError.message);
            // Don't exit on test failure, connection is still successful
        }
        // One-time Cholent Bar menu seed (runs only if items not already present)
        const { runCholentBarSeed } = yield Promise.resolve().then(() => __importStar(require('../seed/cholentBarSeed')));
        yield runCholentBarSeed();
        // Seed delivery pricing ONLY when collection is empty – never overwrite user data on restart
        const { runDeliveryPricingSeed } = yield Promise.resolve().then(() => __importStar(require('../seed/deliveryPricingSeed')));
        yield runDeliveryPricingSeed();
        // Handle connection events
        mongoose_1.default.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });
        mongoose_1.default.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected');
        });
        // Graceful shutdown
        process.on('SIGINT', () => __awaiter(void 0, void 0, void 0, function* () {
            yield mongoose_1.default.connection.close();
            console.log('✅ MongoDB connection closed through app termination');
            process.exit(0);
        }));
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
        throw error; // Re-throw to let server.ts handle it
    }
});
exports.connectDatabase = connectDatabase;
exports.default = exports.connectDatabase;
