import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes for game server moderation panel
  
  // Get server stats
  app.get('/api/stats', async (req, res) => {
    res.json({
      activePlayers: 153,
      openTickets: 28,
      modActions: 47
    });
  });
  
  // Lookup player
  app.get('/api/player/:identifier', async (req, res) => {
    const { identifier } = req.params;
    const { type = 'username' } = req.query;
    
    // In a real app, this would query the database
    res.json({
      username: 'DragonSlayer123',
      uuid: '12a3b456-7c89-123a-4b5c-6d7890123e4f',
      firstJoined: '2023-01-15',
      lastOnline: '2 hours ago',
      playtime: '342 hours',
      status: 'Active',
      warnings: [
        {
          type: 'Warning',
          reason: 'Excessive caps in chat',
          date: '2023-04-12',
          by: 'Moderator2'
        }
      ]
    });
  });
  
  // Get tickets
  app.get('/api/tickets', async (req, res) => {
    const { type, status } = req.query;
    
    // In a real app, this would filter tickets from the database
    res.json([
      {
        id: '#BUG-1234',
        type: 'bug',
        subject: 'Item disappears when dropped in lava biome',
        reportedBy: 'MinerGuy42',
        date: '2 hours ago',
        status: 'Open',
        priority: 'Critical'
      }
    ]);
  });
  
  // Get audit logs
  app.get('/api/audit', async (req, res) => {
    const { actionType } = req.query;
    
    // In a real app, this would filter audit logs from the database
    res.json([
      {
        user: 'Moderator2',
        userType: 'Staff',
        actionType: 'staff',
        action: 'Banned player "HackerDude420" for "Using prohibited client mods"',
        detail: 'Ban Duration: 30 days',
        time: '10 minutes ago'
      }
    ]);
  });
  
  // Update settings
  app.post('/api/settings', async (req, res) => {
    const { section, settings } = req.body;
    
    // In a real app, this would save settings to the database
    res.json({ success: true });
  });

  const httpServer = createServer(app);

  return httpServer;
}
