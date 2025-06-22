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

## Public Ticket Access (No Authentication Required)

These endpoints allow public access to tickets without API keys, primarily used by the player ticket interface.

### View Ticket Details

```bash
# Get full ticket information
curl -X GET "https://yourserver.modl.dev/api/public/tickets/BUG-123456"
```

### Add Reply to Ticket

```bash
# Add a reply to an existing ticket
curl -X POST "https://yourserver.modl.dev/api/public/tickets/BUG-123456/replies" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PlayerName",
    "content": "This is my reply to the ticket",
    "type": "user",
    "staff": false
  }'
```

### Submit Ticket Form

```bash
# Complete an unfinished ticket by submitting the form
curl -X POST "https://yourserver.modl.dev/api/public/tickets/BUG-123456/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Bug with teleportation command",
    "formData": {
      "description": "The /tp command is not working properly",
      "steps": "1. Type /tp 100 64 100\n2. Nothing happens",
      "expected": "Should teleport to coordinates",
      "actual": "Nothing happens, no error message"
    }
  }'
```

---

## Ticket Creation (API Key Required)

### Create Complete Ticket

Create a ticket with all details immediately (status: "Open"):

```bash
curl -X POST "https://yourserver.modl.dev/api/public/tickets" \
  -H "Content-Type: application/json" \
  -H "X-Ticket-API-Key: your-ticket-api-key-here" \
  -d '{
    "type": "bug",
    "subject": "Server Crash Bug",
    "description": "Server crashes when using specific command",
    "creatorUuid": "123e4567-e89b-12d3-a456-426614174000",
    "creatorName": "PlayerName",
    "formData": {
      "description": "The /tp command is not working properly",
      "steps": "1. Type /tp 100 64 100\n2. Nothing happens",
      "expected": "Should teleport to coordinates",
      "actual": "Nothing happens, no error message"
    }
  }'
```

### Create Unfinished Ticket

Create a basic ticket that needs to be completed later (status: "Unfinished"):

```bash
curl -X POST "https://yourserver.modl.dev/api/public/tickets" \
  -H "Content-Type: application/json" \
  -H "X-Ticket-API-Key: your-ticket-api-key-here" \
  -d '{
    "type": "bug",
    "creatorUuid": "123e4567-e89b-12d3-a456-426614174000",
    "creatorName": "PlayerName"
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
- `creatorUuid`: UUID of the player creating the ticket (or "unknown-uuid" if not available)

### Optional Fields

- `subject`: Brief description of the issue (if not provided, ticket will be created as "Unfinished")
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
curl -X POST "https://123.cobl.gg/api/minecraft/player/login" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 2iTewXGvs6uIsfFxBByhrXTilcO2E9UDLc6yC7VzCw4" \
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

---

## Panel API (Authentication Required)

These endpoints are used internally by the admin panel and require user authentication via session cookies.

### List All Tickets

```bash
# Get all tickets (requires authentication)
curl -X GET "https://yourserver.modl.dev/api/panel/tickets" \
  -H "Cookie: session-cookie-here"
```

### Get Specific Ticket

```bash
# Get ticket details for panel view
curl -X GET "https://yourserver.modl.dev/api/panel/tickets/BUG-123456" \
  -H "Cookie: session-cookie-here"
```

### Add Internal Note

```bash
# Add a staff-only note to a ticket
curl -X POST "https://yourserver.modl.dev/api/panel/tickets/BUG-123456/notes" \
  -H "Content-Type: application/json" \
  -H "Cookie: session-cookie-here" \
  -d '{
    "text": "Internal note visible only to staff",
    "issuerName": "StaffMember",
    "issuerAvatar": "https://avatar-url.com/avatar.png"
  }'
```

### Add Staff Reply

```bash
# Add a reply from staff member
curl -X POST "https://yourserver.modl.dev/api/panel/tickets/BUG-123456/replies" \
  -H "Content-Type: application/json" \
  -H "Cookie: session-cookie-here" \
  -d '{
    "name": "StaffMember",
    "content": "Thank you for the report. We are investigating this issue.",
    "type": "public",
    "staff": true,
    "avatar": "https://avatar-url.com/avatar.png"
  }'
```

### Update Ticket Data

```bash
# Update ticket status, assignment, or other data
curl -X PATCH "https://yourserver.modl.dev/api/panel/tickets/BUG-123456/data" \
  -H "Content-Type: application/json" \
  -H "Cookie: session-cookie-here" \
  -d '{
    "data": {
      "status": "Closed",
      "assignedTo": "StaffMember",
      "priority": "high"
    },
    "staffName": "StaffMember"
  }'
```

### Add Tag

```bash
# Add a tag to a ticket
curl -X POST "https://yourserver.modl.dev/api/panel/tickets/BUG-123456/tags" \
  -H "Content-Type: application/json" \
  -H "Cookie: session-cookie-here" \
  -d '{
    "tag": "urgent",
    "staffName": "StaffMember"
  }'
```

### Remove Tag

```bash
# Remove a tag from a ticket
curl -X DELETE "https://yourserver.modl.dev/api/panel/tickets/BUG-123456/tags/urgent" \
  -H "Cookie: session-cookie-here"
```

### Get Tickets by Tag

```bash
# Get all tickets with a specific tag
curl -X GET "https://yourserver.modl.dev/api/panel/tickets/tag/urgent" \
  -H "Cookie: session-cookie-here"
```

### Get Tickets by Creator

```bash
# Get all tickets created by a specific user
curl -X GET "https://yourserver.modl.dev/api/panel/tickets/creator/123e4567-e89b-12d3-a456-426614174000" \
  -H "Cookie: session-cookie-here"
```

---

## Troubleshooting

### Common Issues

#### "Invalid Date" in Ticket List

If you see "Invalid Date" or "NaN years ago" in the ticket list, this indicates a data format issue. The server transforms ticket data to ensure compatibility:

- Ticket creation dates are normalized to ISO format
- Missing dates default to current timestamp
- Invalid date strings are caught and display "Invalid Date"

#### Ticket Navigation Errors

If clicking "View" on a ticket throws a JavaScript error about undefined properties:

- Ensure tickets have valid `id` fields (automatically added by server transformation)
- Check that ticket IDs don't contain invalid URL characters
- The navigation function now includes defensive checks for undefined IDs

#### 404 Errors on Panel Routes

If `/api/panel/tickets` returns 404:

- Verify the server is running and routes are properly mounted
- Check that authentication middleware is configured
- Ensure database connection is established

#### Data Format Mismatches

The server automatically transforms ticket data between different formats:

- **Server Schema**: Uses `created`, `creator`, `replies` fields
- **Client Expectation**: Expects `date`, `reportedBy`, `messages` fields
- **Transformation**: Server converts between formats automatically

#### Blank Ticket Detail Page

If the `/tickets/:id` page is blank or shows a loading state indefinitely:

- **Issue**: The ticket detail page was using the public API endpoint instead of the panel API endpoint
- **Fix**: Now uses the correct `/api/panel/tickets/:id` endpoint with authentication
- **ID Transformation**: The system correctly handles ticket ID transformations between URL-safe format and actual ticket IDs
- **Debug Info**: Added comprehensive logging to help diagnose data issues

#### Panel vs Public API Endpoints

The system has two separate API endpoints for tickets:

- **Panel API** (`/api/panel/tickets`): Used by the admin panel, requires authentication, returns transformed data for panel compatibility
- **Public API** (`/api/public/tickets`): Used by player-facing pages, requires API key for creation, supports public viewing and replies
