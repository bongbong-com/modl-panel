import { Router } from 'express';
import multer from 'multer';
import { isAuthenticated } from '../middleware/auth-middleware';
import { uploadMedia, deleteMedia, isWasabiConfigured, MediaUploadOptions } from '../services/wasabi-service';
import { createSafeErrorResponse, handleFileUploadError } from '../middleware/error-handler';
import crypto from 'crypto';
import path from 'path';

const router = Router();

/**
 * SECURITY: Enhanced file validation
 */
function validateFileUpload(file: Express.Multer.File, allowedTypes: string[]): string | null {
  if (!file) return 'No file provided';
  
  // SECURITY: Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.mov', '.pdf', '.txt', '.doc', '.docx'];
  if (!allowedExtensions.includes(ext)) {
    return `File extension ${ext} is not allowed`;
  }
  
  // SECURITY: Validate MIME type matches extension
  const mimeToExt: Record<string, string[]> = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'video/mp4': ['.mp4'],
    'video/webm': ['.webm'],
    'video/quicktime': ['.mov'],
    'application/pdf': ['.pdf'],
    'text/plain': ['.txt'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
  };
  
  const expectedExtensions = mimeToExt[file.mimetype];
  if (!expectedExtensions || !expectedExtensions.includes(ext)) {
    return `File type mismatch: MIME type ${file.mimetype} does not match extension ${ext}`;
  }
  
  // SECURITY: Check if MIME type is allowed for this upload type
  if (!allowedTypes.includes(file.mimetype)) {
    return `File type ${file.mimetype} is not allowed for this upload type`;
  }
  
  // SECURITY: Check for suspicious file names
  if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
    return 'Invalid filename: contains path traversal characters';
  }
  
  return null; // Valid
}

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Basic file type check (will be enhanced per route)
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime',
      'application/pdf', 'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  }
});

// Middleware to check if Wasabi is configured
const requireWasabiConfig = (req: any, res: any, next: any) => {
  if (!isWasabiConfigured()) {
    return res.status(503).json({
      error: 'Media storage not configured',
      message: 'Wasabi cloud storage is not properly configured. Please contact your administrator.'
    });
  }
  next();
};

/**
 * Upload evidence media (videos, images)
 * Used for player reports, ban appeals, etc.
 */
router.post('/upload/evidence', isAuthenticated, requireWasabiConfig, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // SECURITY: Enhanced file validation
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
    const validationError = validateFileUpload(req.file, allowedMimeTypes);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { playerId, ticketId, category } = req.body;
    const serverName = req.serverName || 'unknown';
    
    // Create subfolder structure for organization
    let subFolder = '';
    if (playerId) {
      subFolder = `player-${playerId}`;
    } else if (ticketId) {
      subFolder = `ticket-${ticketId}`;
    } else if (category) {
      subFolder = category;
    }

    const uploadOptions: MediaUploadOptions = {
      file: req.file.buffer,
      fileName: req.file.originalname,
      contentType: req.file.mimetype,
      folder: 'evidence',
      subFolder,
      serverName,
    };

    const result = await uploadMedia(uploadOptions);

    if (result.success) {
      res.json({
        success: true,
        url: result.url,
        key: result.key,
        message: 'Evidence uploaded successfully'
      });
    } else {
      res.status(400).json({
        error: result.error || 'Failed to upload evidence'
      });
    }

  } catch (error) {
    const errorResponse = createSafeErrorResponse(error, 'Failed to upload evidence');
    res.status(500).json(errorResponse);
  }
});

/**
 * Upload ticket attachments
 * Used for support tickets, bug reports, etc.
 */
router.post('/upload/ticket', isAuthenticated, requireWasabiConfig, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { ticketId, ticketType } = req.body;
    const serverName = req.serverName || 'unknown';
    
    if (!ticketId) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    const uploadOptions: MediaUploadOptions = {
      file: req.file.buffer,
      fileName: req.file.originalname,
      contentType: req.file.mimetype,
      folder: 'tickets',
      subFolder: `${ticketType || 'general'}-${ticketId}`,
      serverName,
    };

    const result = await uploadMedia(uploadOptions);

    if (result.success) {
      res.json({
        success: true,
        url: result.url,
        key: result.key,
        message: 'Ticket attachment uploaded successfully'
      });
    } else {
      res.status(400).json({
        error: result.error || 'Failed to upload ticket attachment'
      });
    }

  } catch (error) {
    console.error('Ticket attachment upload error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to upload ticket attachment'
    });
  }
});

