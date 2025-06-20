# Ticket System API - cURL Examples

This document provides comprehensive cURL examples for interacting with the MODL Panel ticket system. The system supports both authenticated admin panel requests and public API key-based requests for external integrations.

## Table of Contents

1. [Authentication](#authentication)
2. [Ticket Types Overview](#ticket-types-overview)
3. [Panel API Endpoints (Authenticated)](#panel-api-endpoints-authenticated)
4. [Public Ticket API (API Key Based)](#public-ticket-api-api-key-based)
5. [Appeal System](#appeal-system)
6. [Common Response Formats](#common-response-formats)

## Authentication

### Panel API (Session-Based)
Panel API endpoints require authentication via session cookies. These are typically used by staff members through the web interface.

### Public Ticket API (API Key-Based)
Public ticket creation endpoints require an API key in the `X-Ticket-API-Key` header. This allows external systems (like Minecraft plugins, Discord bots, or other integrations) to create tickets programmatically.

**To get an API key:**
1. Go to Settings > General tab in the admin panel
2. Navigate to the "Ticket API Key" section
3. Click "Generate API Key" to create a new key
4. Copy the key immediately (it won't be shown again)
5. Use this key in the `X-Ticket-API-Key` header for all public API requests

### API Key Usage Example
```bash
curl -X POST "https://yourserver.example.com/api/public/tickets" \
  -H "X-Ticket-API-Key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

## Ticket Types Overview

The system supports six main ticket types:

- **Bug Report** (`bug`) - For reporting software bugs
- **Player Report** (`player`) - For reporting player behavior
- **Chat Report** (`chat`) - For reporting inappropriate chat messages
- **Appeal** (`appeal`) - For appealing punishments
- **Staff Application** (`staff`) - For applying to become staff
- **General Support** (`support`) - For general help requests

## Panel API Endpoints (Authenticated)

These endpoints are used by the web panel and require authentication.

### 1. Get All Tickets

```bash
curl -X GET "https://yourserver.example.com/api/tickets" \
  -H "Cookie: your-session-cookie"
```

### 2. Get Specific Ticket

```bash
curl -X GET "https://yourserver.example.com/api/tickets/BUG-123456" \
  -H "Cookie: your-session-cookie"
```

### 3. Create Bug Report Ticket

```bash
curl -X POST "https://yourserver.example.com/api/tickets/bug" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "creatorUuid": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Response:**
```json
{
  "ticketId": "BUG-123456"
}
```

### 4. Create Player Report Ticket

```bash
curl -X POST "https://yourserver.example.com/api/tickets/player" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "creatorUuid": "550e8400-e29b-41d4-a716-446655440000",
    "reportedPlayerUuid": "550e8400-e29b-41d4-a716-446655440001"
  }'
```

**Response:**
```json
{
  "ticketId": "PLAYER-123456"
}
```

### 5. Create Chat Report Ticket

```bash
curl -X POST "https://yourserver.example.com/api/tickets/chat" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "creatorUuid": "550e8400-e29b-41d4-a716-446655440000",
    "reportedPlayerUuid": "550e8400-e29b-41d4-a716-446655440001",
    "chatMessages": [
      "BadPlayer: This is inappropriate content",
      "BadPlayer: More inappropriate content",
      "Reporter: This behavior is unacceptable"
    ]
  }'
```

**Response:**
```json
{
  "ticketId": "CHAT-123456"
}
```

### 6. Create Staff Application Ticket

```bash
curl -X POST "https://yourserver.example.com/api/tickets/staff" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "creatorUuid": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Response:**
```json
{
  "ticketId": "STAFF-123456"
}
```

### 7. Create General Support Ticket

```bash
curl -X POST "https://yourserver.example.com/api/tickets/support" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "creatorUuid": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Response:**
```json
{
  "ticketId": "SUPPORT-123456"
}
```

### 8. Submit Ticket Form (Complete Unfinished Ticket)

After creating a ticket, it starts in "Unfinished" status. Use this endpoint to submit the form data and make the ticket active:

```bash
curl -X POST "https://yourserver.example.com/api/tickets/BUG-123456/submit" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "subject": "Server crashes when using specific command",
    "formData": {
      "description": "The server crashes whenever I use the /example command",
      "steps": "1. Join the server\n2. Type /example\n3. Server crashes",
      "expected": "Command should execute normally",
      "actual": "Server crashes with error",
      "server": "Survival Server",
      "version": "1.20.4"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "ticketId": "BUG-123456",
  "ticket": {
    "id": "BUG-123456",
    "status": "Open",
    "subject": "Server crashes when using specific command"
  }
}
```

### 9. Update Ticket (Add Reply/Change Status)

```bash
curl -X PATCH "https://yourserver.example.com/api/tickets/BUG-123456" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "newReply": {
      "name": "Staff Member",
      "content": "Thank you for the report. We are investigating this issue.",
      "type": "staff",
      "created": "2024-01-15T10:30:00Z",
      "staff": true,
      "action": "Comment"
    }
  }'
```

**Available Actions for Staff Replies:**
- `Comment` - General response
- `Accepted` - Accept the report/request (closes ticket)
- `Rejected` - Reject the report/request (closes ticket)
- `Completed` - Mark as completed (closes ticket)
- `Close` - Close the ticket
- `Reopen` - Reopen a closed ticket

### 10. Add Internal Note to Ticket

```bash
curl -X POST "https://yourserver.example.com/api/tickets/BUG-123456/notes" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "text": "This appears to be related to the recent plugin update",
    "issuerName": "Admin",
    "issuerAvatar": "https://example.com/avatar.png"
  }'
```

### 11. Add Tags to Ticket

```bash
curl -X POST "https://yourserver.example.com/api/tickets/BUG-123456/tags" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "tag": "critical",
    "staffName": "Admin"
  }'
```

### 12. Remove Tags from Ticket

```bash
curl -X DELETE "https://yourserver.example.com/api/tickets/BUG-123456/tags/critical" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "staffName": "Admin"
  }'
```

## Public Ticket API (API Key Based)

These endpoints allow external systems (Minecraft plugins, Discord bots, etc.) to create tickets using API key authentication. All public ticket endpoints use the `X-Ticket-API-Key` header for authentication.

### 1. Create Bug Report Ticket

```bash
curl -X POST "https://yourserver.example.com/api/public/tickets" \
  -H "Content-Type: application/json" \
  -H "X-Ticket-API-Key: your-api-key-here" \
  -d '{
    "type": "bug",
    "subject": "Game crash when opening inventory",
    "description": "The game crashes consistently when trying to open the inventory",
    "creatorName": "PlayerName",
    "creatorUuid": "550e8400-e29b-41d4-a716-446655440000",
    "formData": {
      "version": "1.19.4",
      "mods": "Forge 43.2.14",
      "steps_to_reproduce": "1. Join server 2. Press E key 3. Game crashes"
    },
    "tags": ["bug", "critical"],
    "priority": "high"
  }'
```

### 2. Create Player Report Ticket

```bash
curl -X POST "https://yourserver.example.com/api/public/tickets" \
  -H "Content-Type: application/json" \
  -H "X-Ticket-API-Key: your-api-key-here" \
  -d '{
    "type": "player",
    "subject": "Player Report: Griefing",
    "description": "Player was griefing the spawn area",
    "creatorName": "ReporterName",
    "creatorUuid": "550e8400-e29b-41d4-a716-446655440000",
    "reportedPlayerName": "GrieferName",
    "reportedPlayerUuid": "550e8400-e29b-41d4-a716-446655440001",
    "formData": {
      "reason": "Griefing spawn area", 
      "evidence": "Screenshots available",
      "location": "x:100, y:64, z:200",
      "witness": "AnotherPlayer"
    },
    "tags": ["player", "griefing"]
  }'
```

### 3. Create Chat Report Ticket

```bash
curl -X POST "https://yourserver.example.com/api/public/tickets" \
  -H "Content-Type: application/json" \
  -H "X-Ticket-API-Key: your-api-key-here" \
  -d '{
    "type": "chat",
    "subject": "Inappropriate Chat Messages",
    "description": "Player using inappropriate language in chat",
    "creatorName": "ModeratorBot",
    "reportedPlayerName": "BadPlayer",
    "reportedPlayerUuid": "550e8400-e29b-41d4-a716-446655440001",
    "chatMessages": [
      "[2024-01-15 14:30:12] BadPlayer: inappropriate message 1",
      "[2024-01-15 14:30:25] BadPlayer: inappropriate message 2",
      "[2024-01-15 14:30:38] BadPlayer: inappropriate message 3"
    ],
    "formData": {
      "chat_channel": "global",
      "server": "survival"
    },
    "tags": ["chat", "inappropriate"]
  }'
```

### 4. Create Appeal Ticket

```bash
curl -X POST "https://yourserver.example.com/api/public/tickets" \
  -H "Content-Type: application/json" \
  -H "X-Ticket-API-Key: your-api-key-here" \
  -d '{
    "type": "appeal",
    "subject": "Ban Appeal Request",
    "description": "I believe my ban was unjustified and would like to appeal",
    "creatorName": "BannedPlayer",
    "creatorUuid": "550e8400-e29b-41d4-a716-446655440000",
    "formData": {
      "punishment_type": "Ban",
      "punishment_reason": "Griefing",
      "appeal_reason": "I did not grief anything, this was a misunderstanding",
      "evidence": "I have screenshots proving my innocence"
    },
    "tags": ["appeal", "ban"]
  }'
```

### 5. Create Staff Application

```bash
curl -X POST "https://yourserver.example.com/api/public/tickets" \
  -H "Content-Type: application/json" \
  -H "X-Ticket-API-Key: your-api-key-here" \
  -d '{
    "type": "staff",
    "subject": "Staff Application - Helper",
    "description": "Application for Helper position",
    "creatorName": "ApplicantName",
    "creatorUuid": "550e8400-e29b-41d4-a716-446655440000",
    "formData": {
      "position": "Helper",
      "age": "18",
      "timezone": "EST",
      "experience": "2 years moderating Discord servers",
      "why_join": "I want to help make the community better"
    },
    "tags": ["staff", "application", "helper"]
  }'
```

### 6. Create Support Ticket

```bash
curl -X POST "https://yourserver.example.com/api/public/tickets" \
  -H "Content-Type: application/json" \
  -H "X-Ticket-API-Key: your-api-key-here" \
  -d '{
    "type": "support",
    "subject": "Need help with account recovery",
    "description": "I lost access to my account and need help recovering it",
    "creatorName": "PlayerName",
    "formData": {
      "issue_type": "Account Recovery",
      "last_known_password": "I remember it started with 'pass...'",
      "security_question_answer": "Blue",
      "additional_info": "I can provide ID verification if needed"
    },
    "tags": ["support", "account"]
  }'
```

### 7. Check Ticket Status

```bash
curl -X GET "https://yourserver.example.com/api/public/tickets/BUG-123456/status" \
  -H "X-Ticket-API-Key: your-api-key-here"
```

**Response:**
```json
{
  "id": "BUG-123456",
  "type": "bug",
  "subject": "Game crash when opening inventory",
  "status": "Open",
  "created": "2024-01-15T14:30:00.000Z",
  "locked": false
}
```

### Success Response Format

All successful ticket creation requests return:

```json
{
  "success": true,
  "ticketId": "TYPE-123456",
  "message": "Ticket created successfully",
  "ticket": {
    "id": "TYPE-123456",
    "type": "bug",
    "subject": "Your ticket subject",
    "status": "Open",
    "created": "2024-01-15T14:30:00.000Z"
  }
}
```
    "type": "chat",
    "subject": "Inappropriate Chat",
    "reportedPlayerUuid": "550e8400-e29b-41d4-a716-446655440001",
    "reportedPlayerUsername": "BadPlayer",
    "chatMessages": [
      "[10:30:15] BadPlayer: inappropriate message 1",
      "[10:30:20] BadPlayer: inappropriate message 2",
      "[10:30:25] Reporter: Please stop"
    ]
  }'
```

### 3. Bug Report from Minecraft Plugin

```bash
curl -X POST "https://yourserver.example.com/minecraft/ticket/create" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-minecraft-api-key" \
  -d '{
    "creatorUuid": "550e8400-e29b-41d4-a716-446655440000",
    "creatorUsername": "PlayerName",
    "type": "bug",
    "subject": "Duplication Bug",
    "formData": {
      "description": "Items are duplicating when using hoppers",
      "steps": "1. Place hopper 2. Insert items 3. Items duplicate",
      "server_version": "1.20.4",
      "plugin_version": "2.1.0"
    }
  }'
```

## Appeal System

Appeals are a special type of ticket for challenging punishments.

### 1. Get All Appeals

```bash
curl -X GET "https://yourserver.example.com/api/appeals" \
  -H "Cookie: your-session-cookie"
```

### 2. Get Appeals for Specific Punishment

```bash
curl -X GET "https://yourserver.example.com/api/appeals/punishment/ban-12345" \
  -H "Cookie: your-session-cookie"
```

### 3. Get Specific Appeal

```bash
curl -X GET "https://yourserver.example.com/api/appeals/APPEAL-123456" \
  -H "Cookie: your-session-cookie"
```

### 4. Create Appeal

```bash
curl -X POST "https://yourserver.example.com/api/appeals" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "username": "BannedPlayer",
    "playerUuid": "550e8400-e29b-41d4-a716-446655440000",
    "email": "player@example.com",
    "punishmentId": "ban-12345",
    "subject": "Appeal for False Ban",
    "content": "I believe I was wrongfully banned. I was not using any cheats or exploits. I would like to request a review of my case.",
    "tags": ["urgent"]
  }'
```

**Response:**
```json
{
  "_id": "APPEAL-123456",
  "type": "appeal",
  "status": "Open",
  "created": "2024-01-15T10:00:00Z"
}
```

### 5. Reply to Appeal

```bash
curl -X POST "https://yourserver.example.com/api/appeals/APPEAL-123456/reply" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "name": "Staff Member",
    "content": "We have reviewed your case and found evidence that supports your claim.",
    "type": "staff",
    "staff": true,
    "action": "Pardon"
  }'
```

**Available Appeal Actions:**
- `Comment` - General response
- `Pardon` - Accept appeal and remove punishment
- `Reduce` - Accept appeal and reduce punishment
- `Reject` - Reject the appeal
- `Close` - Close the appeal

### 6. Update Appeal Status

```bash
curl -X PATCH "https://yourserver.example.com/api/appeals/APPEAL-123456/status" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "status": "Resolved"
  }'
```

## Common Response Formats

### Ticket Object
```json
{
  "id": "BUG-123456",
  "subject": "Server crashes when using specific command",
  "status": "Open",
  "type": "bug",
  "category": "Bug Report",
  "reportedBy": "PlayerName",
  "date": "2024-01-15T10:00:00Z",
  "locked": false,
  "formData": {
    "description": "Detailed bug description",
    "steps": "Steps to reproduce",
    "expected": "Expected behavior",
    "actual": "Actual behavior"
  },
  "messages": [
    {
      "id": "msg-1",
      "sender": "PlayerName",
      "senderType": "user",
      "content": "Initial bug report content",
      "timestamp": "2024-01-15T10:00:00Z",
      "staff": false
    }
  ],
  "notes": [
    {
      "author": "Staff Member",
      "content": "Internal note about the bug",
      "timestamp": "2024-01-15T10:30:00Z",
      "isStaffOnly": true
    }
  ],
  "tags": ["bug", "critical"]
}
```

### Appeal Object
```json
{
  "id": "APPEAL-123456",
  "banId": "ban-12345",
  "submittedOn": "2024-01-15T10:00:00Z",
  "status": "Pending Review",
  "lastUpdate": "2024-01-15T10:30:00Z",
  "messages": [
    {
      "name": "BannedPlayer",
      "content": "Appeal content",
      "type": "player",
      "created": "2024-01-15T10:00:00Z",
      "staff": false
    }
  ]
}
```

### Error Response
```json
{
  "error": "Ticket not found",
  "status": 404
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (missing required fields)
- `401` - Unauthorized (invalid API key or not logged in)
- `404` - Not Found (ticket doesn't exist)
- `500` - Internal Server Error
- `503` - Service Unavailable (database connection issues)

## Notes

1. **Ticket IDs**: All tickets use the format `TYPE-XXXXXX` where TYPE is the ticket type (BUG, PLAYER, CHAT, APPEAL, STAFF, SUPPORT) and XXXXXX is a 6-digit random number.

2. **Two-Step Process**: Creating tickets through the panel API is a two-step process:
   - First, create the ticket (returns ticket ID)
   - Then, submit the form data to activate the ticket

3. **Status Management**: Tickets can be in various states:
   - `Unfinished` - Just created, waiting for form submission
   - `Open` - Active and awaiting response
   - `Closed` - Resolved or closed
   - `Resolved` - Completed successfully

4. **Authentication**: Panel endpoints require session authentication, while Minecraft plugin endpoints require API key authentication via the `X-API-Key` header.

5. **Player UUIDs**: All player references should use Minecraft UUIDs in the standard format (e.g., `550e8400-e29b-41d4-a716-446655440000`).

6. **Rate Limiting**: Consider implementing rate limiting for public endpoints to prevent abuse.

7. **Data Validation**: All endpoints perform validation on required fields and will return 400 errors for missing or invalid data.
