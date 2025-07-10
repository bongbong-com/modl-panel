import { createConnection, Connection } from 'mongoose';

async function debugTicketEmailFlow() {
  console.log('🔍 Debugging Ticket Email Flow');
  console.log('===============================\n');

  console.log('Since other emails (auth/invites) work, SMTP is fine.');
  console.log('The issue is likely in our ticket notification logic.\n');

  console.log('🔍 Debugging Checklist:');
  console.log('========================\n');

  console.log('1. CHECK: Does your ticket have an email stored?');
  console.log('   • Open ticket in admin panel');
  console.log('   • Look for "creatorEmail" in ticket data');
  console.log('   • If missing, the email wasn\'t captured during creation\n');

  console.log('2. CHECK: Are staff replies triggering the email code?');
  console.log('   • Look in server logs for these messages:');
  console.log('   • "[Staff Reply] Failed to send email notification"');
  console.log('   • "[Staff PATCH Reply] Failed to send email notification"');
  console.log('   • "[Ticket Email] Notification sent to [email]"\n');

  console.log('3. CHECK: Which reply method are you using?');
  console.log('   • Staff web panel replies: Should trigger notifications');
  console.log('   • API replies with staff=true: Should trigger notifications');
  console.log('   • Player replies: Do NOT trigger notifications (by design)\n');

  console.log('4. COMMON ISSUES:');
  console.log('   ❌ Email field not filled during ticket creation');
  console.log('   ❌ Reply marked as staff=false instead of staff=true');
  console.log('   ❌ Using old ticket created before email updates');
  console.log('   ❌ FormData not properly processed\n');

  console.log('5. QUICK TESTS:');
  console.log('   A. Create a NEW ticket with email field filled');
  console.log('   B. Have staff reply via web panel');
  console.log('   C. Check server logs immediately after reply');
  console.log('   D. Verify ticket.data contains "creatorEmail"\n');

  console.log('6. MANUAL VERIFICATION:');
  console.log('   Run this in your database to check a ticket:');
  console.log('   db.tickets.findOne({_id: "YOUR_TICKET_ID"})');
  console.log('   Look for data.creatorEmail field\n');

  console.log('7. LOG WHAT TO LOOK FOR:');
  console.log('   SUCCESS: "[Ticket Email] Notification sent to user@email.com"');
  console.log('   ERROR: "[Staff Reply] Failed to send email notification"');
  console.log('   MISSING: No email log messages at all = code not triggered\n');

  console.log('🎯 MOST LIKELY CAUSES:');
  console.log('=======================');
  console.log('1. Ticket was created BEFORE email fields were added');
  console.log('2. Email field was empty/not filled during ticket creation');
  console.log('3. Staff reply not marked with staff=true flag');
  console.log('4. Using existing server that doesn\'t have updated forms\n');

  console.log('📋 TO FIX:');
  console.log('===========');
  console.log('1. Create a NEW ticket and fill in the email field');
  console.log('2. Have staff reply via the web admin panel');
  console.log('3. Check server logs for email notification messages');
  console.log('4. If still no email, share the ticket ID for deeper debugging');
}

debugTicketEmailFlow().catch(console.error);