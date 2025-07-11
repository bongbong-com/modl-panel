import { Request, Response, NextFunction } from 'express';
import { canUploadFile } from '../services/storage-quota-service';

export interface StorageQuotaRequest extends Request {
  storageQuotaCheck?: {
    allowed: boolean;
    reason?: string;
    quota?: any;
  };
}

/**
 * Middleware to check storage quotas before file uploads
 */
export const checkStorageQuota = async (req: StorageQuotaRequest, res: Response, next: NextFunction) => {
  try {
    // Get server name from request
    const serverName = (req as any).session?.serverName || req.headers.host?.split('.')[0] || 'default';
    
    // Get user's billing status
    const isPaidUser = (req as any).session?.user?.billingStatus === 'active' || false;
    
    // Get file size from request
    let fileSize = 0;
    
    // Check if file size is in body (for pre-upload checks)
    if (req.body?.fileSize) {
      fileSize = parseInt(req.body.fileSize, 10);
    }
    // Check if file is already uploaded (multer)
    else if (req.file) {
      fileSize = req.file.size;
    }
    // Check if files are uploaded (multer multiple)
    else if (req.files) {
      if (Array.isArray(req.files)) {
        fileSize = req.files.reduce((total, file) => total + file.size, 0);
      } else {
        // Handle multer fields object
        fileSize = Object.values(req.files).flat().reduce((total, file) => total + file.size, 0);
      }
    }
    
    if (fileSize === 0) {
      // No file to check, proceed
      return next();
    }
    
    // TODO: Get custom overage limit from user settings
    const customOverageLimit = undefined;
    
    // Check if upload is allowed
    const result = await canUploadFile(serverName, isPaidUser, fileSize, customOverageLimit);
    
    // Add result to request object for later use
    req.storageQuotaCheck = {
      allowed: result.allowed,
      reason: result.reason,
      quota: result.quota,
    };
    
    // If not allowed, reject the request
    if (!result.allowed) {
      return res.status(413).json({
        error: 'Storage quota exceeded',
        message: result.reason,
        quota: result.quota ? {
          totalUsed: result.quota.totalUsed,
          totalLimit: result.quota.totalLimit,
          isPaid: result.quota.isPaid,
          canUpload: result.quota.canUpload,
        } : undefined,
      });
    }
    
    // Proceed to next middleware
    next();
  } catch (error) {
    console.error('Error checking storage quota:', error);
    res.status(500).json({
      error: 'Failed to check storage quota',
      message: 'Unable to verify storage limits. Please try again.',
    });
  }
};

/**
 * Middleware to check storage quotas based on file size in request body
 */
export const checkStorageQuotaBySize = (fileSizeField: string = 'fileSize') => {
  return async (req: StorageQuotaRequest, res: Response, next: NextFunction) => {
    try {
      const serverName = (req as any).session?.serverName || req.headers.host?.split('.')[0] || 'default';
      const isPaidUser = (req as any).session?.user?.billingStatus === 'active' || false;
      
      const fileSize = parseInt(req.body[fileSizeField] || '0', 10);
      
      if (fileSize === 0) {
        return next();
      }
      
      const customOverageLimit = undefined;
      const result = await canUploadFile(serverName, isPaidUser, fileSize, customOverageLimit);
      
      req.storageQuotaCheck = {
        allowed: result.allowed,
        reason: result.reason,
        quota: result.quota,
      };
      
      if (!result.allowed) {
        return res.status(413).json({
          error: 'Storage quota exceeded',
          message: result.reason,
          quota: result.quota ? {
            totalUsed: result.quota.totalUsed,
            totalLimit: result.quota.totalLimit,
            isPaid: result.quota.isPaid,
            canUpload: result.quota.canUpload,
          } : undefined,
        });
      }
      
      next();
    } catch (error) {
      console.error('Error checking storage quota by size:', error);
      res.status(500).json({
        error: 'Failed to check storage quota',
        message: 'Unable to verify storage limits. Please try again.',
      });
    }
  };
};

/**
 * Middleware to get storage quota information without blocking request
 */
export const getStorageQuotaInfo = async (req: StorageQuotaRequest, res: Response, next: NextFunction) => {
  try {
    const serverName = (req as any).session?.serverName || req.headers.host?.split('.')[0] || 'default';
    const isPaidUser = (req as any).session?.user?.billingStatus === 'active' || false;
    
    const { getStorageQuota } = await import('../services/storage-quota-service');
    const quota = await getStorageQuota(serverName, isPaidUser);
    
    req.storageQuotaCheck = {
      allowed: quota.canUpload,
      quota: quota,
    };
    
    next();
  } catch (error) {
    console.error('Error getting storage quota info:', error);
    // Don't block the request on error, just proceed without quota info
    next();
  }
};