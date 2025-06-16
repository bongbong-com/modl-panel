import express, { Request, Response } from 'express';
import { handleCloudflareCustomDomain, verifyCloudflareCustomDomain, deleteCloudflareCustomDomain } from '../api/cloudflare';
import { Types } from 'mongoose';
import { ModlServerSchema } from '../models/modl-global-schemas';

interface IModlServer {
  _id: Types.ObjectId;
  customDomain_override?: string;
  customDomain_status?: 'pending' | 'active' | 'error' | 'verifying';
  customDomain_lastChecked?: Date;
  customDomain_error?: string;
}

const router = express.Router();

// Register the ModlServer schema at router level
router.use((req: Request, res: Response, next) => {
  const globalDb = req.serverDbConnection!;
  if (!globalDb.models.ModlServer) {
    globalDb.model('ModlServer', ModlServerSchema);
  }
  next();
});

// GET /domain - Get current domain configuration
router.get('/', async (req: Request, res: Response) => {
  try {
    const server = req.modlServer as IModlServer;
    if (!server) {
      return res.status(400).json({ error: 'Server context not found' });
    }

    res.json({
      customDomain: server.customDomain_override,
      status: {
        domain: server.customDomain_override,
        status: server.customDomain_status || 'pending',
        cnameConfigured: server.customDomain_status === 'active',
        sslStatus: server.customDomain_status === 'active' ? 'active' : 'pending',
        lastChecked: server.customDomain_lastChecked?.toISOString(),
        error: server.customDomain_error
      }
    });
  } catch (error: any) {
    console.error('Error fetching domain configuration:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// POST /domain - Create or update a custom domain for this server
router.post('/', async (req: Request, res: Response) => {
  try {
    const { customDomain } = req.body as { customDomain: string };
    const server = req.modlServer as IModlServer;
    if (!server) {
      return res.status(400).json({ error: 'Server context not found' });
    }
    if (!customDomain || typeof customDomain !== 'string') {
      return res.status(400).json({ error: 'Invalid domain name' });
    }
    // Check if domain is already in use by another server
    const globalDb = req.serverDbConnection!;
    const ServerModel = globalDb.model('ModlServer');
    const existingServer = await ServerModel.findOne({ 
      customDomain_override: customDomain,
      _id: { $ne: server._id }
    });
    if (existingServer) {
      return res.status(409).json({ error: 'Domain is already in use by another server' });
    }
    // Call Cloudflare API to create the custom hostname
    const cfResult = await handleCloudflareCustomDomain(customDomain, server._id.toString());
    // Update server configuration
    await ServerModel.findByIdAndUpdate(server._id, {
      customDomain_override: customDomain,
      customDomain_status: 'pending',
      customDomain_lastChecked: new Date(),
      customDomain_error: null
    });
    res.json({
      message: 'Domain configuration started. Please set up the CNAME record and then click Verify.',
      status: {
        domain: customDomain,
        status: 'pending',
        cnameConfigured: false,
        sslStatus: 'pending',
        lastChecked: new Date().toISOString(),
        error: undefined
      },
      cloudflare: cfResult
    });
  } catch (error: any) {
    console.error('Error configuring custom domain:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// POST /domain/verify - Verify DNS and activate SSL for the custom domain
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { domain } = req.body as { domain: string };
    const server = req.modlServer as IModlServer;
    if (!server) {
      return res.status(400).json({ error: 'Server context not found' });
    }
    // Call Cloudflare API to verify and activate the custom hostname
    const verifyResult = await verifyCloudflareCustomDomain(domain, server._id.toString());
    // Update server status in database
    const globalDb = req.serverDbConnection!;
    const ServerModel = globalDb.model('ModlServer');
    await ServerModel.findByIdAndUpdate(server._id, {
      customDomain_status: verifyResult.status,
      customDomain_lastChecked: new Date(),
      customDomain_error: verifyResult.error || null
    });
    res.json({ status: verifyResult });
  } catch (error: any) {
    console.error('Error verifying custom domain:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// DELETE /domain - Remove the custom domain and Cloudflare hostname
router.delete('/', async (req: Request, res: Response) => {
  try {
    const server = req.modlServer as IModlServer;
    if (!server) {
      return res.status(400).json({ error: 'Server context not found' });
    }
    if (!server.customDomain_override) {
      return res.status(400).json({ error: 'No custom domain configured' });
    }
    // Call Cloudflare API to delete the custom hostname
    await deleteCloudflareCustomDomain(server.customDomain_override, server._id.toString());
    // Remove custom domain from server config
    const globalDb = req.serverDbConnection!;
    const ServerModel = globalDb.model('ModlServer');
    await ServerModel.findByIdAndUpdate(server._id, {
      customDomain_override: null,
      customDomain_status: 'pending',
      customDomain_lastChecked: new Date(),
      customDomain_error: null
    });
    res.json({ message: 'Custom domain removed.' });
  } catch (error: any) {
    console.error('Error removing custom domain:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router; 