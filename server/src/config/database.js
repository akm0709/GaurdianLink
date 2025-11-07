const mongoose = require('mongoose');

/**
 * connectDB
 * Establishes connection to MongoDB with retry logic and proper error handling.
 * @param {Object} opts - Options for connection
 * @returns {Promise} Mongoose connection instance
 */
const connectDB = async (opts = {}) => {
    try {
        // Don't disconnect if not connected
        if (mongoose.connection.readyState !== 0) {
            console.log('ℹ️ Closing existing MongoDB connection...');
            await mongoose.disconnect();
        }
    } catch (err) {
        console.warn('⚠️ No existing connection to close');
    }

    const uri = process.env.MONGODB_URI || 'mongodb+srv://student_management_system:123sp95@mernproject.2jdp5hj.mongodb.net/guardianlink?retryWrites=true&w=majority';
    const maxRetries = opts.maxRetries || 5;
    const retryDelay = opts.retryDelay || 3000;
    let retries = 0;

    const attempt = async () => {
        try {
            console.log(`\n🔗 Attempting MongoDB connection... (Attempt ${retries + 1}/${maxRetries})`);
            
            // Configure Mongoose
            mongoose.set('strictQuery', false);
            
            const conn = await mongoose.connect(uri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 10000,
                socketTimeoutMS: 45000,
                retryWrites: true,
                w: 'majority'
            });

            console.log('✅ MongoDB Connected Successfully!');
            console.log(`   📁 Database: ${conn.connection.name}`);
            console.log(`   🏠 Host: ${conn.connection.host}`);
            console.log(`   � Port: ${conn.connection.port}`);

            // Handle connection events
            mongoose.connection.on('error', (err) => {
                console.error('❌ MongoDB connection error:', err.message);
            });

            mongoose.connection.on('disconnected', () => {
                console.warn('⚠️ MongoDB disconnected');
            });

            mongoose.connection.on('reconnected', () => {
                console.log('🔄 MongoDB reconnected');
            });

            return conn;
        } catch (error) {
            console.error('❌ MongoDB Connection Failed:', error.message);
            
            if (error.name === 'MongoNetworkError') {
                console.error('   🌐 Network Error: Check internet and MongoDB accessibility');
            } else if (error.name === 'MongoServerError') {
                console.error('   🔐 Auth Error: Check database credentials');
            } else if (error.name === 'MongooseServerSelectionError') {
                console.error('   🔍 Server Error: Check connection string and DNS');
            }
            
            if (retries < maxRetries - 1) {
                retries++;
                console.log(`   ⏳ Retrying in ${retryDelay / 1000}s... (${retries}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return attempt();
            } else {
                throw new Error(`Failed to connect to MongoDB after ${maxRetries} attempts: ${error.message}`);
            }
        }
    };

    // Start connection attempt
    return await attempt();
};

module.exports = connectDB;