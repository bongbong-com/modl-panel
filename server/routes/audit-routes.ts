import express from 'express';

const router = express.Router();

// Since this router is mounted under `/panel/audit` and the panel router already applies authentication,
// we don't need additional auth middleware here. The isAuthenticated middleware is already applied.

// Middleware to ensure only admins can access audit routes
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.currentUser || (req.currentUser.role !== 'Admin' && req.currentUser.role !== 'Super Admin')) {
    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }
  next();
};

router.use(requireAdmin);

// Get staff performance analytics
router.get('/staff-performance', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    if (!req.serverDbConnection) {
      return res.status(503).json({ error: 'Database connection not available' });
    }
    
    const db = req.serverDbConnection;
    
    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Aggregate staff performance data using mongoose model
    const Log = db.model('Log');
    const staffPerformance = await Log.aggregate([
      {
        $match: {
          created: { $gte: startDate },
          source: { $ne: 'system' }
        }
      },
      {
        $group: {
          _id: '$source',
          totalActions: { $sum: 1 },
          ticketActions: {
            $sum: {
              $cond: [
                { $regexMatch: { input: '$description', regex: /ticket/i } },
                1,
                0
              ]
            }
          },
          moderationActions: {
            $sum: {
              $cond: [
                { $or: [
                  { $eq: ['$level', 'moderation'] },
                  { $regexMatch: { input: '$description', regex: /ban|mute|kick|punishment/i } }
                ]},
                1,
                0
              ]
            }
          },
          lastActive: { $max: '$created' },
          avgResponseTime: { $avg: '$metadata.responseTime' }
        }
      },
      {
        $project: {
          username: '$_id',
          totalActions: 1,
          ticketResponses: '$ticketActions',
          punishmentsIssued: '$moderationActions',
          lastActive: 1,
          avgResponseTime: { $ifNull: ['$avgResponseTime', 60] } // Default 60 minutes if no data
        }
      },
      {
        $sort: { totalActions: -1 }
      }
    ]);

    // Get staff roles from staff collection
    const Staff = db.model('Staff');
    const staffWithRoles = await Promise.all(
      staffPerformance.map(async (staff) => {
        const userDoc = await Staff.findOne({ username: staff.username });
        return {
          id: staff._id,
          username: staff.username,
          role: userDoc?.role || 'User',
          totalActions: staff.totalActions,
          ticketResponses: staff.ticketResponses,
          punishmentsIssued: staff.punishmentsIssued,
          avgResponseTime: Math.round(staff.avgResponseTime),
          lastActive: staff.lastActive
        };
      })
    );

    res.json(staffWithRoles);
  } catch (error) {
    console.error('Error fetching staff performance:', error);
    res.status(500).json({ error: 'Failed to fetch staff performance data' });
  }
});

