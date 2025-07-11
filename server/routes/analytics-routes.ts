import express from 'express';
import { startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, eachDayOfInterval, format } from 'date-fns';

const router = express.Router();

// Since this router is mounted under `/panel/analytics` and the panel router already applies authentication,
// we don't need additional auth middleware here. The isAuthenticated middleware is already applied.

// Middleware to ensure only admins can access analytics
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.currentUser || (req.currentUser.role !== 'Admin' && req.currentUser.role !== 'Super Admin')) {
    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }
  next();
};

router.use(requireAdmin);

// Get overview statistics
router.get('/overview', async (req, res) => {
  try {
    if (!req.serverDbConnection) {
      return res.status(503).json({ error: 'Database connection not available' });
    }
    
    const db = req.serverDbConnection;
    
    const Ticket = db.model('Ticket');
    const Player = db.model('Player');
    const Staff = db.model('Staff');
    const Log = db.model('Log');

    const now = new Date();
    const thirtyDaysAgo = subMonths(now, 1);
    const sixtyDaysAgo = subMonths(now, 2);

    // Get current counts
    const [totalTickets, totalPlayers, totalStaff, activeTickets] = await Promise.all([
      Ticket.countDocuments(),
      Player.countDocuments(),
      Staff.countDocuments(),
      Ticket.countDocuments({ status: { $in: ['Open', 'Under Review', 'Pending Player Response'] } })
    ]);

    // Get previous period counts for comparison
    const [prevTickets, prevPlayers] = await Promise.all([
      Ticket.countDocuments({ created: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
      Player.countDocuments({ 'usernames.date': { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } })
    ]);

    // Get recent period counts
    const [recentTickets, recentPlayers] = await Promise.all([
      Ticket.countDocuments({ created: { $gte: thirtyDaysAgo } }),
      Player.countDocuments({ 'usernames.date': { $gte: thirtyDaysAgo } })
    ]);

    // Calculate percentage changes
    const ticketChange = prevTickets > 0 ? ((recentTickets - prevTickets) / prevTickets) * 100 : 0;
    const playerChange = prevPlayers > 0 ? ((recentPlayers - prevPlayers) / prevPlayers) * 100 : 0;

    res.json({
      overview: {
        totalTickets,
        totalPlayers,
        totalStaff,
        activeTickets,
        ticketChange: Math.round(ticketChange),
        playerChange: Math.round(playerChange)
      }
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ message: 'Failed to fetch analytics overview' });
  }
});

// Get ticket analytics
router.get('/tickets', async (req, res) => {
  try {
    if (!req.serverDbConnection) {
      return res.status(503).json({ error: 'Database connection not available' });
    }
    
    const db = req.serverDbConnection;
    const Ticket = db.model('Ticket');
    
    const { period = '30d' } = req.query;
    let startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate = subMonths(new Date(), 0.25);
        break;
      case '30d':
        startDate = subMonths(new Date(), 1);
        break;
      case '90d':
        startDate = subMonths(new Date(), 3);
        break;
      case '1y':
        startDate = subMonths(new Date(), 12);
        break;
    }

    // Get tickets by status
    const ticketsByStatus = await Ticket.aggregate([
      { $match: { created: { $gte: startDate } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Get tickets by type
    const ticketsByType = await Ticket.aggregate([
      { $match: { created: { $gte: startDate } } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    // Get daily ticket trend
    const dailyTickets = await Ticket.aggregate([
      { $match: { created: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$created' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get average resolution time
    const resolvedTickets = await Ticket.find({
      status: 'Resolved',
      created: { $gte: startDate },
      updatedAt: { $exists: true }
    }).select('created updatedAt');

    let avgResolutionTime = 0;
    if (resolvedTickets.length > 0) {
      const totalTime = resolvedTickets.reduce((sum, ticket) => {
        const resolutionTime = ticket.updatedAt.getTime() - ticket.created.getTime();
        return sum + resolutionTime;
      }, 0);
      avgResolutionTime = Math.round(totalTime / resolvedTickets.length / (1000 * 60 * 60)); // Convert to hours
    }

    res.json({
      byStatus: ticketsByStatus.map(item => ({ status: item._id, count: item.count })),
      byType: ticketsByType.map(item => ({ type: item._id, count: item.count })),
      dailyTrend: dailyTickets.map(item => ({ date: item._id, count: item.count })),
      avgResolutionTime
    });
  } catch (error) {
    console.error('Ticket analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch ticket analytics' });
  }
});

// Get staff performance analytics
router.get('/staff-performance', async (req, res) => {
  try {
    if (!req.serverDbConnection) {
      return res.status(503).json({ error: 'Database connection not available' });
    }
    
    const db = req.serverDbConnection;
    const Ticket = db.model('Ticket');
    const Player = db.model('Player');
    const Staff = db.model('Staff');
    
    const { period = '30d' } = req.query;
    let startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate = subMonths(new Date(), 0.25);
        break;
      case '30d':
        startDate = subMonths(new Date(), 1);
        break;
      case '90d':
        startDate = subMonths(new Date(), 3);
        break;
    }

    const staffMembers = await Staff.find({});
    const staffPerformance = [];

    for (const staff of staffMembers) {
      // Count ticket responses
      const ticketResponses = await Ticket.countDocuments({
        'replies.name': staff.username,
        'replies.created': { $gte: startDate }
      });

      // Count punishments issued
      const punishmentsIssued = await Player.countDocuments({
        'punishments.issuerName': staff.username,
        'punishments.issued': { $gte: startDate }
      });

      // Count notes added
      const notesAdded = await Player.countDocuments({
        'notes.issuerName': staff.username,
        'notes.date': { $gte: startDate }
      });

      staffPerformance.push({
        id: staff._id,
        username: staff.username,
        role: staff.role,
        ticketResponses,
        punishmentsIssued,
        notesAdded,
        totalActions: ticketResponses + punishmentsIssued + notesAdded
      });
    }

    // Sort by total actions
    staffPerformance.sort((a, b) => b.totalActions - a.totalActions);

    res.json({ staffPerformance });
  } catch (error) {
    console.error('Staff performance analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch staff performance analytics' });
  }
});

// Get punishment analytics
router.get('/punishments', async (req, res) => {
  try {
    if (!req.serverDbConnection) {
      return res.status(503).json({ error: 'Database connection not available' });
    }
    
    const db = req.serverDbConnection;
    const Player = db.model('Player');
    
    const { period = '30d' } = req.query;
    let startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate = subMonths(new Date(), 0.25);
        break;
      case '30d':
        startDate = subMonths(new Date(), 1);
        break;
      case '90d':
        startDate = subMonths(new Date(), 3);
        break;
      case '1y':
        startDate = subMonths(new Date(), 12);
        break;
    }

    // Get punishments by type using both type field and type_ordinal as fallback
    const punishmentTypes = await Player.aggregate([
      { $unwind: '$punishments' },
      { $match: { 'punishments.issued': { $gte: startDate } } },
      {
        $group: {
          _id: {
            type: '$punishments.type',
            type_ordinal: '$punishments.type_ordinal'
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          type: {
            $cond: {
              if: { $and: [{ $ne: ['$_id.type', null] }, { $ne: ['$_id.type', ''] }] },
              then: '$_id.type',
              else: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$_id.type_ordinal', 0] }, then: 'Warning' },
                    { case: { $eq: ['$_id.type_ordinal', 1] }, then: 'Mute' },
                    { case: { $eq: ['$_id.type_ordinal', 2] }, then: 'Kick' },
                    { case: { $eq: ['$_id.type_ordinal', 3] }, then: 'Temporary Ban' },
                    { case: { $eq: ['$_id.type_ordinal', 4] }, then: 'Permanent Ban' }
                  ],
                  default: { $concat: ['Type ', { $toString: '$_id.type_ordinal' }] }
                }
              }
            }
          },
          count: 1
        }
      }
    ]);

    const punishmentsByType = punishmentTypes.map(item => ({
      type: item.type,
      count: item.count
    }));

    // Get daily punishment trend
    const dailyPunishments = await Player.aggregate([
      { $unwind: '$punishments' },
      { $match: { 'punishments.issued': { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$punishments.issued' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get top punishment reasons
    const topReasons = await Player.aggregate([
      { $unwind: '$punishments' },
      { $match: { 
        'punishments.issued': { $gte: startDate },
        'punishments.data.reason': { $exists: true }
      }},
      { $group: { _id: '$punishments.data.reason', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      byType: punishmentsByType,
      dailyTrend: dailyPunishments.map(item => ({ date: item._id, count: item.count })),
      topReasons: topReasons.map(item => ({ reason: item._id, count: item.count }))
    });
  } catch (error) {
    console.error('Punishment analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch punishment analytics' });
  }
});

// Get player activity analytics
router.get('/player-activity', async (req, res) => {
  try {
    if (!req.serverDbConnection) {
      return res.status(503).json({ error: 'Database connection not available' });
    }
    
    const db = req.serverDbConnection;
    const Player = db.model('Player');
    
    const { period = '30d' } = req.query;
    let startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate = subMonths(new Date(), 0.25);
        break;
      case '30d':
        startDate = subMonths(new Date(), 1);
        break;
      case '90d':
        startDate = subMonths(new Date(), 3);
        break;
    }

    // Get new players trend
    const newPlayersTrend = await Player.aggregate([
      { $unwind: '$usernames' },
      { $match: { 'usernames.date': { $gte: startDate } } },
      {
        $group: {
          _id: { 
            date: { $dateToString: { format: '%Y-%m-%d', date: '$usernames.date' } },
            uuid: '$minecraftUuid'
          }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get player login activity by country
    const loginsByCountry = await Player.aggregate([
      { $unwind: '$ipAddresses' },
      { $match: { 'ipAddresses.firstLogin': { $gte: startDate } } },
      { $group: { _id: '$ipAddresses.country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get suspicious activity (proxy/hosting IPs)
    const suspiciousActivity = await Player.aggregate([
      { $unwind: '$ipAddresses' },
      { $match: { 
        'ipAddresses.firstLogin': { $gte: startDate },
        $or: [
          { 'ipAddresses.proxy': true },
          { 'ipAddresses.hosting': true }
        ]
      }},
      { $group: { 
        _id: null, 
        proxyCount: { $sum: { $cond: ['$ipAddresses.proxy', 1, 0] } },
        hostingCount: { $sum: { $cond: ['$ipAddresses.hosting', 1, 0] } }
      }}
    ]);

    res.json({
      newPlayersTrend: newPlayersTrend.map(item => ({ date: item._id, count: item.count })),
      loginsByCountry: loginsByCountry.map(item => ({ 
        country: item._id || 'Unknown', 
        count: item.count 
      })),
      suspiciousActivity: suspiciousActivity[0] || { proxyCount: 0, hostingCount: 0 }
    });
  } catch (error) {
    console.error('Player activity analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch player activity analytics' });
  }
});

// Get audit log analytics
router.get('/audit-logs', async (req, res) => {
  try {
    if (!req.serverDbConnection) {
      return res.status(503).json({ error: 'Database connection not available' });
    }
    
    const db = req.serverDbConnection;
    const Log = db.model('Log');
    
    const { period = '7d' } = req.query;
    let startDate = new Date();
    
    switch (period) {
      case '24h':
        startDate = subMonths(new Date(), 0.033);
        break;
      case '7d':
        startDate = subMonths(new Date(), 0.25);
        break;
      case '30d':
        startDate = subMonths(new Date(), 1);
        break;
    }

    // Get logs by level
    const logsByLevel = await Log.aggregate([
      { $match: { created: { $gte: startDate } } },
      { $group: { _id: '$level', count: { $sum: 1 } } }
    ]);

    // Get logs by source
    const logsBySource = await Log.aggregate([
      { $match: { created: { $gte: startDate } } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get hourly log trend for last 24 hours
    const hourlyTrend = await Log.aggregate([
      { $match: { created: { $gte: subMonths(new Date(), 0.033) } } },
      {
        $group: {
          _id: { 
            $dateToString: { 
              format: '%Y-%m-%d %H:00', 
              date: '$created' 
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      byLevel: logsByLevel.map(item => ({ level: item._id, count: item.count })),
      bySource: logsBySource.map(item => ({ source: item._id, count: item.count })),
      hourlyTrend: hourlyTrend.map(item => ({ hour: item._id, count: item.count }))
    });
  } catch (error) {
    console.error('Audit log analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch audit log analytics' });
  }
});

export default router;