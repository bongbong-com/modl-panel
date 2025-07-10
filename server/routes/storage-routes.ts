import { Router } from 'express';
import { Request, Response } from 'express';
import { z } from 'zod';
import { S3Client, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const router = Router();

// Wasabi S3 client configuration
const s3Client = new S3Client({
  endpoint: process.env.WASABI_ENDPOINT || 'https://s3.wasabisys.com',
  region: process.env.WASABI_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY || '',
    secretAccessKey: process.env.WASABI_SECRET_KEY || '',
  },
});

const BUCKET_NAME = process.env.WASABI_BUCKET_NAME || 'modl-storage';

// Validation schemas
const deleteFilesSchema = z.object({
  fileIds: z.array(z.string()).min(1).max(100),
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

// Helper function to get tenant prefix from subdomain
const getTenantPrefix = (req: Request): string => {
  const subdomain = req.headers.host?.split('.')[0] || 'default';
  return `tenants/${subdomain}`;
};

// Get storage usage statistics
router.get('/usage', async (req: Request, res: Response) => {
  try {
    const tenantPrefix = getTenantPrefix(req);
    
    // List all objects for the tenant
    const listParams = {
      Bucket: BUCKET_NAME,
      Prefix: tenantPrefix,
      MaxKeys: 1000,
    };

    const command = new ListObjectsV2Command(listParams);
    const response = await s3Client.send(command);
    
    const objects = response.Contents || [];
    
    // Calculate usage by type
    const usage: StorageUsage = {
      totalUsed: 0,
      totalQuota: 10 * 1024 * 1024 * 1024, // 10GB default quota
      byType: {
        ticket: 0,
        evidence: 0,
        logs: 0,
        backup: 0,
        other: 0,
      },
    };

    objects.forEach(obj => {
      const size = obj.Size || 0;
      const type = getFileType(obj.Key || '');
      
      usage.totalUsed += size;
      usage.byType[type] += size;
    });

    res.json(usage);
  } catch (error) {
    console.error('Error fetching storage usage:', error);
    res.status(500).json({ error: 'Failed to fetch storage usage' });
  }
});

// Get list of files
router.get('/files', async (req: Request, res: Response) => {
  try {
    const tenantPrefix = getTenantPrefix(req);
    
    const listParams = {
      Bucket: BUCKET_NAME,
      Prefix: tenantPrefix,
      MaxKeys: 1000,
    };

    const command = new ListObjectsV2Command(listParams);
    const response = await s3Client.send(command);
    
    const objects = response.Contents || [];
    
    const files: StorageFile[] = await Promise.all(
      objects.map(async (obj) => {
        const key = obj.Key || '';
        const pathWithoutTenant = key.replace(`${tenantPrefix}/`, '');
        const fileName = pathWithoutTenant.split('/').pop() || '';
        
        // Generate presigned URL for download
        const getObjectCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        });
        
        const url = await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 3600 });
        
        return {
          id: key,
          name: fileName,
          path: pathWithoutTenant,
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
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Delete single file
router.delete('/files/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const tenantPrefix = getTenantPrefix(req);
    
    // Ensure the file belongs to the current tenant
    if (!fileId.startsWith(tenantPrefix)) {
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
    const { fileIds } = deleteFilesSchema.parse(req.body);
    const tenantPrefix = getTenantPrefix(req);
    
    // Ensure all files belong to the current tenant
    const invalidFiles = fileIds.filter(id => !id.startsWith(tenantPrefix));
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
router.get('/files/:fileId/metadata', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const tenantPrefix = getTenantPrefix(req);
    
    // Ensure the file belongs to the current tenant
    if (!fileId.startsWith(tenantPrefix)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const headParams = {
      Bucket: BUCKET_NAME,
      Key: fileId,
    };

    const command = new HeadObjectCommand(headParams);
    const response = await s3Client.send(command);
    
    const pathWithoutTenant = fileId.replace(`${tenantPrefix}/`, '');
    const fileName = pathWithoutTenant.split('/').pop() || '';
    
    const metadata = {
      id: fileId,
      name: fileName,
      path: pathWithoutTenant,
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

export default router;