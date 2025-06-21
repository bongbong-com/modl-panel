# API Examples - cURL Requests

This document provides example cURL requests for common API operations in the MODL Panel system.

## Authentication

The API uses different authentication methods for different endpoints:

- **Minecraft API**: Uses `X-API-Key` header
- **Ticket API**: Uses `X-Ticket-API-Key` header

Make sure your API keys are properly configured in your server settings before using these endpoints.

## Base URL

Replace `yourserver.modl.dev` with your actual server subdomain in all examples below.

---

## Ticket Creation

### Simple Ticket Creation (Minimal Data)

Create a basic ticket that can be filled out with additional details later through the web interface.

```bash
curl -X POST "https://123.cobl.gg/api/tickets/bug" \
  -H "Content-Type: application/json" \
  -H "X-Ticket-API-Key: your-ticket-api-key-here" \
  -d '{
    "creatorUuid": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

### Complete Ticket Examples

For more detailed ticket creation with full form data:

```bash
# Detailed player report with chat evidence
curl -X POST "https://yourserver.modl.dev/api/public/tickets" \
  -H "Content-Type: application/json" \
  -H "X-Ticket-API-Key: your-ticket-api-key-here" \
  -d '{
    "type": "chat",
    "subject": "Inappropriate Language Report",
    "description": "Player using offensive language in chat",
    "creatorUuid": "123e4567-e89b-12d3-a456-426614174000",
    "creatorName": "ReporterPlayer",
    "reportedPlayerUuid": "987fcdeb-51d2-43a8-b456-123456789abc",
    "reportedPlayerName": "OffensivePlayer",
    "chatMessages": [
      "[2025-06-20 14:30:15] <OffensivePlayer> inappropriate message here",
      "[2025-06-20 14:30:22] <OffensivePlayer> another offensive message"
    ],
    "tags": ["chat", "harassment"],
    "priority": "medium"
  }'
```

```bash
# Bug report with form data
curl -X POST "https://yourserver.modl.dev/api/public/tickets" \
  -H "Content-Type: application/json" \
  -H "X-Ticket-API-Key: your-ticket-api-key-here" \
  -d '{
    "type": "bug",
    "subject": "Server Crash Bug",
    "description": "Server crashes when using specific command",
    "creatorName": "AdminUser",
    "tags": ["bug", "crash", "critical"],
    "priority": "high",
    "formData": {
      "reproduction_steps": "1. Run /tp command with coordinates\n2. Server crashes immediately",
      "error_message": "java.lang.NullPointerException",
      "server_version": "1.20.1",
      "plugins_installed": "WorldEdit, Essentials, LuckPerms"
    }
  }'
```

### Supported Ticket Types

- `bug` - Bug reports
- `player` - Player reports (requires `reportedPlayerUuid` or `reportedPlayerName`)
- `chat` - Chat reports (requires `reportedPlayerUuid` and `chatMessages`)
- `appeal` - Ban/punishment appeals
- `staff` - Staff applications
- `support` - General support requests

### Required Fields

- `type`: Ticket type (see above)
- `subject`: Brief description of the issue

### Optional Fields

- `creatorUuid`: UUID of the player creating the ticket
- `creatorName`: Name of the player creating the ticket
- `description`: Detailed description of the issue
- `reportedPlayerUuid`: UUID of reported player (required for player/chat reports)
- `reportedPlayerName`: Name of reported player
- `chatMessages`: Array of chat messages (required for chat reports)
- `formData`: Object containing additional form fields
- `tags`: Array of tags for categorization
- `priority`: `low`, `medium`, or `high`

---

## Minecraft API

### Player Login (Create/Update Player)

This endpoint handles player logins and automatically creates new player records if they don't exist.

```bash
# New player login (creates player record)
curl -X POST "https://yourserver.modl.dev/minecraft/player/login" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-minecraft-api-key-here" \
  -d '{
    "minecraftUuid": "123e4567-e89b-12d3-a456-426614174000",
    "username": "NewPlayer123",
    "ipAddress": "192.168.1.100",
    "skinHash": "a1b2c3d4e5f6789",
    "ipInfo": {
      "countryCode": "US",
      "regionName": "California",
      "city": "Los Angeles",
      "as": "AS15169 Google LLC",
      "proxy": false,
      "hosting": false
    }
  }'
```

```bash
# Existing player login (minimal data)
curl -X POST "https://yourserver.modl.dev/minecraft/player/login" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-minecraft-api-key-here" \
  -d '{
    "minecraftUuid": "123e4567-e89b-12d3-a456-426614174000",
    "username": "ExistingPlayer",
    "ipAddress": "192.168.1.100"
  }'
```

### Required Fields

- `minecraftUuid`: Player's Minecraft UUID
- `username`: Player's current username
- `ipAddress`: Player's IP address

### Optional Fields

- `skinHash`: Hash of the player's current skin
- `ipInfo`: Object containing IP geolocation data
  - `countryCode`: 2-letter country code
  - `regionName`: State/region name
  - `city`: City name
  - `as`: ISP/AS information
  - `proxy`: Boolean indicating if IP is a proxy
  - `hosting`: Boolean indicating if IP is a hosting service

### Response

The login endpoint returns active punishments (if any) for the player:

```json
{
  "status": 200,
  "activePunishments": [
    {
      "id": "abc123",
      "type_ordinal": 1,
      "issuerName": "AdminUser",
      "issued": "2025-06-20T10:00:00.000Z",
      "started": "2025-06-20T10:00:00.000Z",
      "data": {
        "reason": "Inappropriate language",
        "duration": 3600000
      }
    }
  ]
}
```

**Punishment Types:**
- `1`: Mute
- `2`: Ban

---

## Utility Endpoints

### Check Ticket Status

```bash
# Check if a ticket was created successfully
curl -X GET "https://yourserver.modl.dev/api/public/tickets/PLAYER-123456/status" \
  -H "X-Ticket-API-Key: your-ticket-api-key-here"
```

---

## Error Responses

### Common Error Codes

- `400`: Bad Request - Missing required fields or invalid data
- `401`: Unauthorized - Invalid or missing API key
- `404`: Not Found - Resource doesn't exist
- `500`: Internal Server Error - Server-side error
- `503`: Service Unavailable - Database connection issues

### Example Error Response

```json
{
  "error": "Bad request",
  "message": "Type and subject are required fields"
}
```

---

## Development Mode

If you're running in development mode, you can skip API authentication by setting:

```bash
export NODE_ENV=development
export SKIP_API_AUTH=true
```

**Note:** Never use this in production environments.

---

## API Key Configuration

API keys are configured in your server settings:

1. **Minecraft API Key**: Set in server settings as `minecraft_api_key`
2. **Ticket API Key**: Set in server settings as `ticket_api_key`

These can also be overridden with environment variables:
- `MINECRAFT_API_KEY`
- `TICKET_API_KEY`
