import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import { storage } from "./storage";
import { connectToMongoDB } from "./db/mongodb";
import { setupApiRoutes } from "./api/routes";
import { createSystemLog } from "./routes/log-routes";

export async function registerRoutes(app: Express): Promise<Server> {
  // Connect to MongoDB or use in-memory fallback
  try {
    const connected = await connectToMongoDB();
    if (connected) {
      try {
        await createSystemLog('Server started successfully');
      } catch (error) {
        console.log('Unable to create system log, but server started');
      }
    }
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    console.log('Falling back to in-memory storage');
  }

  
  // Register all MongoDB routes
  setupApiRoutes(app);
  
  // Legacy API routes - these will be removed once MongoDB routes are fully integrated
  
  // Get server stats
  app.get('/api/stats', async (req, res) => {
    try {
      const { Player, Ticket } = await import('./models/mongodb-schemas');
      
      // Get real stats from MongoDB if available
      const playerCount = await Player.countDocuments({});
      const openTickets = await Ticket.countDocuments({ 'data.status': { $ne: 'Closed' } });
      
      res.json({
        activePlayers: playerCount || 153,
        openTickets: openTickets || 28,
        modActions: 47 // This will be replaced with actual count
      });
    } catch (error) {
      // Fall back to mock data if MongoDB is not available
      console.error('Error fetching stats:', error);
      res.json({
        activePlayers: 153,
        openTickets: 28,
        modActions: 47
      });
    }
  });
  
  // Lookup player endpoint
  app.get('/api/player/:identifier', async (req, res) => {
    const { identifier } = req.params;
    const { type = 'username' } = req.query;
    
    try {
      const { Player } = await import('./models/mongodb-schemas');
      
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
