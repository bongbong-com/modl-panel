import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import { setupApiRoutes } from "./api/routes";
import { setupVerificationAndProvisioningRoutes } from './routes/verify-provision';
import { connectToGlobalModlDb } from './db/connectionManager';
import { type Connection as MongooseConnection } from 'mongoose';

import appealRoutes from './routes/appeal-routes';
import playerRoutes from './routes/player-routes';
import settingsRoutes from './routes/settings-routes';
import staffRoutes from './routes/staff-routes';
import ticketRoutes from './routes/ticket-routes';
import logRoutes from './routes/log-routes';
import authRoutes from './routes/auth-routes';
import billingRoutes from './routes/billing-routes';
import { setupMinecraftRoutes } from './routes/minecraft-routes';
// import { checkPremiumAccess } from "./middleware/premium-access-middleware";

export async function registerRoutes(app: Express): Promise<Server> {
  let globalDbConnection: MongooseConnection | undefined = undefined;

  try {
    globalDbConnection = await connectToGlobalModlDb();
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    console.log('Falling back to in-memory storage');
  }

  setupApiRoutes(app);
  setupVerificationAndProvisioningRoutes(app);

  app.use('/api/appeals', appealRoutes);
  app.use('/api/players', playerRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/staff', staffRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/logs', logRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/billing', billingRoutes);
  
  setupMinecraftRoutes(app);

  app.get('/api/activity/recent', async (req, res) => {
    // TODO: Implement logic to fetch recent activity
    res.json([]);
  });

  app.get('/api/stats', async (req, res) => {
    try {
      if (!req.serverDbConnection) {
        console.error('Error fetching stats: No server-specific database connection found for this request.');
        return res.json({
          activePlayers: 153,
          openTickets: 28,
          modActions: 47,
          error: 'Server context not found, using fallback data.'
        });
      }

      const Player = req.serverDbConnection.model('Player');
      const Ticket = req.serverDbConnection.model('Ticket');
      
      const playerCount = await Player.countDocuments({});
      const openTickets = await Ticket.countDocuments({ 'data.status': { $ne: 'Closed' } });
      
      res.json({
        activePlayers: playerCount || 0,
        openTickets: openTickets || 0,
        modActions: 47
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.json({
        activePlayers: 153,
        openTickets: 28,
        modActions: 47,
        error: 'Failed to fetch stats from database, using fallback data.'
      });
    }
  });
  
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
