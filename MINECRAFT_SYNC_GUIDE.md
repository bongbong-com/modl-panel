# Minecraft Server Sync Implementation Guide

This guide shows how to implement the polling system in your Minecraft server plugin to sync with the MODL Panel API.

## Overview

The sync system works by:
1. **Polling every 5 seconds** to get new punishments and sync player status
2. **Sending online player data** to keep the panel updated
3. **Receiving punishment updates** and applying them on the server
4. **Acknowledging punishment execution** back to the panel

**Important**: Punishments are not considered "started" until your server acknowledges their execution. This prevents expiry countdowns from beginning before the punishment is actually applied, and implements a stacking system where only the oldest unstarted ban and mute are sent to avoid overwhelming the server.

## API Endpoints

### 1. Sync Endpoint (Called every 5 seconds)
- **URL**: `POST /api/minecraft/sync`
- **Purpose**: Get pending punishments and update online players

### 2. Acknowledge Endpoint  
- **URL**: `POST /api/minecraft/punishment/acknowledge`
- **Purpose**: Confirm punishment was executed successfully

## Java Implementation

### 1. Main Sync Service Class

```java
package com.yourplugin.sync;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitRunnable;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;

public class ModlSyncService {
    private final JavaPlugin plugin;
    private final String apiBaseUrl;
    private final String apiKey;
    private final HttpClient httpClient;
    private final Gson gson;
    private String lastSyncTimestamp;
    
    public ModlSyncService(JavaPlugin plugin, String apiBaseUrl, String apiKey) {
        this.plugin = plugin;
        this.apiBaseUrl = apiBaseUrl;
        this.apiKey = apiKey;
        this.httpClient = HttpClient.newHttpClient();
        this.gson = new Gson();
        this.lastSyncTimestamp = Instant.now().toString();
    }
    
    /**
     * Start the sync task - runs every 5 seconds
     */
    public void startSyncTask() {
        new BukkitRunnable() {
            @Override
            public void run() {
                syncWithPanel();
            }
        }.runTaskTimerAsynchronously(plugin, 0L, 100L); // 100 ticks = 5 seconds
    }
    
    /**
     * Main sync method - called every 5 seconds
     */
    private void syncWithPanel() {
        try {
            // Prepare sync data
            JsonObject syncData = new JsonObject();
            syncData.addProperty("lastSyncTimestamp", lastSyncTimestamp);
            syncData.add("onlinePlayers", getOnlinePlayersData());
            syncData.add("serverStatus", getServerStatus());
            
            // Make API call
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(apiBaseUrl + "/api/minecraft/sync"))
                .header("Content-Type", "application/json")
                .header("X-API-Key", apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(syncData)))
                .build();
                
            CompletableFuture<HttpResponse<String>> future = httpClient.sendAsync(
                request, HttpResponse.BodyHandlers.ofString()
            );
            
            future.thenAccept(response -> {
                if (response.statusCode() == 200) {
                    handleSyncResponse(response.body());
                } else {
                    plugin.getLogger().warning("Sync failed with status: " + response.statusCode());
                }
            }).exceptionally(throwable -> {
                plugin.getLogger().severe("Sync error: " + throwable.getMessage());
                return null;
            });
            
        } catch (Exception e) {
            plugin.getLogger().severe("Error during sync: " + e.getMessage());
        }
    }
    
    /**
     * Get online players data for sync
     */
    private JsonArray getOnlinePlayersData() {
        JsonArray onlinePlayers = new JsonArray();
        
        for (Player player : Bukkit.getOnlinePlayers()) {
            JsonObject playerData = new JsonObject();
            playerData.addProperty("uuid", player.getUniqueId().toString());
            playerData.addProperty("username", player.getName());
            playerData.addProperty("ipAddress", player.getAddress().getAddress().getHostAddress());
            onlinePlayers.add(playerData);
        }
        
        return onlinePlayers;
    }
    
    /**
     * Get server status information
     */
    private JsonObject getServerStatus() {
        JsonObject status = new JsonObject();
        status.addProperty("onlinePlayerCount", Bukkit.getOnlinePlayers().size());
        status.addProperty("maxPlayers", Bukkit.getMaxPlayers());
        status.addProperty("serverVersion", Bukkit.getVersion());
        status.addProperty("timestamp", Instant.now().toString());
        return status;
    }
    
    /**
     * Handle response from sync API
     */
    private void handleSyncResponse(String responseBody) {
        try {
            JsonObject response = gson.fromJson(responseBody, JsonObject.class);
            
            // Update last sync timestamp
            this.lastSyncTimestamp = response.get("timestamp").getAsString();
            
            JsonObject data = response.getAsJsonObject("data");
            
            // Process pending punishments
            if (data.has("pendingPunishments")) {
                JsonArray pendingPunishments = data.getAsJsonArray("pendingPunishments");
                for (JsonElement element : pendingPunishments) {
                    processPendingPunishment(element.getAsJsonObject());
                }
            }
            
            // Process recently started punishments
            if (data.has("recentlyStartedPunishments")) {
                JsonArray recentPunishments = data.getAsJsonArray("recentlyStartedPunishments");
                for (JsonElement element : recentPunishments) {
                    processStartedPunishment(element.getAsJsonObject());
                }
            }
            
            // Process punishment modifications (pardons, etc.)
            if (data.has("recentlyModifiedPunishments")) {
                JsonArray modifiedPunishments = data.getAsJsonArray("recentlyModifiedPunishments");
                for (JsonElement element : modifiedPunishments) {
                    processPunishmentModification(element.getAsJsonObject());
                }
            }
            
        } catch (Exception e) {
            plugin.getLogger().severe("Error handling sync response: " + e.getMessage());
        }
    }
    
    /**
     * Process a pending punishment that needs to be executed
     */
    private void processPendingPunishment(JsonObject punishmentData) {
        try {
            String playerUuid = punishmentData.get("minecraftUuid").getAsString();
            String username = punishmentData.get("username").getAsString();
            JsonObject punishment = punishmentData.getAsJsonObject("punishment");
            
            String punishmentId = punishment.get("id").getAsString();
            int type = punishment.get("type").getAsInt();
            String reason = punishment.has("reason") ? punishment.get("reason").getAsString() : "No reason provided";
            boolean silent = punishment.has("silent") && punishment.get("silent").getAsBoolean();
            
            // Execute punishment on main thread
            Bukkit.getScheduler().runTask(plugin, () -> {
                boolean success = executePunishment(playerUuid, username, type, reason, punishment, silent);
                
                // CRITICAL: Acknowledge execution back to panel
                // This starts the punishment timer and marks it as active
                acknowledgePunishmentExecution(punishmentId, playerUuid, success, null);
            });
            
        } catch (Exception e) {
            plugin.getLogger().severe("Error processing pending punishment: " + e.getMessage());
        }
    }
    
    /**
     * Process a recently started punishment
     */
    private void processStartedPunishment(JsonObject punishmentData) {
        // Similar to processPendingPunishment but for punishments that were just started
        processPendingPunishment(punishmentData);
    }
    
    /**
     * Process punishment modifications (pardons, duration changes)
     */
    private void processPunishmentModification(JsonObject modificationData) {
        try {
            String playerUuid = modificationData.get("minecraftUuid").getAsString();
            String username = modificationData.get("username").getAsString();
            JsonObject punishment = modificationData.getAsJsonObject("punishment");
            JsonArray modifications = punishment.getAsJsonArray("modifications");
            
            for (JsonElement modElement : modifications) {
                JsonObject modification = modElement.getAsJsonObject();
                String modificationType = modification.get("type").getAsString();
                
                Bukkit.getScheduler().runTask(plugin, () -> {
                    switch (modificationType) {
                        case "MANUAL_PARDON":
                        case "APPEAL_ACCEPT":
                            handlePardon(playerUuid, username, punishment.get("id").getAsString());
                            break;
                        case "MANUAL_DURATION_CHANGE":
                        case "APPEAL_DURATION_CHANGE":
                            handleDurationChange(playerUuid, username, modification);
                            break;
                        default:
                            plugin.getLogger().info("Unknown modification type: " + modificationType);
                    }
                });
            }
            
        } catch (Exception e) {
            plugin.getLogger().severe("Error processing punishment modification: " + e.getMessage());
        }
    }
    
    /**
     * Execute a punishment on the server
     */
    private boolean executePunishment(String playerUuid, String username, int type, String reason, JsonObject punishment, boolean silent) {
        try {
            UUID uuid = UUID.fromString(playerUuid);
            Player player = Bukkit.getPlayer(uuid);
            
            switch (type) {
                case 0: // Kick
                    if (player != null && player.isOnline()) {
                        player.kickPlayer(reason);
                        if (!silent) {
                            broadcastPunishment("kick", username, reason);
                        }
                    }
                    return true;
                    
                case 1: // Manual Mute
                    return executeMute(uuid, username, reason, punishment, silent);
                    
                case 2: // Manual Ban
                case 3: // Security Ban
                case 4: // Linked Ban
                case 5: // Blacklist
                    return executeBan(uuid, username, reason, punishment, silent);
                    
                default:
                    plugin.getLogger().warning("Unknown punishment type: " + type);
                    return false;
            }
        } catch (Exception e) {
            plugin.getLogger().severe("Error executing punishment: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Execute a mute punishment
     */
    private boolean executeMute(UUID uuid, String username, String reason, JsonObject punishment, boolean silent) {
        try {
            // Calculate expiry time
            long duration = punishment.has("duration") ? punishment.get("duration").getAsLong() : -1;
            Date expiryDate = null;
            
            if (duration > 0) {
                expiryDate = new Date(System.currentTimeMillis() + duration);
            }
            
            // Add to your mute system (replace with your actual mute implementation)
            // Examples:
            // YourMuteManager.addMute(uuid, reason, expiryDate);
            // LuckPerms: addPermission(uuid, "group.muted");
            // EssentialsX: getUser(uuid).setMuted(true);
            
            if (!silent) {
                String durationText = (duration > 0) ? formatDuration(duration) : "permanently";
                broadcastPunishment("mute", username, reason + " (" + durationText + ")");
            }
            
            return true;
        } catch (Exception e) {
            plugin.getLogger().severe("Error executing mute: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Execute a ban punishment
     */
    private boolean executeBan(UUID uuid, String username, String reason, JsonObject punishment, boolean silent) {
        try {
            // Calculate expiry time
            long duration = punishment.has("duration") ? punishment.get("duration").getAsLong() : -1;
            Date expiryDate = null;
            
            if (duration > 0) {
                expiryDate = new Date(System.currentTimeMillis() + duration);
            }
            
            // Add to your ban system (replace with your actual ban implementation)
            // Examples:
            // Bukkit.getBanList(BanList.Type.NAME).addBan(username, reason, expiryDate, "MODL Panel");
            // YourBanManager.addBan(uuid, reason, expiryDate);
            
            // Kick player if online
            Player player = Bukkit.getPlayer(uuid);
            if (player != null && player.isOnline()) {
                player.kickPlayer("You have been banned: " + reason);
            }
            
            if (!silent) {
                String durationText = (duration > 0) ? formatDuration(duration) : "permanently";
                broadcastPunishment("ban", username, reason + " (" + durationText + ")");
            }
            
            return true;
        } catch (Exception e) {
            plugin.getLogger().severe("Error executing ban: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Handle punishment pardon
     */
    private void handlePardon(String playerUuid, String username, String punishmentId) {
        try {
            UUID uuid = UUID.fromString(playerUuid);
            
            // Remove from your punishment systems
            // YourMuteManager.removeMute(uuid);
            // YourBanManager.removeBan(uuid);
            // Bukkit.getBanList(BanList.Type.NAME).pardon(username);
            
            plugin.getLogger().info("Pardoned punishment " + punishmentId + " for " + username);
        } catch (Exception e) {
            plugin.getLogger().severe("Error handling pardon: " + e.getMessage());
        }
    }
    
    /**
     * Handle punishment duration change
     */
    private void handleDurationChange(String playerUuid, String username, JsonObject modification) {
        try {
            UUID uuid = UUID.fromString(playerUuid);
            long newDuration = modification.get("effectiveDuration").getAsLong();
            
            // Update duration in your punishment systems
            // This depends on your specific punishment implementation
            
            plugin.getLogger().info("Updated punishment duration for " + username + " to " + formatDuration(newDuration));
        } catch (Exception e) {
            plugin.getLogger().severe("Error handling duration change: " + e.getMessage());
        }
    }
    
    /**
     * Acknowledge punishment execution to the panel
     */
    private void acknowledgePunishmentExecution(String punishmentId, String playerUuid, boolean success, String errorMessage) {
        try {
            JsonObject ackData = new JsonObject();
            ackData.addProperty("punishmentId", punishmentId);
            ackData.addProperty("playerUuid", playerUuid);
            ackData.addProperty("executedAt", Instant.now().toString());
            ackData.addProperty("success", success);
            if (!success && errorMessage != null) {
                ackData.addProperty("errorMessage", errorMessage);
            }
            
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(apiBaseUrl + "/api/minecraft/punishment/acknowledge"))
                .header("Content-Type", "application/json")
                .header("X-API-Key", apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(gson.toJson(ackData)))
                .build();
                
            httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenAccept(response -> {
                    if (response.statusCode() != 200) {
                        plugin.getLogger().warning("Failed to acknowledge punishment: " + response.statusCode());
                    }
                });
                
        } catch (Exception e) {
            plugin.getLogger().severe("Error acknowledging punishment: " + e.getMessage());
        }
    }
    
    /**
     * Broadcast punishment message to server
     */
    private void broadcastPunishment(String action, String username, String reason) {
        String message = String.format("§c%s has been %sed: §f%s", username, action, reason);
        Bukkit.broadcastMessage(message);
    }
    
    /**
     * Format duration in milliseconds to human readable string
     */
    private String formatDuration(long durationMs) {
        if (durationMs <= 0) return "permanently";
        
        long seconds = durationMs / 1000;
        long minutes = seconds / 60;
        long hours = minutes / 60;
        long days = hours / 24;
        
        if (days > 0) {
            return days + " day" + (days > 1 ? "s" : "");
        } else if (hours > 0) {
            return hours + " hour" + (hours > 1 ? "s" : "");
        } else if (minutes > 0) {
            return minutes + " minute" + (minutes > 1 ? "s" : "");
        } else {
            return seconds + " second" + (seconds > 1 ? "s" : "");
        }
    }
}
```

