# Media Upload System Documentation

## Overview

This document describes the Wasabi S3-based media upload system implemented for uploading evidence, ticket attachments, and article media.

## Environment Variables

The following environment variables must be set for the media upload system to work:

```bash
WASABI_ACCESS_KEY=your_wasabi_access_key
WASABI_SECRET_KEY=your_wasabi_secret_key
WASABI_BUCKET_NAME=your_bucket_name
```

## Architecture

### Backend Components

#### 1. Wasabi Service (`server/services/wasabi-service.ts`)
- S3-compatible client for Wasabi cloud storage
- Handles file upload, deletion, and metadata management
- Provides file type validation and size limits
- Generates secure file names with UUIDs and timestamps

#### 2. Media Routes (`server/routes/media-routes.ts`)
- RESTful API endpoints for media operations
- Authentication required for all operations
- Supports multiple upload types with different configurations

#### 3. File Organization
Files are organized in the following folder structure:
```
bucket/
├── evidence/
│   ├── player-{playerId}/
│   ├── ticket-{ticketId}/
│   └── {category}/
├── tickets/
│   └── {ticketType}-{ticketId}/
├── articles/
│   ├── article-{articleId}/
│   └── article-{articleSlug}/
└── server-icons/
    ├── homepage/
    └── panel/
```

### Frontend Components

#### 1. MediaUpload (`client/src/components/MediaUpload.tsx`)
- Reusable upload component with drag-and-drop support
- Progress tracking and file validation
- Multiple variants: default, compact, button-only
- Real-time upload status with error handling

#### 2. EvidenceUpload (`client/src/components/EvidenceUpload.tsx`)
- Specialized component for evidence uploads
- Preview functionality for images and videos
- Metadata tracking (player ID, ticket ID, category)
- Secure deletion with confirmation

#### 3. TicketAttachments (`client/src/components/TicketAttachments.tsx`)
- Ticket-specific attachment management
- Support for documents, images, and videos
- Download and preview capabilities
- Attachment organization by ticket

#### 4. ArticleMediaUpload (`client/src/components/ArticleMediaUpload.tsx`)
- Knowledgebase article media management
- Alt text editing for accessibility
- Media insertion into articles
- URL copying for manual insertion

#### 5. Hooks (`client/src/hooks/use-media-upload.tsx`)
- Configuration fetching
- Upload and delete operations
- Error handling and loading states

## API Endpoints

### Configuration
- `GET /api/panel/media/config` - Get upload configuration and limits

### Upload Endpoints
- `POST /api/panel/media/upload/evidence` - Upload evidence files
- `POST /api/panel/media/upload/ticket` - Upload ticket attachments
- `POST /api/panel/media/upload/article` - Upload article media
- `POST /api/panel/media/upload/server-icon` - Upload server icons

### Management
- `DELETE /api/panel/media/{key}` - Delete media file by key

## File Type Support

### Evidence
- **Images**: JPEG, PNG, GIF, WebP
- **Videos**: MP4, WebM, QuickTime
- **Size Limit**: 100MB

### Ticket Attachments
- **Images**: JPEG, PNG, GIF, WebP
- **Documents**: PDF, Plain Text, Word Documents
- **Size Limit**: 10MB

### Article Media
- **Images**: JPEG, PNG, GIF, WebP
- **Videos**: MP4, WebM
- **Size Limit**: 50MB

### Server Icons
- **Images**: JPEG, PNG, GIF, WebP
- **Size Limit**: 5MB

## Security Features

1. **Authentication**: All endpoints require user authentication
2. **File Validation**: MIME type and size validation
3. **Secure Naming**: UUID-based file names prevent conflicts
4. **Access Control**: Files organized by user context
5. **Virus Scanning**: Ready for integration (not implemented)

## Usage Examples

### Basic Evidence Upload
```typescript
import { EvidenceUpload } from '@/components/EvidenceUpload';

<EvidenceUpload
  playerId="player-123"
  category="ban-appeal"
  onEvidenceUpdate={(evidence) => console.log(evidence)}
/>
```

### Ticket Attachments
```typescript
import { TicketAttachments } from '@/components/TicketAttachments';

<TicketAttachments
  ticketId="ticket-456"
  ticketType="bug-report"
  onAttachmentsUpdate={(attachments) => saveAttachments(attachments)}
/>
```

### Article Media Management
```typescript
import { ArticleMediaUpload } from '@/components/ArticleMediaUpload';

<ArticleMediaUpload
  articleId="article-789"
  onInsertMedia={(url, altText) => insertIntoEditor(url, altText)}
/>
```

## Configuration Management

The system automatically detects if Wasabi is configured and gracefully handles missing configuration:

```typescript
import { useMediaUpload } from '@/hooks/use-media-upload';

const { config, isConfigLoading } = useMediaUpload();

if (!config?.wasabiConfigured) {
  return <div>Media storage not configured</div>;
}
```

## Error Handling

The system provides comprehensive error handling:

1. **Configuration Errors**: Graceful degradation when Wasabi is not configured
2. **Upload Errors**: User-friendly error messages with retry options
3. **Validation Errors**: Clear feedback on file type and size violations
4. **Network Errors**: Automatic retry and progress tracking

## Performance Considerations

1. **File Size Limits**: Appropriate limits for each use case
2. **Progress Tracking**: Real-time upload progress feedback
3. **Chunked Uploads**: Ready for implementation if needed
4. **CDN Integration**: Wasabi provides global CDN capabilities

## Future Enhancements

1. **Image Optimization**: Automatic compression and resizing
2. **Thumbnail Generation**: For better preview experience
3. **Bulk Operations**: Multi-file upload and management
4. **Advanced Security**: Virus scanning and content analysis
5. **Analytics**: Upload usage tracking and reporting

## Deployment Notes

1. Set environment variables in production
2. Configure Wasabi bucket with appropriate permissions
3. Test upload functionality before going live
4. Monitor storage usage and costs
5. Set up automated backups if required

## Troubleshooting

### Common Issues

1. **"Media storage not configured"**
   - Check environment variables are set
   - Verify Wasabi credentials are correct

2. **Upload fails with permission error**
   - Check Wasabi bucket permissions
   - Verify access key has upload permissions

3. **File type not supported**
   - Check file MIME type against supported types
   - Update validation if new types needed

4. **File too large**
   - Check file size against limits
   - Compress files if possible

### Debug Information

Enable debug logging by setting:
```bash
DEBUG=media-upload
```

This will log detailed information about upload operations and errors.