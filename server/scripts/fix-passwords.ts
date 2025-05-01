import mongoose from 'mongoose';
import { Staff } from '../models/mongodb-schemas';
import { connectToMongoDB } from '../db/mongodb';
import { createSystemLog } from '../routes/log-routes';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

async function fixPasswords() {
  try {
    await connectToMongoDB();
    console.log('Connected to MongoDB');
    
    // Find all staff members
    const staff = await Staff.find({});
    console.log(`Found ${staff.length} staff members`);
    
    for (const user of staff) {
      // Check if password is already properly formatted
      if (user.password && user.password.includes('.')) {
        console.log(`Password for ${user.username} already in correct format`);
        continue;
      }
      
      // Update password to new format
      const newPassword = await hashPassword('admin123'); // Reset to default password
      user.password = newPassword;
      await user.save();
      console.log(`Updated password for ${user.username}`);
    }
    
    await createSystemLog('Staff passwords updated to new secure format');
    console.log('Password update completed successfully');
    
  } catch (error) {
    console.error('Error updating passwords:', error);
  } finally {
    // Close the MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the function
fixPasswords();