### 2. Plugin Main Class Integration

```java
package com.yourplugin;

import com.yourplugin.sync.ModlSyncService;
import org.bukkit.plugin.java.JavaPlugin;

public class YourMainPlugin extends JavaPlugin {
    private ModlSyncService syncService;
    
    @Override
    public void onEnable() {
        // Load config
        saveDefaultConfig();
        
        String apiBaseUrl = getConfig().getString("modl-panel.api-url", "https://yourserver.modl.io");
        String apiKey = getConfig().getString("modl-panel.api-key");
        
        if (apiKey == null || apiKey.isEmpty()) {
            getLogger().severe("MODL Panel API key not configured! Please set modl-panel.api-key in config.yml");
            getServer().getPluginManager().disablePlugin(this);
            return;
        }
        
        // Initialize sync service
        syncService = new ModlSyncService(this, apiBaseUrl, apiKey);
        syncService.startSyncTask();
        
        getLogger().info("MODL Panel sync service started");
    }
    
    @Override
    public void onDisable() {
        getLogger().info("MODL Panel sync service stopped");
    }
}
```

### 3. Configuration File (config.yml)

```yaml
# MODL Panel Integration Configuration
modl-panel:
  # Your MODL Panel API base URL
  api-url: "https://yourserver.modl.io"
  
  # Your Minecraft API key (get this from your MODL Panel settings)
  api-key: "your-api-key-here"
  
  # Sync settings
  sync:
    # How often to sync (in seconds) - default is 5 seconds
    interval: 5
    
    # Enable/disable broadcasting of punishments
    broadcast-punishments: true
    
    # Enable/disable silent punishment support
    support-silent-punishments: true
```

