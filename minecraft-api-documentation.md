# Minecraft API Routes

This document describes the API routes available for the Minecraft plugin to interact with the moderation panel.

## Base URL

All Minecraft routes are prefixed with `/minecraft/`.

## Authentication

All Minecraft API endpoints require API key authentication. Include the API key in the request headers:

```
X-API-Key: your_api_key_here
```

The API key can be configured in two ways:
1. As an environment variable: `MINECRAFT_API_KEY`
2. In the database settings with the key: `minecraft_api_key`

Requests without a valid API key will receive a `401 Unauthorized` response.

## Available Endpoints

### Player Login
- **URL:** `/minecraft/player/login`
- **Method:** `POST`
- **Request Body:**
  ```json
  {
    "minecraftUuid": "string",
    "ipAddress": "string",
    "skinHash": "string",
    "username": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 200,
    "activePunishments": [
      // Array of punishment objects
    ]
  }
  ```
- **Logic:**  - Updates player's last connection time
  - Updates IP list (adds new IP or logs to existing IP)
  - Handles ban evasion detection including:
    - Linked account detection
    - Alt account blocking
    - Restricted accounts tracking
    - New account prevention from banned IPs
  - Manages mute handling with proper start/activation
  - Starts inactive punishments when player comes online
  - Handles skin restrictions if configured
  - Returns active punishments with proper type handling

### Player Disconnect
- **URL:** `/minecraft/player/disconnect`
- **Method:** `POST`
- **Request Body:**
  ```json
  {
    "minecraftUuid": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 200,
    "message": "Player disconnect recorded successfully"
  }
  ```
- **Logic:**
  - Updates player's last disconnect time

### Create Ticket
- **URL:** `/minecraft/ticket/create`
- **Method:** `POST`
- **Request Body:**
  ```json
  {
    "minecraftUuid": "string",
    "typeOrdinal": "number"
  }
  ```
- **Response:**
  ```json
  {
    "status": 200,
    "link": "string"
  }
  ```
- **Logic:**
  - Creates a new ticket
  - Returns a link to the created ticket

### Create Punishment
- **URL:** `/minecraft/punishment/create`
- **Method:** `POST`
- **Request Body:**
  ```json
  {
    "minecraftUuid": "string",
    "minecraftStaffUuid": "string",
    "note": "string",
    "typeOrdinal": "number",
    "punishmentData": {},
    "online": "boolean"
  }
  ```
- **Response:**
  ```json
  {
    "status": 200,
    "punishment": {}
  }
  ```
- **Logic:**
  - Creates a new punishment
  - Updates player's profile
  - Starts punishment immediately if player is online (for bans) or always for mutes

### Add Player Note
- **URL:** `/minecraft/player/note/create`
- **Method:** `POST`
- **Request Body:**
  ```json
  {
    "minecraftUuid": "string",
    "minecraftStaffUuid": "string",
    "note": "string"
  }
  ```
- **Response:**
  ```json
  {
    "status": 200,
    "message": "Note added successfully"
  }
  ```
- **Logic:**
  - Updates player profile with the new note

### Get Player Profile
- **URL:** `/minecraft/player`
- **Method:** `GET`
- **Query Parameters:**
  - `minecraftUuid`: string
- **Response:**
  ```json
  {
    "status": 200,
    "profile": {
      "uuid": "string",
      "username": "string",
      "firstJoined": "date",
      "punishments": [],
      "notes": [],
      "ipHistory": []
    }
  }
  ```
- **Logic:**
  - Returns player profile information

### Get Linked Accounts
- **URL:** `/minecraft/player/linked`
- **Method:** `GET`
- **Query Parameters:**
  - `minecraftUuid`: string
- **Response:**
  ```json
  {
    "status": 200,
    "profiles": [
      {
        "uuid": "string",
        "username": "string",
        "firstJoined": "date",
        "isPunished": "boolean",
        "sharedIPs": ["string"]
      }
    ]
  }
  ```
- **Logic:**
  - Finds accounts linked through shared IP addresses

## Ban Evasion Detection

The system automatically detects and handles ban evasion through the following mechanisms:

1. **During Login**: When a player logs in, several checks are performed:
   - New IPs trigger searches for linked banned accounts
   - Alt account detection with `altBlocking` flag creates linked punishments
   - Punishments can now block new account creation from specific IPs
   - Skin and name-based restrictions are enforced if configured

2. **With Ban Options**: Several ban configuration options are available:
   - `altBlocking`: Blocks alt accounts from playing
   - `altBlockingNewAccounts`: Prevents creation of new accounts from the same IP
   - `blockedSkin`: Restricts specific player skins
   - `blockedName`: Restricts specific usernames
   - `linkedBanId` and `linkedBanExpiry`: Tracks linked punishments

