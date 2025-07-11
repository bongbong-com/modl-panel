import { Router } from 'express';
import { Request, Response } from 'express';
import { z } from 'zod';
import { getStorageQuota, getStorageBreakdown, formatBytes, STORAGE_LIMITS } from '../services/storage-quota-service';

const router = Router();

// Wasabi S3 Configuration
const WASABI_ENDPOINT = 'https://s3.wasabisys.com';
const WASABI_REGION = 'us-east-1';

// Dynamic imports for AWS SDK to avoid constructor issues
let S3Client: any;
let DeleteObjectCommand: any;
let DeleteObjectsCommand: any;
let ListObjectsV2Command: any;
let HeadObjectCommand: any;
let GetObjectCommand: any;
let getSignedUrl: any;
let s3Client: any;

// Initialize AWS SDK components
async function initializeAwsSdk() {
  if (S3Client) return; // Already initialized
  
  try {
    const { 
      S3Client: S3, 
      DeleteObjectCommand: Delete, 
      DeleteObjectsCommand: DeleteMultiple,
      ListObjectsV2Command: List,
      HeadObjectCommand: Head,
      GetObjectCommand: Get 
    } = await import('@aws-sdk/client-s3');
    const { getSignedUrl: signUrl } = await import('@aws-sdk/s3-request-presigner');
    
    S3Client = S3;
    DeleteObjectCommand = Delete;
    DeleteObjectsCommand = DeleteMultiple;
    ListObjectsV2Command = List;
    HeadObjectCommand = Head;
    GetObjectCommand = Get;
    getSignedUrl = signUrl;
    
    s3Client = new S3Client({
      region: WASABI_REGION,
      endpoint: WASABI_ENDPOINT,
      credentials: {
        accessKeyId: process.env.WASABI_ACCESS_KEY || '',
        secretAccessKey: process.env.WASABI_SECRET_KEY || '',
      },
      forcePathStyle: true, // Required for Wasabi compatibility
    });
  } catch (error) {
    console.error('Failed to initialize AWS SDK:', error);
    throw error;
  }
}

const BUCKET_NAME = process.env.WASABI_BUCKET_NAME || '';

