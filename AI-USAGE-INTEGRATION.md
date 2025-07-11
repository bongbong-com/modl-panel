# AI Usage Tracking & Billing Integration Guide

## Overview

This system implements AI usage tracking with the following limits and pricing:
- **Free users**: 0 AI requests (AI features disabled)
- **Premium users**: 1000 AI requests/month included + overage at $0.01/request
- **Audit logging**: All AI requests are logged for audit and billing purposes

## System Components

### 1. AI Usage Tracking Service
- **File**: `server/services/storage-settings-service.ts`
- **Purpose**: Log AI requests and calculate usage/costs
- **Key functions**:
  - `logAIRequest()` - Log individual AI requests by service type
  - `getCurrentMonthAIUsage()` - Get current month's usage summary
  - `getAIUsage()` - Get historical usage data

### 2. AI Usage Middleware
- **File**: `server/middleware/ai-usage-middleware.ts`
- **Purpose**: Enforce AI limits and track usage automatically
- **Key middleware**:
  - `checkAIUsageLimit()` - Block AI requests for free users
  - `logAIUsage()` - Auto-log successful AI requests
  - `withAIUsageTracking()` - Combined check + log middleware

### 3. Storage Routes with AI Integration
- **File**: `server/routes/storage-routes.ts`
- **Purpose**: Expose AI usage data through REST API
- **Key endpoints**:
  - `GET /api/panel/storage/usage` - Includes AI quota information
  - `GET /api/panel/storage/ai-usage` - Detailed AI usage history
  - `POST /api/panel/storage/log-ai-request` - Manual logging endpoint

### 4. Enhanced Usage UI
- **File**: `client/src/components/settings/UsageSettings.tsx`
- **Purpose**: Display AI usage alongside storage usage
- **Features**:
  - AI usage progress bar and limits
  - Service breakdown (moderation, ticket analysis, etc.)
  - Overage cost display
  - Real-time usage status

## Integration Steps

### Step 1: Add AI Usage Middleware to AI-Powered Routes

```typescript
// Example: In your AI moderation route
import { withAIUsageTracking } from '../middleware/ai-usage-middleware';

router.post('/moderate-content', 
  ...withAIUsageTracking('moderation', 1), // 1 token per request
  async (req, res) => {
    // Your AI moderation logic
    const result = await moderateWithAI(content);
    res.json(result);
  }
);

// Example: For ticket analysis
router.post('/analyze-ticket', 
  ...withAIUsageTracking('ticket_analysis', 2), // 2 tokens per analysis
  async (req, res) => {
    // Your AI analysis logic
    const analysis = await analyzeTicketWithAI(ticket);
    res.json(analysis);
  }
);
```

### Step 2: Manual AI Logging (Alternative Approach)

```typescript
// For existing AI integrations, add manual logging
import { logAIRequest } from '../services/storage-settings-service';

router.post('/existing-ai-feature', async (req, res) => {
  try {
    // Your existing AI logic
    const result = await processWithAI(data);
    
    // Log the AI usage
    const serverName = req.modlServer?.customDomain || 'default';
    await logAIRequest(serverName, 'moderation', 1, 0.01);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Step 3: Check AI Availability Before Processing

```typescript
import { getAIUsageInfo } from '../middleware/ai-usage-middleware';

