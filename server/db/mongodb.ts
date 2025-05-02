import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Get MongoDB connection string from environment variables
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gameModPanel';

// Connect to MongoDB
export async function connectToMongoDB() {
  try {
    // Check if we have a valid MongoDB URI
    if (!MONGODB_URI || MONGODB_URI === 'mongodb://localhost:27017/gameModPanel') {
      console.log('No MongoDB URI provided, using in-memory simulation');
      return true;
    }
    
    // Connect to the real MongoDB instance
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully');
    
    // Check if SEED_ENHANCED_DATA environment variable is set
    const seedEnhanced = process.env.SEED_ENHANCED_DATA === 'true';
    
    if (seedEnhanced) {
      // Import and run enhanced seeding with 20 players and 15 tickets
      console.log('Seeding database with enhanced mock data (20 players, 15 tickets)...');
      const { seedEnhancedDatabase } = await import('../db/enhanced-seed-data');
      await seedEnhancedDatabase();
    } else {
      // Regular seed with minimal data
      console.log('Checking if regular database seeding is needed...');
      const { seedDatabase } = await import('../db/seed-data');
      await seedDatabase();
    }
    
    return true;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.log('Falling back to in-memory simulation');
    return false;
  }
}

// Disconnect from MongoDB
export async function disconnectFromMongoDB() {
  try {
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
  } catch (error) {
    console.error('MongoDB disconnection error:', error);
  }
}