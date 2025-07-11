import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from '../middleware/permissions';

const router = Router();

// Apply authentication and permission middleware to all routes
router.use(requireAuth);
router.use(hasPermission('ADMIN_ANALYTICS_VIEW'));

// Get staff performance analytics
router.get('/staff-performance', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const { db } = req;
    
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

    // Aggregate staff performance data
    const staffPerformance = await db.collection('logs').aggregate([
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
    ]).toArray();

    // Get staff roles from users collection
    const staffWithRoles = await Promise.all(
      staffPerformance.map(async (staff) => {
        const userDoc = await db.collection('users').findOne({ username: staff.username });
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

// Get punishment analytics for rollback functionality
router.get('/punishments', async (req, res) => {
  try {
    const { limit = 50, canRollback } = req.query;
    const { db } = req;

    // Get punishment logs from the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const punishments = await db.collection('logs').find({
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
    .limit(parseInt(limit as string))
    .toArray();

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
    const { db } = req;

    // Find the original punishment
    const punishment = await db.collection('logs').findOne({ _id: id });
    
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
      source: req.user?.username || 'system',
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
    await db.collection('logs').insertOne(rollbackLog);

    // Mark original punishment as rolled back
    await db.collection('logs').updateOne(
      { _id: id },
      { 
        $set: { 
          'metadata.rolledBack': true,
          'metadata.rollbackDate': new Date().toISOString(),
          'metadata.rollbackBy': req.user?.username
        }
      }
    );

    // TODO: Integrate with Minecraft server to actually reverse the punishment
    // This would involve calling the Minecraft API to unban/unmute the player

    res.json({ 
      success: true, 
      message: 'Punishment rolled back successfully',
      rollbackId: rollbackLog._id
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
    const { db } = req;

    // Validate table name for security
    const allowedTables = ['players', 'tickets', 'staff', 'punishments', 'logs', 'settings'];
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    let collection = table;
    let pipeline: any[] = [];

    // Special handling for different "tables" (collections)
    switch (table) {
      case 'players':
        collection = 'users';
        pipeline = [
          { $match: { role: { $in: [null, 'User'] } } },
          {
            $lookup: {
              from: 'logs',
              let: { username: '$username' },
              pipeline: [
                { $match: { $expr: { $eq: ['$metadata.playerName', '$$username'] } } },
                { $match: { level: 'moderation' } }
              ],
              as: 'punishments'
            }
          },
          {
            $lookup: {
              from: 'tickets',
              localField: 'username',
              foreignField: 'creator',
              as: 'tickets'
            }
          },
          {
            $project: {
              username: 1,
              joinDate: '$createdAt',
              lastSeen: '$lastActive',
              punishments: { $size: '$punishments' },
              tickets: { $size: '$tickets' },
              email: 1,
              verified: 1
            }
          }
        ];
        break;

      case 'staff':
        collection = 'users';
        pipeline = [
          { $match: { role: { $in: ['Admin', 'Moderator', 'Helper', 'Owner'] } } },
          {
            $project: {
              username: 1,
              role: 1,
              joinDate: '$createdAt',
              lastActive: 1,
              permissions: 1
            }
          }
        ];
        break;

      case 'punishments':
        collection = 'logs';
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
              type: { $function: { body: `function(desc) { 
                if (desc.includes('ban')) return 'ban';
                if (desc.includes('mute')) return 'mute';
                if (desc.includes('kick')) return 'kick';
                if (desc.includes('warn')) return 'warn';
                return 'unknown';
              }`, args: ['$description'], lang: 'js' } },
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

      default:
        // For other collections, just return basic data
        pipeline = [
          { $project: { password: 0, sensitiveData: 0 } } // Exclude sensitive fields
        ];
    }

    // Add pagination
    pipeline.push(
      { $skip: parseInt(skip as string) },
      { $limit: parseInt(limit as string) }
    );

    const data = await db.collection(collection).aggregate(pipeline).toArray();
    const total = await db.collection(collection).countDocuments(
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
    const { db } = req;

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
    const dailyActivity = await db.collection('logs').aggregate([
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
    ]).toArray();

    // Action type distribution
    const actionDistribution = await db.collection('logs').aggregate([
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
    ]).toArray();

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