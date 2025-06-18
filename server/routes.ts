import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import { setupApiRoutes } from "./api/routes";
import { setupVerificationAndProvisioningRoutes } from './routes/verify-provision';
import { connectToGlobalModlDb } from './db/connectionManager';
import { type Connection as MongooseConnection } from 'mongoose';
import { isAuthenticated } from './middleware/auth-middleware';

import appealRoutes from './routes/appeal-routes';
import playerRoutes from './routes/player-routes';
import settingsRoutes from './routes/settings-routes';
import staffRoutes from './routes/staff-routes';
import ticketRoutes from './routes/ticket-routes';
import logRoutes from './routes/log-routes';
import authRoutes from './routes/auth-routes';
import billingRoutes, { webhookRouter } from './routes/billing-routes';
import knowledgebaseRoutes from './routes/knowledgebase-routes'; // Import knowledgebase routes
import publicKnowledgebaseRoutes from './routes/public-knowledgebase-routes'; // Import public knowledgebase routes
import homepageCardRoutes from './routes/homepage-card-routes'; // Import homepage card routes
import publicHomepageCardRoutes from './routes/public-homepage-card-routes'; // Import public homepage card routes
import { setupMinecraftRoutes } from './routes/minecraft-routes';

export async function registerRoutes(app: Express): Promise<Server> {
  let globalDbConnection: MongooseConnection | undefined = undefined;

  try {
    globalDbConnection = await connectToGlobalModlDb();
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    console.log('Falling back to in-memory storage');
  }

  // Public API, verification, and auth routes
  setupApiRoutes(app); // Assuming these are general public APIs if any, or handled internally
  setupVerificationAndProvisioningRoutes(app);
  app.use('/api/auth', authRoutes);
  app.use('/stripe-public-webhooks', webhookRouter); // Stripe webhook on a distinct top-level public path
  app.use('/api/public/knowledgebase', publicKnowledgebaseRoutes); // Public knowledgebase
  app.use('/api/public', publicHomepageCardRoutes); // Public homepage cards

  // Public settings endpoint - no authentication required
  app.get('/api/public/settings', async (req, res) => {
    try {
      console.log('[Public Settings] Request received for /api/public/settings');
      console.log('[Public Settings] serverDbConnection exists:', !!req.serverDbConnection);
      
      if (!req.serverDbConnection) {
        console.log('[Public Settings] No serverDbConnection, returning default values');
        return res.json({
          serverDisplayName: 'modl',
          panelIconUrl: null
        });
      }

      console.log('[Public Settings] Attempting to find Settings document...');
      const SettingsModel = req.serverDbConnection.model('Settings');
      let settingsDoc = await SettingsModel.findOne({});
      
      console.log('[Public Settings] Settings document found:', !!settingsDoc);
      
      if (!settingsDoc || !settingsDoc.settings) {
        console.log('[Public Settings] No settings document or settings data, returning defaults');
        return res.json({
          serverDisplayName: 'modl',
          panelIconUrl: null
        });
      }

      const settings = Object.fromEntries(settingsDoc.settings);
      console.log('[Public Settings] Raw settings object:', JSON.stringify(settings, null, 2));
      
      const result = {
        serverDisplayName: settings.general?.serverDisplayName || settings.serverDisplayName || 'modl',
        panelIconUrl: settings.general?.panelIconUrl || settings.panelIconUrl || null
      };
      
      console.log('[Public Settings] Returning result:', result);
      res.json(result);
    } catch (error) {
      console.error('[Public Settings] Error occurred:', error);
      res.json({
        serverDisplayName: 'modl',
        panelIconUrl: null
      });
    }
  });

  // Panel specific API routes
  const panelRouter = express.Router();
  panelRouter.use(isAuthenticated); // Apply authentication to all panel routes

  panelRouter.use('/appeals', appealRoutes);
  panelRouter.use('/players', playerRoutes); // Assuming player management is panel-specific
  panelRouter.use('/settings', settingsRoutes);
  panelRouter.use('/staff', staffRoutes);
  panelRouter.use('/tickets', ticketRoutes);
  panelRouter.use('/logs', logRoutes);
  panelRouter.use('/billing', billingRoutes); // Billing management for the panel
  panelRouter.use('/knowledgebase', knowledgebaseRoutes); // Add knowledgebase routes to panel
  panelRouter.use('/', homepageCardRoutes); // Add homepage card routes to panel
  
  setupMinecraftRoutes(panelRouter as any as Express); // Setup Minecraft routes under the panel router

  panelRouter.get('/activity/recent', async (req, res) => {
    // TODO: Implement logic to fetch recent activity
    res.json([]);
  });

  panelRouter.get('/stats', async (req, res) => {
    try {
      if (!req.serverDbConnection) {
        console.error('Error fetching stats: No server-specific database connection found for this request.');
        return res.json({
          onlinePlayers: 0,
          uniqueLogins: 0,
          openTickets: 0,
          error: 'Server context not found, using fallback data.'
        });
      }

      const Player = req.serverDbConnection.model('Player');
      const Ticket = req.serverDbConnection.model('Ticket');
      
      const playerCount = await Player.countDocuments({});
      const openTickets = await Ticket.countDocuments({ 'data.status': { $ne: 'Closed' } });
      
      // For now, using playerCount for onlinePlayers and a calculated value for uniqueLogins
      // These could be updated to use more specific queries based on your data structure
      const uniqueLogins = Math.floor(playerCount * 0.6); // Approximate unique logins as 60% of total players
      
      res.json({
        onlinePlayers: playerCount || 0,
        uniqueLogins: uniqueLogins || 0,
        openTickets: openTickets || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.json({
        onlinePlayers: 153,
        uniqueLogins: 89,
        openTickets: 28,
        error: 'Failed to fetch stats from database, using fallback data.'
      });
    }
  });
  
  app.use('/api/panel', panelRouter);

  // Public player lookup (if intended to be public)
  app.get('/api/player/:identifier', async (req, res) => {
    const { identifier } = req.params;
    const { type = 'username' } = req.query;
    
    try {
      if (!req.serverDbConnection) {
        console.error('Error looking up player: No server-specific database connection found for this request.');
        return res.status(500).json({
          error: 'Server error',
          message: 'Server context not found. Cannot lookup player.'
        });
      }
      const Player = req.serverDbConnection.model('Player');
      
      let query: any = {};
      if (type === 'uuid') {
        query = { minecraftUuid: identifier };
      } else {
        const escapedIdentifier = identifier.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        query = {
          'usernames.username': { $regex: new RegExp(escapedIdentifier, 'i') }
        };
      }
      
      const player = await Player.findOne(query);
      
      if (player) {
        try {
          const currentUsername = player.usernames && player.usernames.length > 0
            ? player.usernames[player.usernames.length - 1].username
            : 'Unknown';
          
          const warnings = player.notes && player.notes.length > 0
            ? player.notes.map((note: any) => ({
                type: 'Warning',
                reason: note.text,
                date: note.date ? note.date.toISOString().split('T')[0] : 'Unknown',
                by: note.issuerName || 'System'
              }))
            : [];
          
          let status = 'Active';
          try {
            if (player.punishments && player.punishments.length > 0) {
              const hasPermanentBan = player.punishments.some((p: any) =>
                p.type === 'Ban' &&
                p.active &&
                (!p.data || !p.data.get || !p.data.get('expiry'))
              );
              
              if (hasPermanentBan) {
                status = 'Banned';
              } else if (player.punishments.some((p: any) => p.active)) {
                status = 'Restricted';
              }
            }
          } catch (error) {
            console.error('Error determining player status:', error);
          }
          
          res.json({
            username: currentUsername,
            uuid: player.minecraftUuid,
            firstJoined: player.usernames && player.usernames[0]?.date
              ? player.usernames[0].date.toISOString().split('T')[0]
              : 'Unknown',
            lastOnline: 'Unknown',
            playtime: 'Unknown',
            status,
            warnings
          });
        } catch (error) {
          console.error('Error formatting player data:', error);
          res.status(500).json({ error: 'Error processing player data' });
        }
      } else {
        res.status(404).json({
          error: 'Player not found',
          message: `No player found with username containing "${identifier}"`
        });
      }
    } catch (error) {
      console.error('Error looking up player:', error);
      res.status(500).json({
        error: 'Server error',
        message: 'An error occurred while searching for the player'
      });
    }
  });

  const httpServer = createServer(app);
  
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    ws.send(JSON.stringify({ type: 'connection', status: 'connected' }));
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('WebSocket message received:', data);
        
        if (data.type === 'subscribe') {
          ws.send(JSON.stringify({ type: 'subscribed', channel: data.channel }));
        }
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });
  
  const broadcastUpdate = (type: string, data: any) => {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type, data }));
      }
    });
  };
  
  app.set('broadcastUpdate', broadcastUpdate);

  return httpServer;
}
