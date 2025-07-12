// Debug script to check ticket subscriptions
// Run this with: node debug-subscriptions.js

import { MongoClient } from 'mongodb';

async function checkSubscriptions() {
  // You'll need to replace this with your actual MongoDB connection string
  const mongoUri = process.env.MONGODB_URI_TEMPLATE?.replace('<dbName>', 'modl_test') || 'mongodb://localhost:27017/modl_test';
  
  console.log('Connecting to:', mongoUri);
  
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    const db = client.db();
    
    console.log('\n=== CHECKING STAFF SUBSCRIPTIONS ===');
    
    const staff = await db.collection('staff').find({}).toArray();
    
    for (const staffMember of staff) {
      console.log(`\nStaff: ${staffMember.username} (${staffMember.email})`);
      console.log('subscribedTickets:', staffMember.subscribedTickets || 'undefined');
      console.log('ticketSubscriptionSettings:', staffMember.ticketSubscriptionSettings || 'undefined');
    }
    
    console.log('\n=== CHECKING RECENT TICKETS ===');
    
    const tickets = await db.collection('tickets').find({}).sort({ created: -1 }).limit(5).toArray();
    
    for (const ticket of tickets) {
      console.log(`\nTicket: ${ticket._id}`);
      console.log('Subject:', ticket.subject || ticket.title || 'No subject');
      console.log('Created:', ticket.created || ticket.createdAt);
      console.log('Replies count:', (ticket.replies || ticket.messages || []).length);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkSubscriptions();