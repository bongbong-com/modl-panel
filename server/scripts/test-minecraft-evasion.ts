/**
 * Test Client for Minecraft API Routes with Ban Evasion Detection Test
 * 
 * This script tests the ban evasion detection by creating two accounts with the same IP,
 * banning one, and then logging in with the other.
 */

// API key for testing - in a real environment, this would be securely stored
const API_KEY = process.env.MINECRAFT_API_KEY || 'development-test-key';

// Sample test data
const testData = {
  originalPlayer: {
    minecraftUuid: "550e8400-e29b-41d4-a716-446655440000",
    username: "OriginalPlayer",
    ipAddress: "192.168.1.1",
    skinHash: "abcdef1234567890"
  },
  evadingPlayer: {
    minecraftUuid: "550e8400-e29b-41d4-a716-446655440002",
    username: "EvadingPlayer",
    ipAddress: "192.168.1.1", // Same IP address as originalPlayer
    skinHash: "abcdef1234567899"
  },
  staff: {
    minecraftUuid: "550e8400-e29b-41d4-a716-446655440001",
    username: "StaffMember"
  }
};

async function runEvasionTest() {
  console.log("Starting Ban Evasion Detection Test...");
  
  try {
    // Step 1: Register the original player
    console.log("\n=== Step 1: Register Original Player ===");
    const originalPlayerLogin = await fetch("http://localhost:3001/minecraft/player/login", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
      },
      body: JSON.stringify({
        minecraftUuid: testData.originalPlayer.minecraftUuid,
        ipAddress: testData.originalPlayer.ipAddress,
        username: testData.originalPlayer.username,
        skinHash: testData.originalPlayer.skinHash
      })
    });
    
    console.log(`Status: ${originalPlayerLogin.status}`);
    const originalLoginData = await originalPlayerLogin.json();
    console.log("Original player registered:", JSON.stringify(originalLoginData, null, 2));
    
    // Step 2: Ban the original player
    console.log("\n=== Step 2: Ban Original Player ===");
    const banResponse = await fetch("http://localhost:3001/minecraft/punishment/create", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
      },
      body: JSON.stringify({
        minecraftUuid: testData.originalPlayer.minecraftUuid,
        minecraftStaffUuid: testData.staff.minecraftUuid,
        note: "Test ban reason",
        typeOrdinal: 2, // Ban
        punishmentData: { 
          active: true,
          permanentBan: true,
          severity: "Severe"
        },
        online: true
      })
    });
    
    console.log(`Status: ${banResponse.status}`);
    const banData = await banResponse.json();
    console.log("Ban created:", JSON.stringify(banData, null, 2));
    
    // Step 3: Make the original player disconnect
    console.log("\n=== Step 3: Disconnect Original Player ===");
    await fetch("http://localhost:3001/minecraft/player/disconnect", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
      },
      body: JSON.stringify({
        minecraftUuid: testData.originalPlayer.minecraftUuid
      })
    });
    
    // Step 4: Attempt to login with evading player (should trigger evasion detection)
    console.log("\n=== Step 4: Login with Evading Player (should detect evasion) ===");
    const evadingPlayerLogin = await fetch("http://localhost:3001/minecraft/player/login", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
      },
      body: JSON.stringify({
        minecraftUuid: testData.evadingPlayer.minecraftUuid,
        ipAddress: testData.evadingPlayer.ipAddress,
        username: testData.evadingPlayer.username,
        skinHash: testData.evadingPlayer.skinHash
      })
    });
    
    console.log(`Status: ${evadingPlayerLogin.status}`);
    const evadingLoginData = await evadingPlayerLogin.json();
    console.log("Evading player login result:", JSON.stringify(evadingLoginData, null, 2));
    
    // Step 5: Check evading player's profile to see if they got auto-banned
    console.log("\n=== Step 5: Check Evading Player's Profile ===");
    const profileResponse = await fetch(`http://localhost:3001/minecraft/player?minecraftUuid=${testData.evadingPlayer.minecraftUuid}`, {
      method: "GET",
      headers: { "X-API-Key": API_KEY }
    });
    
    console.log(`Status: ${profileResponse.status}`);
    const profileData = await profileResponse.json();
    console.log("Evading player's profile:", JSON.stringify(profileData, null, 2));
    
    // Step 6: Check linked accounts
    console.log("\n=== Step 6: Check Linked Accounts ===");
    const linkedResponse = await fetch(`http://localhost:3001/minecraft/player/linked?minecraftUuid=${testData.evadingPlayer.minecraftUuid}`, {
      method: "GET",
      headers: { "X-API-Key": API_KEY }
    });
    
    console.log(`Status: ${linkedResponse.status}`);
    const linkedData = await linkedResponse.json();
    console.log("Linked accounts:", JSON.stringify(linkedData, null, 2));
    
    console.log("\nBan Evasion Detection Test completed!");
    
  } catch (error) {
    console.error("Test failed:", error);
  }
}

runEvasionTest();
