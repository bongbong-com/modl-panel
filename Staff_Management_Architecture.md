# Staff Management Feature: Architectural Design

This document outlines the architectural design for the new Staff Management feature, as approved.

## 1. Database Schema Design

### 1.1. `staffSchema` Update

The existing `staffSchema` in `server/models/mongodb-schemas.ts` will be updated to simplify it and add a `role` field.

**File:** `server/models/mongodb-schemas.ts`

**Changes:**
- Remove `password`, `admin`, `twoFaSecret`, `isTwoFactorEnabled`, and `passkeys` fields.
- Add a `role` field for permission management.

**Final `staffSchema` Definition:**
```typescript
const staffSchema = new Schema({
  _id: { type: String },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  profilePicture: { type: String },
  role: {
    type: String,
    required: true,
    enum: ['Super Admin', 'Admin', 'Moderator', 'Helper'],
  }
});
```

### 1.2. New `Invitation` Schema

A new schema, `Invitation`, will be created to manage staff invitations.

**New File:** `server/models/invitation-schema.ts`

**`invitationSchema` Definition:**
```typescript
import mongoose from 'mongoose';
const { Schema } = mongoose;

const invitationSchema = new Schema({
  email: { type: String, required: true, unique: true },
  role: {
    type: String,
    required: true,
    enum: ['Admin', 'Moderator', 'Helper'],
  },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted'],
    default: 'pending',
  },
});

export const Invitation = mongoose.model('Invitation', invitationSchema);
```

## 2. API Endpoint Definition

The following RESTful endpoints will be defined in `server/routes/staff-routes.ts`.

**File:** `server/routes/staff-routes.ts`

### `GET /api/staff`
- **Description:** Fetches all staff members.
- **Success Response (200):**
  ```json
  [
    {
      "_id": "...",
      "email": "admin@example.com",
      "username": "admin",
      "role": "Super Admin"
    }
  ]
  ```

### `POST /api/staff/invite`
- **Description:** Invites a new staff member by sending an email with an invitation link.
- **Request Body:**
  ```json
  {
    "email": "new.staff@example.com",
    "role": "Moderator"
  }
  ```
- **Success Response (200):**
  ```json
  {
    "message": "Invitation sent successfully to new.staff@example.com"
  }
  ```

### `DELETE /api/staff/:userId`
- **Description:** Removes a staff member from the system.
- **URL Parameter:** `userId` - The ID of the staff member to remove.
- **Success Response (200):**
  ```json
  {
    "message": "Staff member has been removed successfully."
  }
  ```

### `GET /api/staff/invitations/accept`
- **Description:** Accepts a staff invitation via a token from an email link.
- **Query Parameter:** `token` - The invitation token.
- **Success Response (200):**
  ```json
  {
    "message": "Invitation accepted. Please proceed with registration."
  }