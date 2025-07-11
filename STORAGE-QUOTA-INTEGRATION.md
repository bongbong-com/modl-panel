# Storage Quota System Integration Guide

## Overview

This system implements tiered storage limits with overage billing:
- **Free users**: 1GB storage limit (hard limit)
- **Paid users**: 200GB base storage + configurable overage (default 100GB)
- **Overage pricing**: $0.05/GB/month for paid users

## System Components

### 1. Storage Quota Service
- **File**: `server/services/storage-quota-service.ts`
- **Purpose**: Calculate quotas, check limits, and manage overage billing
- **Key functions**:
  - `getStorageQuota()` - Get current quota status
  - `canUploadFile()` - Check if upload is allowed
  - `calculateOverageCost()` - Calculate monthly overage cost

### 2. Storage Quota Middleware
- **File**: `server/middleware/storage-quota-middleware.ts`
- **Purpose**: Block uploads that exceed storage limits
- **Key middleware**:
  - `checkStorageQuota` - Check quotas for file uploads
  - `checkStorageQuotaBySize` - Check quotas by file size
  - `getStorageQuotaInfo` - Get quota info without blocking

### 3. Storage API Routes
- **File**: `server/routes/storage-routes.ts`
- **Purpose**: Manage storage usage and settings
- **Key endpoints**:
  - `GET /api/panel/storage/usage` - Get usage with quota info
  - `GET /api/panel/storage/settings` - Get storage settings
  - `PUT /api/panel/storage/settings` - Update overage limits
  - `POST /api/panel/storage/check-upload` - Check upload permission

### 4. Usage Settings UI
- **File**: `client/src/components/settings/UsageSettings.tsx`
- **Purpose**: Display usage, manage settings, and show overage billing
- **Features**:
  - Visual usage indicators with progress bars
  - Overage billing display for paid users
  - Settings dialog for overage limit configuration
  - File management with quota awareness

## Integration Steps

### Step 1: Add Storage Quota Middleware to Upload Routes

```typescript
// In your media upload routes (e.g., server/routes/media-routes.ts)
import { checkStorageQuota } from '../middleware/storage-quota-middleware';

// Add middleware before multer upload
router.post('/upload/evidence', 
  checkStorageQuota,  // Add this line
  upload.single('file'), 
  async (req, res) => {
    // Your existing upload logic
  }
);
```

### Step 2: Update User Billing Status Detection

In your routes, ensure user billing status is properly detected:

```typescript
// Example: How to determine if user is paid
const isPaidUser = req.session?.user?.billingStatus === 'active' || 
                  req.session?.user?.subscriptionStatus === 'active';
```

### Step 3: Store User Storage Settings

Create a database table or schema to store user storage settings:

```sql
-- Example schema
CREATE TABLE storage_settings (
  server_name VARCHAR(255) PRIMARY KEY,
  overage_limit BIGINT NOT NULL DEFAULT 107374182400, -- 100GB in bytes
  overage_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Step 4: Update Storage Routes with Database Integration

```typescript
// In server/routes/storage-routes.ts
// Replace TODO comments with actual database calls

// Get storage settings
const settings = await db.query(
  'SELECT * FROM storage_settings WHERE server_name = ?',
  [serverName]
);

// Update storage settings
await db.query(
  'INSERT INTO storage_settings (server_name, overage_limit, overage_enabled) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE overage_limit = ?, overage_enabled = ?',
  [serverName, overageLimit, overageEnabled, overageLimit, overageEnabled]
);
```

### Step 5: Add Billing Integration

```typescript
// In server/services/billing-service.ts
// Add storage overage to monthly billing

export async function calculateStorageOverageCharges(serverName: string): Promise<number> {
  const quota = await getStorageQuota(serverName, true);
  return quota.overageCost;
}
```

## Environment Variables

Add these to your `.env` file:

```bash
# Wasabi Storage Configuration
WASABI_ACCESS_KEY=your_wasabi_access_key
WASABI_SECRET_KEY=your_wasabi_secret_key
WASABI_BUCKET_NAME=your_bucket_name
WASABI_ENDPOINT=https://s3.wasabisys.com
WASABI_REGION=us-east-1
```

## API Endpoints

### Storage Usage
```
GET /api/panel/storage/usage
```
Returns comprehensive usage data with quota information.

### Storage Settings
```
GET /api/panel/storage/settings
PUT /api/panel/storage/settings
```
Manage overage limits for paid users.

### Upload Check
```
POST /api/panel/storage/check-upload
Body: { "fileSize": 1024000 }
```
Check if a file can be uploaded before processing.

### Debug Configuration
```
GET /api/panel/storage/debug
```
Check if storage system is properly configured.

## Error Handling

The system returns specific error codes:
- `413` - Storage quota exceeded
- `403` - Access denied (free users trying to set overage)
- `500` - Configuration or system errors

## Testing

1. **Test Free User Limits**:
   - Upload files totaling > 1GB
   - Verify uploads are blocked

2. **Test Paid User Overage**:
   - Set overage limit to 50GB
   - Upload files exceeding 200GB base + 50GB overage
   - Verify uploads are blocked at 250GB total

3. **Test Overage Billing**:
   - Upload files exceeding 200GB base limit
   - Verify overage cost calculation at $0.05/GB/month

## Monitoring

Monitor these metrics:
- Storage usage per tenant
- Overage costs per tenant
- Upload failure rates due to quota limits
- User storage setting changes

## Security Considerations

- Validates file sizes before processing
- Enforces tenant isolation (files are prefixed with server name)
- Requires authentication for all storage operations
- Validates overage limits to prevent abuse (max 1TB)

## Performance Considerations

- Uses pagination for large file listings
- Caches quota calculations where possible
- Efficient S3 API usage with proper prefixes
- Minimal database queries for settings lookup