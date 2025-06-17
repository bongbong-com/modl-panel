#!/usr/bin/env ts-node

/**
 * Test script to verify custom domain routing functionality
 * This script tests the database lookups and routing logic for custom domains
 */

import { connectToGlobalModlDb } from '../db/connectionManager';
import { ModlServerSchema } from '../models/modl-global-schemas';

async function testCustomDomainRouting() {
  console.log('🧪 Testing Custom Domain Routing Logic...\n');

  try {
    // Connect to the global database
    const globalDb = await connectToGlobalModlDb();
    const ModlServerModel = globalDb.model('ModlServer', ModlServerSchema);

    // Test 1: Check if we have any servers with custom domains
    console.log('📋 Test 1: Checking for servers with custom domains...');
    const serversWithCustomDomains = await ModlServerModel.find({
      customDomain_override: { $exists: true, $ne: null }
    });

    console.log(`Found ${serversWithCustomDomains.length} servers with custom domains:`);
    serversWithCustomDomains.forEach(server => {
      console.log(`  - ${server.customDomain} -> ${server.customDomain_override} (Status: ${server.customDomain_status})`);
    });

    // Test 2: Simulate subdomain lookup
    console.log('\n📋 Test 2: Testing subdomain lookup...');
    const testSubdomain = 'testlocal';
    const subdomainServer = await ModlServerModel.findOne({ customDomain: testSubdomain });
    if (subdomainServer) {
      console.log(`✅ Found server for subdomain '${testSubdomain}': ${subdomainServer._id}`);
    } else {
      console.log(`❌ No server found for subdomain '${testSubdomain}'`);
    }

    // Test 3: Simulate custom domain lookup
    console.log('\n📋 Test 3: Testing custom domain lookup...');
    const activeCustomDomains = await ModlServerModel.find({
      customDomain_override: { $exists: true, $ne: null },
      customDomain_status: 'active'
    });

    console.log(`Found ${activeCustomDomains.length} active custom domains:`);
    activeCustomDomains.forEach(server => {
      console.log(`  - ${server.customDomain_override} -> ${server.customDomain} (Active)`);
    });

    // Test 4: Test routing logic simulation
    console.log('\n📋 Test 4: Simulating routing logic...');
    
    const testDomains = [
      'testlocal.modl.gg',
      'panel.example.com',
      'moderation.customdomain.net'
    ];

    for (const testDomain of testDomains) {
      console.log(`\nTesting hostname: ${testDomain}`);
      
      let serverName: string;
      let serverConfig: any = null;
      
      if (testDomain.endsWith('.modl.gg')) {
        // Extract subdomain
        const parts = testDomain.split('.');
        const baseDomainParts = 'modl.gg'.split('.').length;
        if (parts.length > baseDomainParts) {
          serverName = parts.slice(0, parts.length - baseDomainParts).join('.');
          serverConfig = await ModlServerModel.findOne({ customDomain: serverName });
          console.log(`  → Subdomain lookup: ${serverName}`);
        }
      } else {
        // Custom domain lookup
        serverConfig = await ModlServerModel.findOne({ 
          customDomain_override: testDomain,
          customDomain_status: 'active'
        });
        console.log(`  → Custom domain lookup: ${testDomain}`);
      }

      if (serverConfig) {
        console.log(`  ✅ Server found: ${serverConfig.customDomain} (ID: ${serverConfig._id})`);
        if (serverConfig.customDomain_override) {
          console.log(`  🔗 Custom domain: ${serverConfig.customDomain_override} (${serverConfig.customDomain_status})`);
        }
      } else {
        console.log(`  ❌ No server configuration found`);
      }
    }

    console.log('\n✅ Custom domain routing tests completed successfully!');

  } catch (error) {
    console.error('❌ Error during testing:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the test
testCustomDomainRouting().catch(console.error);