// Debug endpoint to check configuration
router.get('/debug', async (req: Request, res: Response) => {
  try {
    const serverName = getServerName(req);
    const hasCredentials = !!(process.env.WASABI_ACCESS_KEY && process.env.WASABI_SECRET_KEY);
    
    res.json({
      configured: hasCredentials && !!BUCKET_NAME,
      serverName,
      bucketName: BUCKET_NAME || 'Not configured',
      hasAccessKey: !!process.env.WASABI_ACCESS_KEY,
      hasSecretKey: !!process.env.WASABI_SECRET_KEY,
      endpoint: WASABI_ENDPOINT,
      region: WASABI_REGION,
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Validation schemas
const deleteFilesSchema = z.object({
  fileIds: z.array(z.string()).min(1).max(100),
});

const updateStorageSettingsSchema = z.object({
  overageLimit: z.number().min(0).max(1000 * 1024 * 1024 * 1024), // Max 1TB overage
  overageEnabled: z.boolean(),
});

interface StorageFile {
  id: string;
  name: string;
  path: string;
  size: number;
  type: 'ticket' | 'evidence' | 'logs' | 'backup' | 'other';
  createdAt: string;
  lastModified: string;
  url: string;
}

interface StorageUsage {
  totalUsed: number;
  totalQuota: number;
  byType: {
    ticket: number;
    evidence: number;
    logs: number;
    backup: number;
    other: number;
  };
}

// Helper function to determine file type from path
const getFileType = (path: string): StorageFile['type'] => {
  const pathLower = path.toLowerCase();
  if (pathLower.includes('/tickets/') || pathLower.includes('ticket')) return 'ticket';
  if (pathLower.includes('/evidence/') || pathLower.includes('evidence')) return 'evidence';
  if (pathLower.includes('/logs/') || pathLower.includes('log')) return 'logs';
  if (pathLower.includes('/backup/') || pathLower.includes('backup')) return 'backup';
  return 'other';
};

// Helper function to get server name from request
const getServerName = (req: Request): string => {
  // Extract server name from session or subdomain
  const serverName = (req as any).session?.serverName || req.headers.host?.split('.')[0] || 'default';
  return serverName;
};

// Get storage usage statistics with quota information
router.get('/usage', async (req: Request, res: Response) => {
  try {
    if (!BUCKET_NAME) {
      return res.status(500).json({ error: 'Wasabi storage not configured' });
    }

    const serverName = getServerName(req);
    
    // Get user's billing status to determine if they're paid
    const isPaidUser = (req as any).session?.user?.billingStatus === 'active' || false;
    
    // Get custom overage limit from user settings (implement this based on your settings storage)
    const customOverageLimit = undefined; // TODO: Get from user settings
    
    // Get storage quota information
    const quota = await getStorageQuota(serverName, isPaidUser, customOverageLimit);
    
    // Get detailed breakdown
    const breakdown = await getStorageBreakdown(serverName);
    
    const response = {
      // Quota information
      quota: {
        totalUsed: quota.totalUsed,
        totalUsedFormatted: formatBytes(quota.totalUsed),
        baseLimit: quota.baseLimit,
        baseLimitFormatted: formatBytes(quota.baseLimit),
        overageLimit: quota.overageLimit,
        overageLimitFormatted: formatBytes(quota.overageLimit),
        totalLimit: quota.totalLimit,
        totalLimitFormatted: formatBytes(quota.totalLimit),
        overageUsed: quota.overageUsed,
        overageUsedFormatted: formatBytes(quota.overageUsed),
        overageCost: quota.overageCost,
        isPaid: quota.isPaid,
        canUpload: quota.canUpload,
        usagePercentage: Math.round((quota.totalUsed / quota.totalLimit) * 100),
        baseUsagePercentage: Math.round((quota.totalUsed / quota.baseLimit) * 100),
      },
      
      // Legacy format for backward compatibility
      totalUsed: quota.totalUsed,
      totalQuota: quota.totalLimit,
      byType: {
        ticket: breakdown.byType.tickets || 0,
        evidence: breakdown.byType.evidence || 0,
        logs: breakdown.byType.other || 0, // Map other to logs for compatibility
        backup: 0, // Not used currently
        other: breakdown.byType.articles + breakdown.byType.appeals + breakdown.byType['server-icons'],
      },
      
      // Detailed breakdown
      breakdown: breakdown.byType,
      
      // Pricing information
      pricing: {
        overagePricePerGB: 0.05,
        currency: 'USD',
        period: 'month',
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching storage usage:', error);
    console.error('Server name:', getServerName(req));
    console.error('Bucket name:', BUCKET_NAME);
    res.status(500).json({ 
      error: 'Failed to fetch storage usage',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get list of files
router.get('/files', async (req: Request, res: Response) => {
  try {
    // Initialize AWS SDK
    await initializeAwsSdk();
    
    if (!BUCKET_NAME) {
      return res.status(500).json({ error: 'Wasabi storage not configured' });
    }

    const serverName = getServerName(req);
    
    const listParams = {
      Bucket: BUCKET_NAME,
      Prefix: serverName,
      MaxKeys: 1000,
    };

    const command = new ListObjectsV2Command(listParams);
    const response = await s3Client.send(command);
    
    const objects = response.Contents || [];
    
    const files: StorageFile[] = await Promise.all(
      objects.map(async (obj) => {
        const key = obj.Key || '';
        const pathWithoutServer = key.replace(`${serverName}/`, '');
        const fileName = pathWithoutServer.split('/').pop() || '';
        
        // Generate presigned URL for download
        const getObjectCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        });
        
        const url = await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 3600 });
        
        return {
          id: key,
          name: fileName,
          path: pathWithoutServer,
          size: obj.Size || 0,
          type: getFileType(key),
          createdAt: obj.LastModified?.toISOString() || new Date().toISOString(),
          lastModified: obj.LastModified?.toISOString() || new Date().toISOString(),
          url,
        };
      })
    );

    res.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    console.error('Server name:', getServerName(req));
    console.error('Bucket name:', BUCKET_NAME);
    res.status(500).json({ 
      error: 'Failed to fetch files',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete single file
router.delete('/files/:fileId(*)', async (req: Request, res: Response) => {
  try {
    // Initialize AWS SDK
    await initializeAwsSdk();
    
    if (!BUCKET_NAME) {
      return res.status(500).json({ error: 'Wasabi storage not configured' });
    }

    const fileId = req.params.fileId;
    const serverName = getServerName(req);
    
    // Ensure the file belongs to the current server
    if (!fileId.startsWith(serverName)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deleteParams = {
      Bucket: BUCKET_NAME,
      Key: fileId,
    };

    const command = new DeleteObjectCommand(deleteParams);
    await s3Client.send(command);
    
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Delete multiple files
router.delete('/files/batch', async (req: Request, res: Response) => {
  try {
    // Initialize AWS SDK
    await initializeAwsSdk();
    
    if (!BUCKET_NAME) {
      return res.status(500).json({ error: 'Wasabi storage not configured' });
    }

    const { fileIds } = deleteFilesSchema.parse(req.body);
    const serverName = getServerName(req);
    
    // Ensure all files belong to the current server
    const invalidFiles = fileIds.filter(id => !id.startsWith(serverName));
    if (invalidFiles.length > 0) {
      return res.status(403).json({ error: 'Access denied to some files' });
    }

    const deleteParams = {
      Bucket: BUCKET_NAME,
      Delete: {
        Objects: fileIds.map(id => ({ Key: id })),
        Quiet: false,
      },
    };

    const command = new DeleteObjectsCommand(deleteParams);
    const response = await s3Client.send(command);
    
    const deleted = response.Deleted || [];
    const errors = response.Errors || [];
    
    if (errors.length > 0) {
      console.error('Some files failed to delete:', errors);
      return res.status(207).json({
        success: true,
        message: `${deleted.length} files deleted successfully, ${errors.length} failed`,
        deleted: deleted.length,
        errors: errors.length,
      });
    }
    
    res.json({
      success: true,
      message: `${deleted.length} files deleted successfully`,
      deleted: deleted.length,
    });
  } catch (error) {
    console.error('Error deleting files:', error);
    res.status(500).json({ error: 'Failed to delete files' });
  }
});

// Get file metadata
router.get('/files/:fileId(*)/metadata', async (req: Request, res: Response) => {
  try {
    // Initialize AWS SDK
    await initializeAwsSdk();
    
    if (!BUCKET_NAME) {
      return res.status(500).json({ error: 'Wasabi storage not configured' });
    }

    const fileId = req.params.fileId;
    const serverName = getServerName(req);
    
    // Ensure the file belongs to the current server
    if (!fileId.startsWith(serverName)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const headParams = {
      Bucket: BUCKET_NAME,
      Key: fileId,
    };

    const command = new HeadObjectCommand(headParams);
    const response = await s3Client.send(command);
    
    const pathWithoutServer = fileId.replace(`${serverName}/`, '');
    const fileName = pathWithoutServer.split('/').pop() || '';
    
    const metadata = {
      id: fileId,
      name: fileName,
      path: pathWithoutServer,
      size: response.ContentLength || 0,
      type: getFileType(fileId),
      contentType: response.ContentType,
      lastModified: response.LastModified?.toISOString() || new Date().toISOString(),
      etag: response.ETag,
    };

    res.json(metadata);
  } catch (error) {
    console.error('Error fetching file metadata:', error);
    res.status(500).json({ error: 'Failed to fetch file metadata' });
  }
});

// Get storage settings for the current user
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const serverName = getServerName(req);
    const isPaidUser = (req as any).session?.user?.billingStatus === 'active' || false;
    
    // TODO: Get actual settings from database
    // For now, return defaults
    const settings = {
      overageLimit: STORAGE_LIMITS.DEFAULT_OVERAGE_LIMIT,
      overageEnabled: isPaidUser,
      isPaid: isPaidUser,
      limits: {
        freeLimit: STORAGE_LIMITS.FREE_TIER,
        paidLimit: STORAGE_LIMITS.PAID_TIER,
        defaultOverageLimit: STORAGE_LIMITS.DEFAULT_OVERAGE_LIMIT,
      },
    };
    
    res.json(settings);
  } catch (error) {
    console.error('Error fetching storage settings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch storage settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update storage settings (paid users only)
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const serverName = getServerName(req);
    const isPaidUser = (req as any).session?.user?.billingStatus === 'active' || false;
    
    if (!isPaidUser) {
      return res.status(403).json({ error: 'Storage settings are only available for paid users' });
    }
    
    const { overageLimit, overageEnabled } = updateStorageSettingsSchema.parse(req.body);
    
    // TODO: Save settings to database
    // For now, just validate and return success
    console.log(`Updating storage settings for ${serverName}:`, { overageLimit, overageEnabled });
    
    res.json({
      success: true,
      message: 'Storage settings updated successfully',
      settings: {
        overageLimit,
        overageEnabled,
        overageLimitFormatted: formatBytes(overageLimit),
      },
    });
  } catch (error) {
    console.error('Error updating storage settings:', error);
    res.status(500).json({ 
      error: 'Failed to update storage settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Check if a file can be uploaded
router.post('/check-upload', async (req: Request, res: Response) => {
  try {
    const { fileSize } = z.object({ fileSize: z.number().min(0) }).parse(req.body);
    
    const serverName = getServerName(req);
    const isPaidUser = (req as any).session?.user?.billingStatus === 'active' || false;
    
    // TODO: Get custom overage limit from user settings
    const customOverageLimit = undefined;
    
    const { canUploadFile } = await import('../services/storage-quota-service');
    const result = await canUploadFile(serverName, isPaidUser, fileSize, customOverageLimit);
    
    res.json({
      allowed: result.allowed,
      reason: result.reason,
      quota: result.quota ? {
        totalUsed: result.quota.totalUsed,
        totalUsedFormatted: formatBytes(result.quota.totalUsed),
        totalLimit: result.quota.totalLimit,
        totalLimitFormatted: formatBytes(result.quota.totalLimit),
        canUpload: result.quota.canUpload,
        isPaid: result.quota.isPaid,
        afterUpload: result.quota.totalUsed + fileSize,
        afterUploadFormatted: formatBytes(result.quota.totalUsed + fileSize),
      } : undefined,
    });
  } catch (error) {
    console.error('Error checking upload permission:', error);
    res.status(500).json({ 
      error: 'Failed to check upload permission',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;