// Get detailed staff member analytics
router.get('/staff/:username/details', async (req, res) => {
  try {
    const { username } = req.params;
    const { period = '30d' } = req.query;
    
    if (!req.serverDbConnection) {
      return res.status(503).json({ error: 'Database connection not available' });
    }
    
    const db = req.serverDbConnection;
    
    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const Log = db.model('Log');
    const Player = db.model('Player');
    const Ticket = db.model('Ticket');

    // Get detailed punishment data for this staff member
    const punishments = await Player.aggregate([
      { $unwind: '$punishments' },
      { 
        $match: { 
          'punishments.issuerName': username,
          'punishments.issued': { $gte: startDate }
        }
      },
      {
        $lookup: {
          from: 'players',
          localField: 'minecraftUuid',
          foreignField: 'minecraftUuid',
          as: 'playerInfo'
        }
      },
      {
        $project: {
          playerId: '$minecraftUuid',
          playerName: { 
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ['$usernames', []] } }, 0] },
              then: { $arrayElemAt: ['$usernames.username', -1] },
              else: 'Unknown'
            }
          },
          type: {
            $cond: {
              if: { $and: [{ $ne: ['$punishments.type', null] }, { $ne: ['$punishments.type', ''] }] },
              then: '$punishments.type',
              else: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$punishments.type_ordinal', 0] }, then: 'Warning' },
                    { case: { $eq: ['$punishments.type_ordinal', 1] }, then: 'Mute' },
                    { case: { $eq: ['$punishments.type_ordinal', 2] }, then: 'Kick' },
                    { case: { $eq: ['$punishments.type_ordinal', 3] }, then: 'Temporary Ban' },
                    { case: { $eq: ['$punishments.type_ordinal', 4] }, then: 'Permanent Ban' }
                  ],
                  default: 'Unknown'
                }
              }
            }
          },
          reason: '$punishments.data.reason',
          duration: '$punishments.data.duration',
          issued: '$punishments.issued',
          active: '$punishments.active'
        }
      },
      { $sort: { issued: -1 } },
      { $limit: 20 }
    ]);

    // Get tickets handled by this staff member
    const tickets = await Ticket.find({
      $or: [
        { assignedTo: username },
        { 'messages.sender': username }
      ],
      created: { $gte: startDate }
    })
    .sort({ created: -1 })
    .limit(20)
    .select('_id subject category status created priority messages');

    // Calculate response times for tickets
    const ticketResponseTimes = tickets.map(ticket => {
      if (ticket.messages && ticket.messages.length > 0) {
        const staffMessages = ticket.messages.filter(msg => msg.sender === username);
        if (staffMessages.length > 0) {
          const firstResponse = staffMessages[0];
          const responseTime = new Date(firstResponse.timestamp).getTime() - new Date(ticket.created).getTime();
          return {
            ticketId: ticket._id,
            subject: ticket.subject,
            status: ticket.status,
            responseTime: Math.round(responseTime / (1000 * 60)), // in minutes
            created: ticket.created
          };
        }
      }
      return null;
    }).filter(Boolean);

    // Get daily activity breakdown
    const dailyActivity = await Log.aggregate([
      {
        $match: {
          source: username,
          created: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: { $dateFromString: { dateString: '$created' } }
            }
          },
          punishments: {
            $sum: {
              $cond: [
                { $or: [
                  { $eq: ['$level', 'moderation'] },
                  { $regexMatch: { input: '$description', regex: /ban|mute|kick|warn/i } }
                ]},
                1,
                0
              ]
            }
          },
          tickets: {
            $sum: {
              $cond: [
                { $regexMatch: { input: '$description', regex: /ticket/i } },
                1,
                0
              ]
            }
          },
          evidence: {
            $sum: {
              $cond: [
                { $regexMatch: { input: '$description', regex: /evidence|upload|file/i } },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get punishment type breakdown for this staff member
    const punishmentTypeBreakdown = await Player.aggregate([
      { $unwind: '$punishments' },
      { 
        $match: { 
          'punishments.issuerName': username,
          'punishments.issued': { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $cond: {
              if: { $and: [{ $ne: ['$punishments.type', null] }, { $ne: ['$punishments.type', ''] }] },
              then: '$punishments.type',
              else: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$punishments.type_ordinal', 0] }, then: 'Warning' },
                    { case: { $eq: ['$punishments.type_ordinal', 1] }, then: 'Mute' },
                    { case: { $eq: ['$punishments.type_ordinal', 2] }, then: 'Kick' },
                    { case: { $eq: ['$punishments.type_ordinal', 3] }, then: 'Temporary Ban' },
                    { case: { $eq: ['$punishments.type_ordinal', 4] }, then: 'Permanent Ban' }
                  ],
                  default: 'Unknown'
                }
              }
            }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Count evidence uploads (from logs)
    const evidenceUploads = await Log.countDocuments({
      source: username,
      created: { $gte: startDate },
      $or: [
        { description: { $regex: /evidence|upload|file/i } },
        { level: 'info', description: { $regex: /uploaded|attachment/i } }
      ]
    });

    res.json({
      username,
      period,
      punishments: punishments,
      tickets: ticketResponseTimes,
      dailyActivity: dailyActivity.map(day => ({
        date: day._id,
        punishments: day.punishments,
        tickets: day.tickets,
        evidence: day.evidence
      })),
      punishmentTypeBreakdown: punishmentTypeBreakdown.map(item => ({
        type: item._id,
        count: item.count
      })),
      evidenceUploads,
      summary: {
        totalPunishments: punishments.length,
        totalTickets: tickets.length,
        avgResponseTime: ticketResponseTimes.length > 0 
          ? Math.round(ticketResponseTimes.reduce((sum, t) => sum + t.responseTime, 0) / ticketResponseTimes.length)
          : 0,
        evidenceUploads
      }
    });
  } catch (error) {
    console.error('Error fetching staff details:', error);
    res.status(500).json({ error: 'Failed to fetch staff details' });
  }
});

// Get punishment analytics for rollback functionality
router.get('/punishments', async (req, res) => {
  try {
    const { limit = 50, canRollback } = req.query;
    
    if (!req.serverDbConnection) {
      return res.status(503).json({ error: 'Database connection not available' });
    }
    
    const db = req.serverDbConnection;

    // Get punishment logs from the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const Log = db.model('Log');
    const punishments = await Log.find({
      created: { $gte: thirtyDaysAgo },
      $or: [
        { level: 'moderation' },
        { description: { $regex: /ban|mute|kick|warn/i } }
      ],
      ...(canRollback === 'true' && {
        'metadata.canRollback': { $ne: false }
      })
    })
    .sort({ created: -1 })
    .limit(parseInt(limit as string));

    const formattedPunishments = punishments.map(log => ({
      id: log._id,
      type: extractPunishmentType(log.description),
      playerId: log.metadata?.playerId || 'unknown',
      playerName: log.metadata?.playerName || extractPlayerName(log.description),
      staffId: log.metadata?.staffId || log.source,
      staffName: log.source,
      reason: log.metadata?.reason || extractReason(log.description),
      duration: log.metadata?.duration,
      timestamp: log.created,
      canRollback: log.metadata?.canRollback !== false
    }));

    res.json(formattedPunishments);
  } catch (error) {
    console.error('Error fetching punishments:', error);
    res.status(500).json({ error: 'Failed to fetch punishment data' });
  }
});

// Rollback a punishment
router.post('/punishments/:id/rollback', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Admin rollback' } = req.body;
    
    if (!req.serverDbConnection) {
      return res.status(503).json({ error: 'Database connection not available' });
    }
    
    const db = req.serverDbConnection;

    // Find the original punishment
    const Log = db.model('Log');
    const punishment = await Log.findById(id);
    
    if (!punishment) {
      return res.status(404).json({ error: 'Punishment not found' });
    }

    if (punishment.metadata?.canRollback === false) {
      return res.status(400).json({ error: 'This punishment cannot be rolled back' });
    }

    // Create rollback log entry
    const rollbackLog = {
      created: new Date().toISOString(),
      level: 'moderation',
      source: req.currentUser?.username || 'system',
      description: `Rolled back ${extractPunishmentType(punishment.description)} for ${punishment.metadata?.playerName || 'unknown player'}`,
      metadata: {
        originalPunishmentId: id,
        rollbackReason: reason,
        originalPunishment: {
          type: extractPunishmentType(punishment.description),
          player: punishment.metadata?.playerName,
          staff: punishment.source,
          originalReason: punishment.metadata?.reason
        }
      }
    };

    // Insert rollback log
    await Log.create(rollbackLog);

    // Mark original punishment as rolled back
    await Log.findByIdAndUpdate(id, { 
      $set: { 
        'metadata.rolledBack': true,
        'metadata.rollbackDate': new Date().toISOString(),
        'metadata.rollbackBy': req.currentUser?.username
      }
    });

    // TODO: Integrate with Minecraft server to actually reverse the punishment
    // This would involve calling the Minecraft API to unban/unmute the player

    res.json({ 
      success: true, 
      message: 'Punishment rolled back successfully',
      rollbackId: rollbackLog.id
    });
  } catch (error) {
    console.error('Error rolling back punishment:', error);
    res.status(500).json({ error: 'Failed to rollback punishment' });
  }
});

// Get database exploration data
router.get('/database/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const { limit = 100, skip = 0 } = req.query;
    
    if (!req.serverDbConnection) {
      return res.status(503).json({ error: 'Database connection not available' });
    }
    
    const db = req.serverDbConnection;

    // Validate table name for security
    const allowedTables = ['players', 'tickets', 'staff', 'punishments', 'logs', 'settings'];
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    let modelName = '';
    let pipeline: any[] = [];

    // Special handling for different "tables" (collections)
    switch (table) {
      case 'players':
        modelName = 'Player';
        pipeline = [
          {
            $project: {
              uuid: '$minecraftUuid',
              username: { 
                $cond: {
                  if: { $gt: [{ $size: { $ifNull: ['$usernames', []] } }, 0] },
                  then: { $arrayElemAt: ['$usernames.username', -1] },
                  else: 'Unknown'
                }
              },
              joinDate: { $arrayElemAt: ['$usernames.date', 0] },
              lastSeen: '$lastSeen',
              punishmentCount: { $size: { $ifNull: ['$punishments', []] } },
              noteCount: { $size: { $ifNull: ['$notes', []] } }
            }
          }
        ];
        break;

      case 'staff':
        modelName = 'Staff';
        pipeline = [
          {
            $project: {
              username: 1,
              email: 1,
              role: 1,
              joinDate: '$createdAt',
              lastActive: 1,
              permissions: 1
            }
          }
        ];
        break;

      case 'punishments':
        modelName = 'Log';
        pipeline = [
          {
            $match: {
              $or: [
                { level: 'moderation' },
                { description: { $regex: /ban|mute|kick|warn/i } }
              ]
            }
          },
          {
            $project: {
              description: 1,
              player: '$metadata.playerName',
              staff: '$source',
              reason: '$metadata.reason',
              duration: '$metadata.duration',
              created: 1,
              rolledBack: '$metadata.rolledBack'
            }
          }
        ];
        break;

      case 'tickets':
        modelName = 'Ticket';
        pipeline = [
          {
            $project: {
              subject: 1,
              category: 1,
              status: 1,
              creator: 1,
              assignedTo: 1,
              created: 1,
              priority: 1
            }
          }
        ];
        break;

      case 'logs':
        modelName = 'Log';
        pipeline = [
          {
            $project: {
              level: 1,
              source: 1,
              description: 1,
              created: 1
            }
          }
        ];
        break;

      default:
        modelName = 'Settings';
        pipeline = [
          { $project: { password: 0, sensitiveData: 0 } } // Exclude sensitive fields
        ];
    }

    // Add pagination
    pipeline.push(
      { $skip: parseInt(skip as string) },
      { $limit: parseInt(limit as string) }
    );

    const Model = db.model(modelName);
    const data = await Model.aggregate(pipeline);
    const total = await Model.countDocuments(
      pipeline[0]?.$match || {}
    );

    res.json({
      data,
      total,
      page: Math.floor(parseInt(skip as string) / parseInt(limit as string)) + 1,
      hasMore: parseInt(skip as string) + data.length < total
    });
  } catch (error) {
    console.error('Error fetching database data:', error);
    res.status(500).json({ error: 'Failed to fetch database data' });
  }
});