3. **Through Linked Accounts Endpoint**: Staff can use the `/minecraft/player/linked` endpoint to check for potential alternate accounts
   - Helps identify relationships between accounts that might be used for ban evasion

### Testing Ban Evasion

The project includes a test script that demonstrates and validates the ban evasion detection:

```bash
# First, run the test server
npm run test:minecraft-server

# In a separate terminal, run the evasion test
npm run test:minecraft-evasion
```

The evasion test performs the following steps:
1. Registers an initial player
2. Issues a ban for that player
3. Disconnects the player
4. Attempts to login with a new player using the same IP address
5. Checks if the new player was automatically banned
6. Verifies linked account detection

## Integration Example (Java/Bukkit)

Below is a basic example of how to integrate these API endpoints into a Minecraft plugin using Java:

```java
package com.example.moderationplugin;

import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonArray;

public class ModerationPanelIntegration extends JavaPlugin implements Listener {
    private final String API_BASE_URL = "https://your-panel-url.com/minecraft";
    private final String API_KEY = "your_api_key_here";
    private final Gson gson = new Gson();
    
    @Override
    public void onEnable() {
        getServer().getPluginManager().registerEvents(this, this);
        getLogger().info("Moderation Panel Integration enabled!");
    }
    
    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        // Process this asynchronously to avoid blocking the main thread
        CompletableFuture.runAsync(() -> {
            try {
                Player player = event.getPlayer();
                String uuid = player.getUniqueId().toString();
                String username = player.getName();
                String ipAddress = player.getAddress().getAddress().getHostAddress();
                
                // Create JSON for login request
                JsonObject json = new JsonObject();
                json.addProperty("minecraftUuid", uuid);
                json.addProperty("ipAddress", ipAddress);
                json.addProperty("username", username);
                json.addProperty("skinHash", ""); // Add skin hash if needed
                
                // Make API request
                JsonObject response = makePostRequest("/player/login", json.toString());
                
                // Check for active punishments
                if (response != null && response.has("activePunishments")) {
                    JsonArray punishments = response.getAsJsonArray("activePunishments");
                    if (punishments.size() > 0) {
                        // Process punishments
                        for (int i = 0; i < punishments.size(); i++) {
                            JsonObject punishment = punishments.get(i).getAsJsonObject();
                            // Handle punishment based on type_ordinal
                            int typeOrdinal = punishment.get("type_ordinal").getAsInt();
                            if (typeOrdinal == 2) { // Ban
                                player.kickPlayer("You are banned: " + 
                                    punishment.getAsJsonArray("notes").get(0).getAsJsonObject().get("text").getAsString());
                                break;
                            }
                            if (typeOrdinal == 1) { // Mute
                                getLogger().info("Player " + username + " is currently muted");
                                // Store mute information for chat handling
                            }
                        }
                    }
                }
            } catch (Exception e) {
                getLogger().severe("Error in player login handling: " + e.getMessage());
            }
        });
    }
    
    @EventHandler
    public void onPlayerQuit(PlayerQuitEvent event) {
        // Process this asynchronously
        CompletableFuture.runAsync(() -> {
            try {
                Player player = event.getPlayer();
                String uuid = player.getUniqueId().toString();
                
                // Create JSON for disconnect request
                JsonObject json = new JsonObject();
                json.addProperty("minecraftUuid", uuid);
                
                // Make API request
                makePostRequest("/player/disconnect", json.toString());
            } catch (Exception e) {
                getLogger().severe("Error in player disconnect handling: " + e.getMessage());
            }
        });
    }
    
    // Helper method for making POST requests
    private JsonObject makePostRequest(String endpoint, String jsonData) throws Exception {
        URL url = new URL(API_BASE_URL + endpoint);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("X-API-Key", API_KEY);
        conn.setDoOutput(true);
        
        try (OutputStream os = conn.getOutputStream()) {
            byte[] input = jsonData.getBytes(StandardCharsets.UTF_8);
            os.write(input, 0, input.length);
        }
        
        if (conn.getResponseCode() < 300) {
            try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                StringBuilder response = new StringBuilder();
                String responseLine;
                while ((responseLine = br.readLine()) != null) {
                    response.append(responseLine.trim());
                }
                return gson.fromJson(response.toString(), JsonObject.class);
            }
        } else {
            getLogger().warning("API request failed with status: " + conn.getResponseCode());
            return null;
        }
    }
    
    // Similar helper for GET requests would be needed for player/linked and player endpoints
}
```
