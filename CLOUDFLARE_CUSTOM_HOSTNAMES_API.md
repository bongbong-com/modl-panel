# Cloudflare Custom Hostnames API Implementation

This document describes the updated custom domain routes using the official Cloudflare API for custom hostnames.

## Environment Variables

Make sure these environment variables are set:

```bash
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ZONE_ID=your_zone_id_here
```

### Getting Cloudflare Credentials

1. **API Token**: Go to Cloudflare Dashboard → My Profile → API Tokens → Create Token
   - Use "SSL and Certificates Write" template or create custom token with:
     - Zone permissions: `Zone:Read`, `SSL and Certificates:Edit`
     - Zone resources: Include your specific zone
   
2. **Zone ID**: Found in your domain's Overview page in Cloudflare Dashboard (right sidebar)

## API Endpoints

### Health Check
```
GET /api/panel/settings/domain/health
```
Tests Cloudflare API connectivity and configuration.

### Get Domain Configuration
```
GET /api/panel/settings/domain
```
Returns current domain configuration with real-time status from Cloudflare.

### Configure Custom Domain
```
POST /api/panel/settings/domain
Content-Type: application/json

{
  "customDomain": "panel.yourdomain.com"
}
```
Creates a new custom hostname in Cloudflare.

### Verify Domain
```
POST /api/panel/settings/domain/verify
Content-Type: application/json

{
  "domain": "panel.yourdomain.com"
}
```
Triggers domain control validation (DCV) in Cloudflare.

### Get Real-time Status
```
GET /api/panel/settings/domain/status/panel.yourdomain.com
```
Gets the current status directly from Cloudflare API.

### Get Setup Instructions
```
GET /api/panel/settings/domain/instructions
```
Returns detailed setup instructions including CNAME records and validation requirements.

### Remove Custom Domain
```
DELETE /api/panel/settings/domain
```
Removes the custom hostname from both Cloudflare and the database.

## Domain Status Flow

1. **pending** - Domain configured but DNS not yet propagated
2. **verifying** - Cloudflare is validating domain control (DCV in progress)
3. **active** - Domain validated, SSL certificate issued and active
4. **error** - Validation failed or other error occurred

## SSL Status Mapping

Cloudflare SSL Status → Internal Status:
- `active` → `active`
- `pending_validation`, `pending_certificate`, `initializing` → `verifying`
- `expired` → `error`
- Any validation errors → `error`

## DNS Setup

Users need to create a CNAME record:
- **Name**: The subdomain part (e.g., "panel" for "panel.yourdomain.com")
- **Target**: Provided by Cloudflare (typically `{hostname_id}.cloudflare-cname.com`)
- **TTL**: 300 seconds (or lowest available)

## Background Status Updates

The system includes a background service that periodically checks domain statuses from Cloudflare and updates the database. This ensures status accuracy without requiring manual verification.

To start the background updater:
```typescript
import { startDomainStatusUpdater } from './api/cloudflare';

// Start with 10-minute intervals
const updaterInterval = startDomainStatusUpdater(globalDbConnection, 10);
```

## Error Handling

The implementation includes comprehensive error handling:
- Custom `CloudflareError` class with detailed error information
- Proper HTTP status codes
- Validation of environment variables
- Graceful handling of API rate limits and timeouts

## Features

### Enhanced Status Tracking
- Real-time status checking from Cloudflare
- Automatic database updates when status changes
- Detailed error messages and validation feedback

### Improved Security
- Domain ownership validation
- Prevention of domain conflicts between servers
- Secure API token handling

### Better User Experience
- Detailed setup instructions
- Real-time validation feedback
- Clear error messages with resolution steps

### Monitoring & Debugging
- Health check endpoint for troubleshooting
- Comprehensive logging
- Background status monitoring

## Migration from Previous Implementation

The new implementation is backward compatible with existing database schemas. Legacy function names are aliased for compatibility:

```typescript
// Legacy names still work
export const handleCloudflareCustomDomain = createCustomHostname;
export const verifyCloudflareCustomDomain = verifyCustomHostname;
export const deleteCloudflareCustomDomain = deleteCustomHostname;
```

## Troubleshooting

### Common Issues

1. **Invalid API Token**: Ensure token has SSL and Certificates Write permissions
2. **Wrong Zone ID**: Verify Zone ID matches your domain in Cloudflare
3. **DNS Propagation**: CNAME changes can take up to 48 hours to propagate globally
4. **Validation Errors**: Check that CNAME points to the correct target provided by Cloudflare

### Testing the Setup

1. Check health endpoint: `GET /api/panel/settings/domain/health`
2. Verify environment variables are set correctly
3. Test with a subdomain you control
4. Monitor logs for detailed error information

### Debug Commands

```bash
# Test Cloudflare API connectivity
curl -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/custom_hostnames"

# Check DNS propagation
dig panel.yourdomain.com CNAME
nslookup panel.yourdomain.com
```
