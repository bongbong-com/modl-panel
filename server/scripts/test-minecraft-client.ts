/**
 * Test Client for Minecraft API Routes
 * 
 * This script demonstrates how to interact with the Minecraft API endpoints.
 * It sends requests to the test server running on localhost:3001.
 * 
 * Usage:
 * 1. Start the test server: npm run tsx server/scripts/test-minecraft-routes.ts
 * 2. Run this test client: npm run tsx server/scripts/test-minecraft-client.ts
 * 
 * Note: For production use, you must include a valid API key in the X-API-Key header
 */

// API key for testing - in a real environment, this would be securely stored
const API_KEY = process.env.MINECRAFT_API_KEY || 'development-test-key';

// Sample test data
const testData = {
  player: {
    minecraftUuid: "550e8400-e29b-41d4-a716-446655440000",
    username: "TestPlayer",
    ipAddress: "192.168.1.1",
    skinHash: "abcdef1234567890"
  },
  staff: {
    minecraftUuid: "550e8400-e29b-41d4-a716-446655440001",
    username: "StaffMember"
  }
};

async function runTests() {
  console.log("Starting Minecraft API tests...");
  
  try {    // Test player login
    console.log("\n=== Testing Player Login ===");
    const loginResponse = await fetch("http://localhost:3001/minecraft/player/login", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
      },
      body: JSON.stringify({
        minecraftUuid: testData.player.minecraftUuid,
        ipAddress: testData.player.ipAddress,
        username: testData.player.username,
        skinHash: testData.player.skinHash
      })
    });
    
    console.log(`Status: ${loginResponse.status}`);
    const loginData = await loginResponse.json();
    console.log("Response:", JSON.stringify(loginData, null, 2));
      // Test get player profile
    console.log("\n=== Testing Get Player Profile ===");
    const profileResponse = await fetch(`http://localhost:3001/minecraft/player?minecraftUuid=${testData.player.minecraftUuid}`, {
      method: "GET",
      headers: { "X-API-Key": API_KEY }
    });
    
    console.log(`Status: ${profileResponse.status}`);
    const profileData = await profileResponse.json();
    console.log("Response:", JSON.stringify(profileData, null, 2));
      // Test create player note
    console.log("\n=== Testing Create Player Note ===");
    const noteResponse = await fetch("http://localhost:3001/minecraft/player/note/create", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
      },
      body: JSON.stringify({
        minecraftUuid: testData.player.minecraftUuid,
        minecraftStaffUuid: testData.staff.minecraftUuid,
        note: "This is a test note from the API"
      })
    });
    
    console.log(`Status: ${noteResponse.status}`);
    const noteData = await noteResponse.json();
    console.log("Response:", JSON.stringify(noteData, null, 2));
      // Test create punishment
    console.log("\n=== Testing Create Punishment ===");
    const punishmentResponse = await fetch("http://localhost:3001/minecraft/punishment/create", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
      },
      body: JSON.stringify({
        minecraftUuid: testData.player.minecraftUuid,
        minecraftStaffUuid: testData.staff.minecraftUuid,
        note: "Test punishment reason",
        typeOrdinal: 1, // Mute
        punishmentData: { 
          severity: "Regular",
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
        },
        online: true
      })
    });
    
    console.log(`Status: ${punishmentResponse.status}`);
    const punishmentData = await punishmentResponse.json();
    console.log("Response:", JSON.stringify(punishmentData, null, 2));
      // Test player logout
    console.log("\n=== Testing Player Disconnect ===");
    const disconnectResponse = await fetch("http://localhost:3001/minecraft/player/disconnect", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
      },
      body: JSON.stringify({
        minecraftUuid: testData.player.minecraftUuid
      })
    });
    
    console.log(`Status: ${disconnectResponse.status}`);
    const disconnectData = await disconnectResponse.json();
    console.log("Response:", JSON.stringify(disconnectData, null, 2));
    
    console.log("\nAll tests completed!");
    
  } catch (error) {
    console.error("Test failed:", error);
  }
}

runTests();
