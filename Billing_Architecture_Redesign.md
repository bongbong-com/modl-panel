# Subscription Billing System Architectural Redesign (v3)

This document outlines the architectural changes required to transition the subscription billing system from a staff-centric model to a server/workspace-centric model, supporting multi-tenancy.

## 1. Data Model Redesign

The core of this redesign is the modification of our data models to correctly associate billing information with a server/workspace instead of an individual staff member.

### 1.1. `ModlServerSchema` Modifications

The following billing-related fields will be added to the `ModlServerSchema` in `server/models/modl-global-schemas.ts`. This centralizes subscription and billing information at the server/workspace level.

```typescript
// server/models/modl-global-schemas.ts

const ModlServerSchema = new Schema({
  adminEmail: { type: String, required: true },
  serverName: { type: String, required: true, unique: true },
  customDomain: { type: String, required: true, unique: true }, // This will be the subdomain
  // ... existing fields

  // --- NEW BILLING FIELDS ---
  stripe_customer_id: { type: String, unique: true, sparse: true },
  stripe_subscription_id: { type: String, unique: true, sparse: true },
  plan_type: { 
    type: String, 
    enum: ['free', 'premium'], 
    default: 'free' 
  },
  subscription_status: { 
    type: String, 
    enum: ['active', 'canceled', 'past_due', 'inactive'], 
    default: 'inactive' 
  },
  current_period_end: { type: Date },
  // --- END NEW BILLING FIELDS ---

  provisioningStatus: { type: String, enum: ['pending', 'in-progress', 'completed', 'failed'], default: 'pending' },
  databaseName: { type: String },
  provisioningNotes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'servers' });
```

### 1.2. `staffSchema` Modifications

The billing-related fields will be **removed** from the `staffSchema` in `server/models/mongodb-schemas.ts`. Staff members will no longer hold individual subscription data.

```typescript
// server/models/mongodb-schemas.ts

const staffSchema = new Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  profilePicture: { type: String },
  role: {
    type: String,
    required: true,
    enum: ['Super Admin', 'Admin', 'Moderator', 'Helper'],
  },
  // --- REMOVED BILLING FIELDS ---
  // stripe_customer_id: { type: String },
  // stripe_subscription_id: { type: String },
  // plan_type: {
  //   type: String,
  //   enum: ['hobby', 'pro', 'enterprise'],
  // },
  // subscription_status: { type: String },
  // current_period_end: { type: Date },
  // --- END REMOVED BILLING FIELDS ---
}, { timestamps: true });
```

## 2. Architectural Outline Update

The following backend components will be updated to reflect the new server-centric billing model.

### 2.1. API Endpoints (`/api/billing/...`)

The billing API endpoints will be modified to operate on the server/workspace associated with the request.

*   **Hosting:** The billing-related API endpoints are expected to be hosted on a dedicated subdomain (e.g., `payment.modl.gg`).
*   **Identifying the Server:** The `subdomainDbMiddleware` will identify the server based on the request's subdomain and attach the full server object from the global `modl` database to the request object (e.g., `req.modlServer`).
*   **`/api/billing/create-checkout-session`:**
    *   This endpoint will retrieve the `stripe_customer_id` from the `req.modlServer` object.
    *   If `stripe_customer_id` does not exist, a new Stripe customer will be created and the ID will be saved to the server's record in the `modl-global` database.
    *   The Stripe Checkout Session will be associated with the server's customer ID.
    *   **Dynamic Redirects:** The `success_url` and `cancel_url` will be dynamically constructed to redirect the user back to their specific subdomain. The server's `customDomain` (e.g., `byteful.modl.gg`) will be retrieved from the `req.modlServer` object.
        *   `success_url`: `https://${req.modlServer.customDomain}/settings?session_id={CHECKOUT_SESSION_ID}`
        *   `cancel_url`: `https://${req.modlServer.customDomain}/settings`
*   **`/api/billing/create-portal-session`:**
    *   This endpoint will use the `stripe_customer_id` from the `req.modlServer` object to create a Stripe Billing Portal session.
    *   The `return_url` will also be dynamic: `https://${req.modlServer.customDomain}/settings`.

### 2.2. Webhook Handler (`/api/stripe-webhooks`)

The Stripe webhook handler will be updated to modify the `ModlServerSchema` instance instead of the `Staff` instance.

*   **Webhook URL:** The fully qualified webhook URL to be configured in the Stripe Dashboard will be constructed using the existing `DOMAIN` environment variable: `https://payment.${process.env.DOMAIN}/api/stripe-webhooks`.
*   **Event Handling:** The webhook handler will receive Stripe events as it currently does.
*   **`checkout.session.completed`:**
    *   The handler will use the `customer` ID from the session object to find the corresponding server in the `servers` collection of the `modl-global` database.
    *   It will update the server's `stripe_subscription_id` and set the `subscription_status` to 'active'.
*   **`customer.subscription.updated` & `customer.subscription.deleted`:**
    *   The handler will use the `subscription.id` to find the corresponding server via its `stripe_subscription_id`.
    *   It will update the server's `subscription_status`, `plan_type`, and `current_period_end` based on the data in the subscription object from the event.

### 2.3. Premium Access Middleware

The `checkPremiumAccess` middleware will be updated to check the subscription status of the server/workspace.

*   **Logic:** The middleware will inspect the `req.modlServer` object, which will be attached by an upstream middleware.
*   **Verification:** It will check `req.modlServer.plan_type` and `req.modlServer.subscription_status` to determine if the server has an active premium subscription.
*   **Access Control:** Access to premium features will be granted or denied based on the server's subscription status, not the individual user's.

## 3. Required Environment Variables

The following environment variables will be required for the billing system to function correctly:

*   `STRIPE_SECRET_KEY`: Your secret key for the Stripe API.
*   `STRIPE_WEBHOOK_SECRET`: The secret for verifying Stripe webhooks.
*   `DOMAIN`: The root domain for the service (e.g., `modl.gg`).

## 4. High-Level Diagram

This diagram illustrates the new architecture:

```mermaid
graph TD
    subgraph "Client (e.g., byteful.modl.gg)"
        A[User Action on UI] --> B{Initiates Premium Action};
    end

    subgraph "API Gateway (payment.modl.gg)"
        B --> C[/api/billing/...];
    end

    subgraph "Middleware Chain"
        C --> D[subdomainDbMiddleware];
        D --> E[auth-middleware];
        E --> F[premium-access-middleware];
    end

    subgraph "Global Database (modl-global)"
        G[servers collection];
    end
    
    subgraph "Application Logic"
        F --> H{API Endpoint Logic};
    end

    subgraph "Stripe"
        I[Stripe API];
        J[Stripe Webhooks];
    end

    D -- "1. Get subdomain from request" --> D;
    D -- "2. Find server in 'modl-global'.servers" --> G;
    D -- "3. Attach server object to req (req.modlServer)" --> E;
    
    F -- "4. Check req.modlServer.subscription_status" --> F;
    
    H -- "5. Use req.modlServer.stripe_customer_id" --> I;
    H -- "6. Generate dynamic redirect URL from req.modlServer.customDomain" --> I;
    
    J -- "7. Stripe event (e.g., subscription updated)" --> K[/api/stripe-webhooks];
    K -- "8. Find server by customer/subscription ID" --> G;
    K -- "9. Update server billing status" --> G;

    style G fill:#f9f,stroke:#333,stroke-width:2px