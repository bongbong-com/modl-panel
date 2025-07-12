import express from 'express';

const router = express.Router();

// Middleware to ensure database connection
router.use((req, res, next) => {
  if (!req.serverDbConnection) {
    return res.status(503).json({ error: 'Database connection not available' });
  }
  next();
});

// GET /api/panel/ticket-subscriptions - Get user's active subscriptions
router.get('/', async (req, res) => {
  try {
    const db = req.serverDbConnection;
    const staffUsername = req.session?.username;

    if (!staffUsername) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const TicketSubscription = db.model('TicketSubscription');
    const Ticket = db.model('Ticket');

    // Get active subscriptions for this staff member
    const subscriptions = await TicketSubscription.find({
      staffUsername,
      active: true
    }).lean();

    // Get ticket details for each subscription
    const subscriptionsWithDetails = [];
    
    for (const subscription of subscriptions) {
      try {
        const ticket = await Ticket.findById(subscription.ticketId).lean();
        if (ticket) {
          subscriptionsWithDetails.push({
            ticketId: subscription.ticketId,
            ticketTitle: ticket.subject || ticket.title || 'Untitled Ticket',
            subscribedAt: subscription.subscribedAt
          });
        }
      } catch (error) {
        console.error(`Error fetching ticket ${subscription.ticketId}:`, error);
      }
    }

    res.json(subscriptionsWithDetails);
  } catch (error) {
    console.error('Ticket subscriptions error:', error);
    res.status(500).json({ message: 'Failed to fetch ticket subscriptions' });
  }
});

// DELETE /api/panel/ticket-subscriptions/:ticketId - Unsubscribe from ticket
router.delete('/:ticketId', async (req, res) => {
  try {
    const db = req.serverDbConnection;
    const { ticketId } = req.params;
    const staffUsername = req.session?.username;

    if (!staffUsername) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const TicketSubscription = db.model('TicketSubscription');

    // Find and deactivate the subscription
    const result = await TicketSubscription.updateOne(
      { 
        ticketId, 
        staffUsername,
        active: true 
      },
      { 
        active: false,
        unsubscribedAt: new Date()
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    res.json({ message: 'Successfully unsubscribed from ticket' });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ message: 'Failed to unsubscribe from ticket' });
  }
});

// GET /api/panel/ticket-subscription-updates?limit=10 - Get recent updates for subscribed tickets  
router.get('/updates', async (req, res) => {
  try {
    const db = req.serverDbConnection;
    const { limit = 10 } = req.query;
    const staffUsername = req.session?.username;

    if (!staffUsername) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const TicketSubscription = db.model('TicketSubscription');
    const TicketSubscriptionUpdate = db.model('TicketSubscriptionUpdate');
    const Ticket = db.model('Ticket');

    // Get user's active subscriptions
    const subscriptions = await TicketSubscription.find({
      staffUsername,
      active: true
    }).select('ticketId').lean();

    const subscribedTicketIds = subscriptions.map(s => s.ticketId);

    if (subscribedTicketIds.length === 0) {
      return res.json([]);
    }

    // Get recent updates for subscribed tickets
    const updates = await TicketSubscriptionUpdate.find({
      ticketId: { $in: subscribedTicketIds }
    })
    .sort({ replyAt: -1 })
    .limit(parseInt(limit as string))
    .lean();

    // Get ticket details for each update
    const updatesWithDetails = [];
    
    for (const update of updates) {
      try {
        const ticket = await Ticket.findById(update.ticketId).lean();
        if (ticket) {
          updatesWithDetails.push({
            id: update._id.toString(),
            ticketId: update.ticketId,
            ticketTitle: ticket.subject || ticket.title || 'Untitled Ticket',
            replyContent: update.replyContent,
            replyBy: update.replyBy,
            replyAt: update.replyAt,
            isStaffReply: update.isStaffReply || false,
            isRead: update.readBy?.includes(staffUsername) || false
          });
        }
      } catch (error) {
        console.error(`Error fetching ticket ${update.ticketId}:`, error);
      }
    }

    res.json(updatesWithDetails);
  } catch (error) {
    console.error('Subscription updates error:', error);
    res.status(500).json({ message: 'Failed to fetch subscription updates' });
  }
});

// POST /api/panel/ticket-subscription-updates/:updateId/read - Mark update as read
router.post('/updates/:updateId/read', async (req, res) => {
  try {
    const db = req.serverDbConnection;
    const { updateId } = req.params;
    const staffUsername = req.session?.username;

    if (!staffUsername) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const TicketSubscriptionUpdate = db.model('TicketSubscriptionUpdate');

    // Add staff username to readBy array if not already present
    const result = await TicketSubscriptionUpdate.updateOne(
      { 
        _id: updateId,
        readBy: { $ne: staffUsername }
      },
      { 
        $addToSet: { readBy: staffUsername }
      }
    );

    res.json({ message: 'Update marked as read', modified: result.matchedCount > 0 });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'Failed to mark update as read' });
  }
});

// Helper function to create or ensure ticket subscription exists
export async function ensureTicketSubscription(db: any, ticketId: string, staffUsername: string) {
  try {
    const TicketSubscription = db.model('TicketSubscription');
    
    // Check if subscription already exists
    const existingSubscription = await TicketSubscription.findOne({
      ticketId,
      staffUsername
    });

    if (!existingSubscription) {
      // Create new subscription
      const newSubscription = new TicketSubscription({
        ticketId,
        staffUsername,
        subscribedAt: new Date(),
        active: true
      });
      
      await newSubscription.save();
      console.log(`Created ticket subscription for ${staffUsername} on ticket ${ticketId}`);
    } else if (!existingSubscription.active) {
      // Reactivate existing subscription
      existingSubscription.active = true;
      existingSubscription.subscribedAt = new Date();
      await existingSubscription.save();
      console.log(`Reactivated ticket subscription for ${staffUsername} on ticket ${ticketId}`);
    }
  } catch (error) {
    console.error('Error ensuring ticket subscription:', error);
  }
}

// Helper function to create subscription update when someone replies to a ticket
export async function createTicketSubscriptionUpdate(
  db: any, 
  ticketId: string, 
  replyContent: string, 
  replyBy: string, 
  isStaffReply: boolean = false
) {
  try {
    const TicketSubscriptionUpdate = db.model('TicketSubscriptionUpdate');
    
    const update = new TicketSubscriptionUpdate({
      ticketId,
      replyContent: replyContent.substring(0, 500), // Truncate long replies
      replyBy,
      replyAt: new Date(),
      isStaffReply,
      readBy: [] // No one has read it yet
    });
    
    await update.save();
    console.log(`Created ticket subscription update for ticket ${ticketId} by ${replyBy}`);
  } catch (error) {
    console.error('Error creating ticket subscription update:', error);
  }
}

export default router;