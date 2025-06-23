# Platform REST API Documentation

This document outlines the REST API endpoints for the platform that require API key authentication. These routes are intended for use in platform adapters, such as Minecraft plugins.

## Authentication

All API requests must include an API key sent in the request headers. There are two different API keys: one for the ticket API and one for the Minecraft API.

-   **Ticket API Key**: Sent in the `X-Ticket-API-Key` header.
-   **Minecraft API Key**: Sent in the `X-API-Key` header.

---

## Ticket API

Base URL: `/api/public`

### Create a new ticket

-   **Endpoint**: `POST /tickets`
-   **Authentication**: `X-Ticket-API-Key` header required.
-   **Description**: Creates a new ticket.
-   **Request Body**:

    ```json
    {
      "creatorUuid": "string",
      "creatorName": "string",
      "type": "string",
      "subject": "string",
      "description": "string",
      "reportedPlayerUuid": "string",
      "reportedPlayerName": "string",
      "chatMessages": ["string"],
      "formData": {},
      "tags": ["string"],
      "priority": "string"
    }
    ```

### Get ticket status

-   **Endpoint**: `GET /tickets/:id/status`
-   **Authentication**: `X-Ticket-API-Key` header required.
-   **Description**: Retrieves the status of a specific ticket.
-   **URL Parameters**:
    -   `id` (string, required): The ID of the ticket.
-   **Response Body**:

    ```json
    {
      "id": "string",
      "type": "string",
      "subject": "string",
      "status": "string",
      "created": "date",
      "locked": "boolean"
    }
    ```

---

## Minecraft API

Base URL: `/api/minecraft`

### Player Login

-   **Endpoint**: `POST /player/login`
-   **Authentication**: `X-API-Key` header required.
-   **Description**: Handles player login, updates player data, and checks for punishments.
-   **Request Body**:

    ```json
    {
      "minecraftUuid": "string",
      "username": "string",
      "ipAddress": "string",
      "skinHash": "string",
      "ipInfo": {}
    }
    ```

### Player Disconnect

-   **Endpoint**: `POST /player/disconnect`
-   **Authentication**: `X-API-Key` header required.
-   **Description**: Handles player disconnect and updates their last disconnect time.
-   **Request Body**:

    ```json
    {
      "minecraftUuid": "string"
    }
    ```

### Create Ticket

-   **Endpoint**: `POST /ticket/create`
-   **Authentication**: `X-API-Key` header required.
-   **Description**: Creates a new ticket from within the Minecraft environment.
-   **Request Body**:

    ```json
    {
      "creatorUuid": "string",
      "creatorUsername": "string",
      "type": "string",
      "subject": "string",
      "reportedPlayerUuid": "string",
      "reportedPlayerUsername": "string",
      "chatMessages": ["string"],
      "formData": {}
    }
    ```

### Create Punishment

-   **Endpoint**: `POST /punishment/create`
-   **Authentication**: `X-API-Key` header required.
-   **Description**: Creates a new punishment for a player.
-   **Request Body**:

    ```json
    {
      "targetUuid": "string",
      "issuerName": "string",
      "typeOrdinal": "number",
      "reason": "string",
      "duration": "number",
      "data": {},
      "notes": [],
      "attachedTicketIds": []
    }
    ```

### Create Player Note

-   **Endpoint**: `POST /player/note/create`
-   **Authentication**: `X-API-Key` header required.
-   **Description**: Adds a note to a player's profile.
-   **Request Body**:

    ```json
    {
      "targetUuid": "string",
      "issuerName": "string",
      "text": "string"
    }
    ```

### Get Player Profile

-   **Endpoint**: `GET /player`
-   **Authentication**: `X-API-Key` header required.
-   **Description**: Retrieves a player's profile information.
-   **Query Parameters**:
    -   `minecraftUuid` (string, required): The Minecraft UUID of the player.
-   **Response Body**:

    ```json
    {
      "status": 200,
      "player": {
        "_id": "string",
        "minecraftUuid": "string",
        "usernames": [
          {
            "username": "string",
            "date": "date"
          }
        ],
        "notes": [
          {
            "text": "string",
            "date": "date",
            "issuerName": "string",
            "issuerId": "string"
          }
        ],
        "ipList": [
          {
            "ipAddress": "string",
            "country": "string",
            "region": "string",
            "asn": "string",
            "proxy": "boolean",
            "firstLogin": "date",
            "logins": ["date"]
          }
        ],
        "punishments": [
          {
            "id": "string",
            "issuerName": "string",
            "issued": "date",
            "started": "date",
            "type_ordinal": "number",
            "modifications": [
              {
                "type": "string",
                "issuerName": "string",
                "issued": "date",
                "effectiveDuration": "number"
              }
            ],
            "notes": [
              {
                "text": "string",
                "date": "date",
                "issuerName": "string",
                "issuerId": "string"
              }
            ],
            "attachedTicketIds": ["string"],
            "data": {}
          }
        ],
        "pendingNotifications": ["string"],
        "data": {}
      }
    }
    ```

### Get Linked Accounts

-   **Endpoint**: `GET /player/linked`
-   **Authentication**: `X-API-Key` header required.
-   **Description**: Retrieves accounts linked by IP address to a specific player.
-   **Query Parameters**:
    -   `minecraftUuid` (string, required): The Minecraft UUID of the player.
-   **Response Body**:

    ```json
    {
      "status": 200,
      "linkedAccounts": [
        {
          "minecraftUuid": "string",
          "username": "string",
          "activeBans": "number",
          "activeMutes": "number"
        }
      ]
    }
    ```