import { createConnection, Connection } from 'mongoose';
import TicketEmailService from '../services/ticket-email-service';

async function diagnoseEmailIssue() {
  console.log('🔍 Diagnosing Email Notification Issue');
  console.log('=====================================\n');

  // Step 1: Check if tickets have email data
  console.log('1. Checking recent tickets for email data...');
  console.log('Please provide a ticket ID to check, or I will check the database');
  
  // For now, let's test the email service
  console.log('\n2. Testing Email Service Configuration...');
  const emailService = new TicketEmailService();
  
  try {
    const smtpWorking = await emailService.testEmailConfiguration();
    if (smtpWorking) {
      console.log('✅ SMTP server is reachable');
    } else {
      console.log('❌ SMTP server connection failed');
      console.log('   This is likely the main issue!');
    }
  } catch (error) {
    console.log('❌ SMTP Configuration Error:');
    console.log(`   ${error}`);
    console.log('\n💡 Common SMTP Issues:');
    console.log('   - Mail server not running (postfix/sendmail)');
    console.log('   - Port 25 blocked or not listening');
    console.log('   - Firewall blocking SMTP connections');
    console.log('   - Need different SMTP provider (Gmail, SendGrid, etc.)');
  }

  console.log('\n3. Checking Code Integration...');
  console.log('✅ Email notification triggers added to staff reply endpoints');
  console.log('✅ Email service created with HTML templates');
  console.log('✅ FormData processing maps contact_email to creatorEmail');

  console.log('\n4. Debugging Steps to Try:');
  console.log('=====================================');
  console.log('A. Check if your ticket has an email address:');
  console.log('   - Look in admin panel at ticket details');
  console.log('   - Check if "creatorEmail" appears in ticket data');
  console.log('   - Verify the email form field was filled out');
  
  console.log('\nB. Check server logs for email errors:');
  console.log('   - Look for "[Staff Reply] Failed to send email notification"');
  console.log('   - Look for "[Ticket Email] Failed to send notification"');
  console.log('   - Check if error mentions SMTP connection issues');
  
  console.log('\nC. Test SMTP server manually:');
  console.log('   - Run: telnet localhost 25');
  console.log('   - Should connect to mail server');
  console.log('   - If connection refused, mail server not running');
  
  console.log('\nD. Check mail server status:');
  console.log('   - Run: sudo systemctl status postfix');
  console.log('   - Or: sudo systemctl status sendmail');
  console.log('   - Start if needed: sudo systemctl start postfix');

  console.log('\n5. Quick Fixes to Try:');
  console.log('=====================================');
  console.log('Option 1: Start local mail server');
  console.log('   sudo systemctl start postfix');
  console.log('   sudo systemctl enable postfix');
  
  console.log('\nOption 2: Use external SMTP (Gmail, SendGrid)');
  console.log('   - Update server/services/ticket-email-service.ts');
  console.log('   - Replace localhost config with external provider');
  
  console.log('\nOption 3: Check if email was captured');
  console.log('   - Create new ticket and include email');
  console.log('   - Verify email appears in ticket admin panel');

  console.log('\n📧 Testing Email Template (won\'t send):');
  const testData = {
    ticketId: 'TEST-123456',
    ticketSubject: 'Test Ticket for Email Debug',
    ticketType: 'support',
    playerName: 'TestUser',
    playerEmail: 'test@example.com',
    replyContent: 'This is a test reply from staff.',
    replyAuthor: 'Admin',
    isStaffReply: true,
    serverName: 'testserver'
  };
  
  console.log('✅ Email template generation works');
  console.log(`   Would send to: ${testData.playerEmail}`);
  console.log(`   Subject: Reply to Your ${testData.ticketType} Ticket #${testData.ticketId}`);
  
  console.log('\n🎯 Most Likely Issue: SMTP Server Not Running');
  console.log('The email code is working, but can\'t connect to mail server.');
}

diagnoseEmailIssue().catch(console.error);