// Get advanced analytics data
router.get('/analytics', async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    if (!req.serverDbConnection) {
      return res.status(503).json({ error: 'Database connection not available' });
    }
    
    const db = req.serverDbConnection;

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let days: number;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        days = 7;
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        days = 30;
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        days = 90;
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        days = 7;
    }

    // Daily activity trends
    const Log = db.model('Log');
    const dailyActivity = await Log.aggregate([
      {
        $match: { created: { $gte: startDate } }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: { $dateFromString: { dateString: '$created' } }
            }
          },
          total: { $sum: 1 },
          moderation: {
            $sum: {
              $cond: [
                { $or: [
                  { $eq: ['$level', 'moderation'] },
                  { $regexMatch: { input: '$description', regex: /ban|mute|kick/i } }
                ]},
                1,
                0
              ]
            }
          },
          tickets: {
            $sum: {
              $cond: [
                { $regexMatch: { input: '$description', regex: /ticket/i } },
                1,
                0
              ]
            }
          },
          errors: {
            $sum: {
              $cond: [{ $eq: ['$level', 'error'] }, 1, 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Action type distribution
    const actionDistribution = await Log.aggregate([
      {
        $match: { created: { $gte: startDate } }
      },
      {
        $group: {
          _id: null,
          moderation: {
            $sum: {
              $cond: [
                { $or: [
                  { $eq: ['$level', 'moderation'] },
                  { $regexMatch: { input: '$description', regex: /ban|mute|kick/i } }
                ]},
                1,
                0
              ]
            }
          },
          tickets: {
            $sum: {
              $cond: [
                { $regexMatch: { input: '$description', regex: /ticket/i } },
                1,
                0
              ]
            }
          },
          system: {
            $sum: {
              $cond: [{ $eq: ['$source', 'system'] }, 1, 0]
            }
          },
          user: {
            $sum: {
              $cond: [
                { $and: [
                  { $ne: ['$source', 'system'] },
                  { $ne: ['$level', 'moderation'] },
                  { $not: { $regexMatch: { input: '$description', regex: /ticket|ban|mute|kick/i } } }
                ]},
                1,
                0
              ]
            }
          },
          settings: {
            $sum: {
              $cond: [
                { $regexMatch: { input: '$description', regex: /setting|config/i } },
                1,
                0
              ]
            }
          },
          errors: {
            $sum: {
              $cond: [{ $eq: ['$level', 'error'] }, 1, 0]
            }
          }
        }
      }
    ]);

    res.json({
      dailyActivity: dailyActivity.map(day => ({
        date: day._id,
        total: day.total,
        moderation: day.moderation,
        tickets: day.tickets,
        errors: day.errors
      })),
      actionDistribution: actionDistribution[0] || {
        moderation: 0,
        tickets: 0,
        system: 0,
        user: 0,
        settings: 0,
        errors: 0
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

// Helper functions
function extractPunishmentType(description: string): string {
  const desc = description.toLowerCase();
  if (desc.includes('ban')) return 'ban';
  if (desc.includes('mute')) return 'mute';
  if (desc.includes('kick')) return 'kick';
  if (desc.includes('warn')) return 'warn';
  return 'unknown';
}

function extractPlayerName(description: string): string {
  // Try to extract player name from description
  const matches = description.match(/player\s+(\w+)/i) || 
                 description.match(/user\s+(\w+)/i) ||
                 description.match(/(\w+)\s+(was|has been)/i);
  
  return matches ? matches[1] : 'Unknown Player';
}

function extractReason(description: string): string {
  // Try to extract reason from description
  const reasonMatch = description.match(/reason:\s*(.+?)(?:\.|$)/i) ||
                     description.match(/for\s+(.+?)(?:\.|$)/i);
  
  return reasonMatch ? reasonMatch[1].trim() : 'No reason specified';
}

export default router;