### 4. Maven Dependencies (pom.xml)

```xml
<dependencies>
    <!-- Bukkit/Spigot API -->
    <dependency>
        <groupId>org.spigotmc</groupId>
        <artifactId>spigot-api</artifactId>
        <version>1.20.1-R0.1-SNAPSHOT</version>
        <scope>provided</scope>
    </dependency>
    
    <!-- Gson for JSON handling -->
    <dependency>
        <groupId>com.google.code.gson</groupId>
        <artifactId>gson</artifactId>
        <version>2.10.1</version>
    </dependency>
</dependencies>
```

## Integration with Existing Punishment Systems

### LuckPerms Integration
```java
// Add mute permission
LuckPermsApi.getUser(uuid).data().add(Node.builder("group.muted").build());

// Remove mute permission  
LuckPermsApi.getUser(uuid).data().remove(Node.builder("group.muted").build());
```

### EssentialsX Integration
```java
// Mute player
User user = ess.getUser(uuid);
user.setMuted(true);
user.setMuteTimeout(expiryTime);

// Unmute player
user.setMuted(false);
user.setMuteTimeout(0);
```

### Vanilla Bukkit Ban System
```java
// Ban player
BanList banList = Bukkit.getBanList(BanList.Type.NAME);
banList.addBan(username, reason, expiryDate, "MODL Panel");

// Unban player
banList.pardon(username);
```

## Setup Instructions

1. **Get API Key**: Go to your MODL Panel → Settings → API Keys → Create Minecraft API Key
2. **Add to config.yml**: Set your API URL and API key
3. **Build and install** the plugin on your server
4. **Restart server** to activate the sync service
5. **Test**: Apply a punishment from the panel and verify it executes on the server

## Troubleshooting

- **Check logs** for connection errors or API failures
- **Verify API key** is correct and has proper permissions
- **Check network connectivity** between server and panel
- **Monitor sync frequency** - don't set it too low to avoid rate limiting

The sync system will automatically handle all punishment types and keep your server and panel in perfect sync!