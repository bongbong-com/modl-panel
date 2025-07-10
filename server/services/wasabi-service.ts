import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import crypto from 'crypto';

// Wasabi S3 Configuration
const WASABI_ENDPOINT = 'https://s3.wasabisys.com';
const WASABI_REGION = 'us-east-1'; // Wasabi uses us-east-1 as default region

// Initialize S3 client for Wasabi
const s3Client = new S3Client({
  region: WASABI_REGION,
  endpoint: WASABI_ENDPOINT,
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY || '',
    secretAccessKey: process.env.WASABI_SECRET_KEY || '',
  },
  forcePathStyle: true, // Required for Wasabi compatibility
});

const BUCKET_NAME = process.env.WASABI_BUCKET_NAME || '';

// Validate environment variables
if (!process.env.WASABI_ACCESS_KEY || !process.env.WASABI_SECRET_KEY || !process.env.WASABI_BUCKET_NAME) {
  console.warn('Warning: Wasabi environment variables not configured. Media uploads will be disabled.');
}

export interface MediaUploadOptions {
  file: Buffer;
  fileName: string;
  contentType: string;
  folder: 'evidence' | 'tickets' | 'articles' | 'server-icons';
  subFolder?: string; // For organizing files within folders
  maxSizeBytes?: number;
  allowedTypes?: string[];
}

export interface MediaUploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

// Supported file types for different use cases
export const SUPPORTED_FILE_TYPES = {
  evidence: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'],
  tickets: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  articles: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'],
  'server-icons': ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
};

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  evidence: 100 * 1024 * 1024, // 100MB for evidence (videos can be large)
  tickets: 10 * 1024 * 1024,   // 10MB for ticket attachments
  articles: 50 * 1024 * 1024,  // 50MB for article media
  'server-icons': 5 * 1024 * 1024 // 5MB for server icons
};

/**
 * Generate a secure file name with timestamp and random UUID
 */
function generateSecureFileName(originalName: string, folder: string, subFolder?: string): string {
  const timestamp = Date.now();
  const uuid = uuidv4();
  const ext = path.extname(originalName).toLowerCase();
  const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9]/g, '-');
  
  const fileName = `${baseName}-${timestamp}-${uuid}${ext}`;
  
  if (subFolder) {
    return `${folder}/${subFolder}/${fileName}`;
  }
  
  return `${folder}/${fileName}`;
}

/**
 * Validate file type and size
 */
function validateFile(file: Buffer, contentType: string, folder: string, options: MediaUploadOptions): string | null {
  // Check file size
  const maxSize = options.maxSizeBytes || FILE_SIZE_LIMITS[folder];
  if (file.length > maxSize) {
    return `File size exceeds limit of ${Math.round(maxSize / 1024 / 1024)}MB`;
  }

  // Check file type
  const allowedTypes = options.allowedTypes || SUPPORTED_FILE_TYPES[folder];
  if (!allowedTypes.includes(contentType)) {
    return `File type ${contentType} not supported. Allowed types: ${allowedTypes.join(', ')}`;
  }

  return null;
}

/**
 * Upload media file to Wasabi S3
 */
export async function uploadMedia(options: MediaUploadOptions): Promise<MediaUploadResult> {
  try {
    // Validate environment variables
    if (!BUCKET_NAME) {
      return { success: false, error: 'Wasabi bucket not configured' };
    }

    // Validate file
    const validationError = validateFile(options.file, options.contentType, options.folder, options);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // Generate secure file name
    const key = generateSecureFileName(options.fileName, options.folder, options.subFolder);

    // Upload to Wasabi
    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: options.file,
      ContentType: options.contentType,
      CacheControl: 'public, max-age=31536000', // 1 year cache
      Metadata: {
        'original-name': options.fileName,
        'uploaded-at': new Date().toISOString(),
        'folder': options.folder,
        'sub-folder': options.subFolder || ''
      }
    });

    await s3Client.send(uploadCommand);

    // Generate public URL
    const url = `${WASABI_ENDPOINT}/${BUCKET_NAME}/${key}`;

    return {
      success: true,
      url,
      key
    };

  } catch (error) {
    console.error('Error uploading media to Wasabi:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error'
    };
  }
}

/**
 * Delete media file from Wasabi S3
 */
export async function deleteMedia(key: string): Promise<boolean> {
  try {
    if (!BUCKET_NAME) {
      console.warn('Wasabi bucket not configured');
      return false;
    }

    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    await s3Client.send(deleteCommand);
    return true;

  } catch (error) {
    console.error('Error deleting media from Wasabi:', error);
    return false;
  }
}

/**
 * Generate presigned URL for temporary access
 */
export async function generatePresignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string | null> {
  try {
    if (!BUCKET_NAME) {
      return null;
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
    return url;

  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return null;
  }
}

/**
 * Check if media file exists
 */
export async function mediaExists(key: string): Promise<boolean> {
  try {
    if (!BUCKET_NAME) {
      return false;
    }

    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    await s3Client.send(command);
    return true;

  } catch (error) {
    return false;
  }
}

/**
 * Get file information
 */
export async function getMediaInfo(key: string): Promise<{ size: number; contentType: string; lastModified: Date } | null> {
  try {
    if (!BUCKET_NAME) {
      return null;
    }

    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const response = await s3Client.send(command);
    
    return {
      size: response.ContentLength || 0,
      contentType: response.ContentType || '',
      lastModified: response.LastModified || new Date()
    };

  } catch (error) {
    console.error('Error getting media info:', error);
    return null;
  }
}

/**
 * Check if Wasabi is configured and available
 */
export function isWasabiConfigured(): boolean {
  return !!(process.env.WASABI_ACCESS_KEY && process.env.WASABI_SECRET_KEY && process.env.WASABI_BUCKET_NAME);
}