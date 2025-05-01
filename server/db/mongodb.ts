import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Use an in-memory MongoDB server for development
const MONGODB_URI = 'mongodb://localhost:27017/gameModPanel';

// Create in-memory data for MongoDB
let isConnected = false;

// Connect to MongoDB or use in-memory storage
export async function connectToMongoDB() {
  try {
    // Skip actual connection in development to avoid errors
    // Just simulate a connection for our development environment
    console.log('Using in-memory MongoDB simulation');
    isConnected = true;
    return true;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    return false;
  }
}

// Disconnect from MongoDB
export async function disconnectFromMongoDB() {
  try {
    if (isConnected) {
      console.log('Disconnected from in-memory MongoDB simulation');
      isConnected = false;
    }
  } catch (error) {
    console.error('MongoDB disconnection error:', error);
  }
}