import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import mongoose from 'mongoose'; // Added for mongoose.connection
import { storage } from "./storage";
import { connectToMongoDB } from "./db/mongodb";
import { setupApiRoutes } from "./api/routes";
import { setupVerificationAndProvisioningRoutes } from './routes/verify-provision';
import { connectToGlobalModlDb } from './db/connectionManager'; // Keep this
import { type Connection as MongooseConnection } from 'mongoose'; // Import Connection type

// Import new TypeScript routes
import appealRoutes from './routes/appeal-routes';
import playerRoutes from './routes/player-routes';
import settingsRoutes from './routes/settings-routes';
import staffRoutes from './routes/staff-routes';
import ticketRoutes from './routes/ticket-routes';
import logRoutes from './routes/log-routes'; // Import log routes
// Import setup function for minecraft routes
import { setupMinecraftRoutes } from './routes/minecraft-routes';

// provisioning-routes.ts does not seem to export a router for app.use, verify-provision.ts handles setup

export async function registerRoutes(app: Express): Promise<Server> {
  let globalDbConnection: MongooseConnection | undefined = undefined; // Variable to hold the connection

  // Connect to MongoDB or use in-memory fallback
  try {
    // Attempt to connect to the global MODL database first
    globalDbConnection = await connectToGlobalModlDb(); // Assign the connection
    // console.log('Successfully connected to Global MODL Database for server data (e.g., list of tenants).');

    // Removed: createSystemLog call that was using globalDbConnection for 'panel-main'
    // Panel-main specific logs, if needed, should use the main operational DB connection (mongoose.connection)
    // and ensure Log schema is registered there. For now, we are removing this to fix the MissingSchemaError
    // as logs are primarily tenant-specific.

    // Attempt to connect to the main operational DB for the panel (legacy/default connection)
    // This might be used by other parts of the app that rely on mongoose.connection
    const legacyMainDbConnected = await connectToMongoDB(); 
    if (legacyMainDbConnected) {
      // If this connection is also used for logging or critical ops, it should be handled here.
      // For now, we assume panel-main logs are handled by globalDbConnection.
      console.log('Legacy main panel DB (mongoose.defaultConnection) connected successfully.');
    } else {
      // This is where "No MongoDB URI provided, using in-memory simulation" would appear if it fails.
      console.log('Legacy main panel DB (mongoose.defaultConnection) might be using in-memory simulation or failed to connect.');
    }

  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    console.log('Falling back to in-memory storage');
  }

  
  // Register all MongoDB routes
  setupApiRoutes(app); // This handles /api/v1 routes (new TS multi-tenant API)
  setupVerificationAndProvisioningRoutes(app); // Handles /verify-email, /provision-server etc.

  // Register individual new TypeScript routes under /api base path
  app.use('/api/appeals', appealRoutes);
  app.use('/api/players', playerRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/staff', staffRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/logs', logRoutes); // Use log routes
  
  // Setup Minecraft routes (which internally add /minecraft prefix)
  setupMinecraftRoutes(app);

  // New route for recent activity
  app.get('/api/activity/recent', async (req, res) => {
    // TODO: Implement logic to fetch recent activity
    res.json([]); // Return empty array for now
  });

  // Legacy API routes - these will be removed once MongoDB routes are fully integrated
  
  // Get server stats
  app.get('/api/stats', async (req, res) => {
    try {
      // Ensure middleware has provided a server-specific connection
      if (!req.serverDbConnection) {
        console.error('Error fetching stats: No server-specific database connection found for this request.');
        // Fallback to mock data or return an error, as per original behavior for connection issues.
        // Matching the existing catch block's response structure.
        return res.json({
          activePlayers: 153,
          openTickets: 28,
          modActions: 47,
          error: 'Server context not found, using fallback data.'
        });
      }

      const Player = req.serverDbConnection.model('Player');
      const Ticket = req.serverDbConnection.model('Ticket');
      
      // Get real stats from MongoDB
      const playerCount = await Player.countDocuments({});
      const openTickets = await Ticket.countDocuments({ 'data.status': { $ne: 'Closed' } });
      
      res.json({
        activePlayers: playerCount || 0, // Default to 0 if null/undefined, rather than mock 153
        openTickets: openTickets || 0,   // Default to 0 if null/undefined, rather than mock 28
        modActions: 47 // This was previously hardcoded, keeping as is.
      });
    } catch (error) {
      // Fall back to mock data if MongoDB operations fail
      console.error('Error fetching stats:', error);
      res.json({
        activePlayers: 153, // Original fallback
        openTickets: 28,  // Original fallback
        modActions: 47,
        error: 'Failed to fetch stats from database, using fallback data.'
      });
    }
  });
  
  // Lookup player endpoint
  app.get('/api/player/:identifier', async (req, res) => {
    const { identifier } = req.params;
    const { type = 'username' } = req.query;
    
    try {
      // Ensure middleware has provided a server-specific connection
      if (!req.serverDbConnection) {
        console.error('Error looking up player: No server-specific database connection found for this request.');
        return res.status(500).json({
          error: 'Server error',
          message: 'Server context not found. Cannot lookup player.'
        });
      }
      const Player = req.serverDbConnection.model('Player');
      
      // Try to find player in MongoDB
      let query: any = {};
      if (type === 'uuid') {
        query = { minecraftUuid: identifier };
      } else {
        // Using a more forgiving approach
        // Search for usernames that contain the identifier
        // This will match "CraftMaster" with "CraftMaster123" and similar variants
        const escapedIdentifier = identifier.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        query = { 
          'usernames.username': { $regex: new RegExp(escapedIdentifier, 'i') }
        };
      }
      
      const player = await Player.findOne(query);
      
      if (player) {
        try {
          // Get the current username (most recent one)
          const currentUsername = player.usernames && player.usernames.length > 0 
            ? player.usernames[player.usernames.length - 1].username 
            : 'Unknown';
          
          // Format warnings and notes
          const warnings = player.notes && player.notes.length > 0 
            ? player.notes.map((note: any) => ({
                type: 'Warning',
                reason: note.text,
                date: note.date ? note.date.toISOString().split('T')[0] : 'Unknown',
                by: note.issuerName || 'System'
              }))
            : [];
          
          // Determine player status safely
          let status = 'Active';
          try {
            if (player.punishments && player.punishments.length > 0) {
              // Check if any active bans exist
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
            lastOnline: 'Unknown', // This would need to be tracked separately
            playtime: 'Unknown', // This would need to be tracked separately
            status,
            warnings
          });
        } catch (error) {
          console.error('Error formatting player data:', error);
          res.status(500).json({ error: 'Error processing player data' });
        }
      } else {
        // Return a 404 status with error message for better error handling
        res.status(404).json({
          error: 'Player not found',
          message: `No player found with username containing "${identifier}"`
        });
      }
    } catch (error) {
      console.error('Error looking up player:', error);
      // Return error message
      res.status(500).json({
        error: 'Server error',
        message: 'An error occurred while searching for the player'
      });
    }
  });

  const httpServer = createServer(app);
  
  // Set up WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    // Send initial connection confirmation
    ws.send(JSON.stringify({ type: 'connection', status: 'connected' }));
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('WebSocket message received:', data);
        
        // Handle different message types
        if (data.type === 'subscribe') {
          // Handle subscriptions to different data feeds
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
  
  // Function to broadcast updates to all connected clients
  const broadcastUpdate = (type: string, data: any) => {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type, data }));
      }
    });
  };
  
  // Attach broadcastUpdate to global app context for use in routes
  app.set('broadcastUpdate', broadcastUpdate);

  return httpServer;
}