/**
 * Upload article media (images, videos)
 * Used for knowledgebase articles
 */
router.post('/upload/article', isAuthenticated, requireWasabiConfig, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { articleId, articleSlug } = req.body;
    const serverName = req.serverName || 'unknown';
    
    const subFolder = articleId ? `article-${articleId}` : (articleSlug ? `article-${articleSlug}` : 'general');

    const uploadOptions: MediaUploadOptions = {
      file: req.file.buffer,
      fileName: req.file.originalname,
      contentType: req.file.mimetype,
      folder: 'articles',
      subFolder,
      serverName,
    };

    const result = await uploadMedia(uploadOptions);

    if (result.success) {
      res.json({
        success: true,
        url: result.url,
        key: result.key,
        message: 'Article media uploaded successfully'
      });
    } else {
      res.status(400).json({
        error: result.error || 'Failed to upload article media'
      });
    }

  } catch (error) {
    console.error('Article media upload error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to upload article media'
    });
  }
});

/**
 * Upload appeal attachments (public route - no authentication required)
 * Used for ban appeals submitted by players
 */
router.post('/upload/appeal', requireWasabiConfig, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { appealId, fieldId } = req.body;
    const serverName = req.serverName || 'unknown';
    
    if (!appealId || !fieldId) {
      return res.status(400).json({ error: 'Appeal ID and field ID are required' });
    }

    const uploadOptions: MediaUploadOptions = {
      file: req.file.buffer,
      fileName: req.file.originalname,
      contentType: req.file.mimetype,
      folder: 'appeals',
      subFolder: `appeal-${appealId}-${fieldId}`,
      serverName,
    };

    const result = await uploadMedia(uploadOptions);

    if (result.success) {
      res.json({
        success: true,
        url: result.url,
        key: result.key,
        message: 'Appeal attachment uploaded successfully'
      });
    } else {
      res.status(400).json({
        error: result.error || 'Failed to upload appeal attachment'
      });
    }

  } catch (error) {
    console.error('Appeal attachment upload error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to upload appeal attachment'
    });
  }
});

/**
 * Upload server icons (backward compatibility with existing system)
 * Uploads to Wasabi instead of local storage
 */
router.post('/upload/server-icon', isAuthenticated, requireWasabiConfig, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { iconType } = req.body;
    const serverName = req.serverName || 'unknown';
    
    if (!iconType || !['homepage', 'panel'].includes(iconType)) {
      return res.status(400).json({ error: 'Invalid icon type. Must be "homepage" or "panel"' });
    }

    const uploadOptions: MediaUploadOptions = {
      file: req.file.buffer,
      fileName: req.file.originalname,
      contentType: req.file.mimetype,
      folder: 'server-icons',
      subFolder: iconType,
      serverName,
    };

    const result = await uploadMedia(uploadOptions);

    if (result.success) {
      res.json({
        success: true,
        url: result.url,
        key: result.key,
        message: 'Server icon uploaded successfully'
      });
    } else {
      res.status(400).json({
        error: result.error || 'Failed to upload server icon'
      });
    }

  } catch (error) {
    console.error('Server icon upload error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to upload server icon'
    });
  }
});

/**
 * Delete media file
 * Can delete any media file by key (with proper permissions)
 */
router.delete('/media/:key', isAuthenticated, requireWasabiConfig, async (req, res) => {
  try {
    const { key } = req.params;
    
    if (!key) {
      return res.status(400).json({ error: 'Media key is required' });
    }

    // Decode the key (it may be URL encoded)
    const decodedKey = decodeURIComponent(key);
    
    const success = await deleteMedia(decodedKey);

    if (success) {
      res.json({
        success: true,
        message: 'Media deleted successfully'
      });
    } else {
      res.status(400).json({
        error: 'Failed to delete media file'
      });
    }

  } catch (error) {
    console.error('Media deletion error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete media file'
    });
  }
});

/**
 * Get media upload status and configuration
 */
router.get('/config', isAuthenticated, (req, res) => {
  res.json({
    wasabiConfigured: isWasabiConfigured(),
    supportedTypes: {
      evidence: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'],
      tickets: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      appeals: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      articles: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'],
      'server-icons': ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    },
    fileSizeLimits: {
      evidence: 100 * 1024 * 1024, // 100MB
      tickets: 10 * 1024 * 1024,   // 10MB
      appeals: 10 * 1024 * 1024,   // 10MB
      articles: 50 * 1024 * 1024,  // 50MB
      'server-icons': 5 * 1024 * 1024 // 5MB
    }
  });
});

export default router;