router.post('/ai-feature', async (req, res) => {
  // Check if user can use AI
  const aiInfo = await getAIUsageInfo(req);
  
  if (!aiInfo.canUseAI) {
    return res.status(403).json({
      error: 'AI features require premium subscription',
      upgrade_required: true
    });
  }
  
  // Show usage warning if approaching limit
  if (aiInfo.remainingRequests < 10) {
    console.warn(`User approaching AI limit: ${aiInfo.remainingRequests} requests remaining`);
  }
  
  // Process AI request
  const result = await processWithAI(data);
  res.json(result);
});
```

## Service Types

The system tracks AI usage by service type:

- **`moderation`**: Content moderation, chat filtering
- **`ticket_analysis`**: Ticket categorization, sentiment analysis
- **`appeal_analysis`**: Appeal processing, ban review
- **`other`**: General AI features, custom integrations

## Database Schema

### AI Usage Records
```typescript
{
  date: "2024-01-15", // Daily aggregation
  requests: 45,
  tokensUsed: 67,
  cost: 0.67,
  services: {
    moderation: 30,
    ticket_analysis: 10,
    appeal_analysis: 5,
    other: 0
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Storage Settings (Extended)
```typescript
{
  serverName: "example-server",
  overageLimit: 107374182400, // 100GB in bytes
  overageEnabled: true,
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

### Get Usage Information
```
GET /api/panel/storage/usage
```
Returns combined storage + AI usage data including quotas and costs.

### Get AI Usage History
```
GET /api/panel/storage/ai-usage?startDate=2024-01-01&endDate=2024-01-31
```
Returns detailed AI usage history for premium users.

### Manual AI Logging
```
POST /api/panel/storage/log-ai-request
Body: {
  "service": "moderation",
  "tokensUsed": 1
}
```
Manually log an AI request (useful for testing or external integrations).

## Billing Integration

### Monthly Cost Calculation
```typescript
// Example billing calculation
const aiUsage = await getCurrentMonthAIUsage(serverName);
const baseLimit = 1000;
const overageRequests = Math.max(0, aiUsage.totalRequests - baseLimit);
const aiOverageCost = overageRequests * 0.01;

// Add to monthly bill
const totalOverageCost = storageOverageCost + aiOverageCost;
```

### Overage Alerts
```typescript
// Set up alerts when users approach limits
if (aiUsage.totalRequests > 900) { // 90% of limit
  await sendUsageWarningEmail(userEmail, {
    type: 'ai_usage_warning',
    used: aiUsage.totalRequests,
    limit: 1000,
    remaining: 1000 - aiUsage.totalRequests
  });
}
```

## Error Handling

### Free User Attempting AI
```json
{
  "error": "AI features are only available for premium users",
  "message": "Upgrade to premium to access AI-powered moderation and analysis features.",
  "code": "AI_PREMIUM_REQUIRED"
}
```

### Rate Limiting (Future Enhancement)
```typescript
// Optional: Implement rate limiting for AI requests
if (aiUsage.totalRequests >= 1500) { // Hard limit
  return res.status(429).json({
    error: "AI usage limit exceeded",
    message: "You have exceeded your monthly AI request limit. Contact support to increase your limit.",
    code: "AI_LIMIT_EXCEEDED"
  });
}
```

## Monitoring & Analytics

### Key Metrics to Track
- AI requests per tenant per month
- Cost per tenant per month
- Service type usage patterns
- Premium conversion rate (users hitting AI limits)

### Logging Examples
```typescript
// Successful AI request
console.log(`AI request logged: ${serverName} - ${service} - ${tokensUsed} tokens - $${cost}`);

// Usage warnings
console.warn(`AI usage approaching limit: ${serverName} - ${remaining} requests remaining`);

// Overage tracking
console.info(`AI overage incurred: ${serverName} - ${overageRequests} requests - $${overageCost}`);
```

## Testing

### Test AI Usage Limits
1. Create a test tenant with premium subscription
2. Make 1000 AI requests using the test endpoint
3. Verify 1001st request still works but incurs overage cost
4. Switch to free plan and verify AI requests are blocked

### Test Service Tracking
1. Make requests to different service types
2. Verify each service is tracked separately
3. Check that totals add up correctly

### Test Billing Calculation
1. Generate various usage patterns
2. Verify overage costs are calculated correctly
3. Test edge cases (exactly at limit, etc.)

## Security Considerations

- AI requests are authenticated and tied to specific tenants
- Usage data is isolated per tenant database
- Overage costs are calculated server-side only
- Free users cannot bypass AI restrictions through direct API calls

## Performance Considerations

- AI usage is aggregated daily to minimize database writes
- Historical data is limited to 31 days for API responses
- Usage calculations are cached where appropriate
- Database indexes are optimized for date-based queries