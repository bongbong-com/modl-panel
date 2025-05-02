import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { seedEnhancedDatabase } from '../db/enhanced-seed-data';

/**
 * This script can be run to reset the database and populate it with
 * 20 mock players and 15 mock tickets for testing
 */

// Load environment variables
dotenv.config();

// Get MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gameModPanel';

async function main() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully');
    
    // Import models
    const { Player, Staff, Ticket, Log } = await import('../models/mongodb-schemas');
    
    // Keep current staff accounts but clear other collections
    console.log('Clearing existing players, tickets, and logs...');
    await Player.deleteMany({});
    await Ticket.deleteMany({});
    await Log.deleteMany({});
    
    console.log('Running enhanced seeding...');
    await seedEnhancedDatabase();
    
    console.log('Mock data seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding mock data:', error);
  } finally {
    // Disconnect from MongoDB
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
    
    process.exit(0);
  }
}

// Run the script
main();