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

    const Staff = db.model('Staff');
    const Ticket = db.model('Ticket');

    // Get staff member with their subscriptions
    const staff = await Staff.findOne({ username: staffUsername }).lean();
    
    if (!staff || !staff.subscribedTickets) {
      return res.json([]);
    }

    // Filter active subscriptions and get ticket details
    const subscriptionsWithDetails = [];
    
    for (const subscription of staff.subscribedTickets) {
      if (!subscription.active) continue;
      
      try {
        const ticket = await Ticket.findById(subscription.ticketId).lean();
        if (ticket) {
          subscriptionsWithDetails.push({
            ticketId: subscription.ticketId.toString(),
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

    const Staff = db.model('Staff');

    // Find and deactivate the subscription in the staff document
    const result = await Staff.updateOne(
      { 
        username: staffUsername,
        'subscribedTickets.ticketId': ticketId,
        'subscribedTickets.active': true
      },
      { 
        $set: {
          'subscribedTickets.$.active': false
        }
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

    const Staff = db.model('Staff');
    const Ticket = db.model('Ticket');

    // Get staff member with their subscriptions
    const staff = await Staff.findOne({ username: staffUsername }).lean();
    
    if (!staff || !staff.subscribedTickets) {
      return res.json([]);
    }

    const subscribedTicketIds = staff.subscribedTickets
      .filter(sub => sub.active)
      .map(sub => sub.ticketId);

    if (subscribedTicketIds.length === 0) {
      return res.json([]);
    }

    // Get tickets with recent activity
    const tickets = await Ticket.find({
      _id: { $in: subscribedTicketIds },
      $or: [
        { 'replies.0': { $exists: true } },
        { 'messages.0': { $exists: true } }
      ]
    }).sort({ updatedAt: -1 }).limit(parseInt(limit as string) * 2).lean();

    const updatesWithDetails = [];
    
    for (const ticket of tickets) {
      const subscription = staff.subscribedTickets.find(
        sub => sub.ticketId.toString() === ticket._id.toString()
      );
      
      if (!subscription) continue;

      // Get recent replies/messages
      const replies = ticket.replies || ticket.messages || [];
      const recentReplies = replies
        .filter(reply => new Date(reply.created || reply.timestamp || reply.replyAt) > new Date(subscription.subscribedAt))
        .sort((a, b) => new Date(b.created || b.timestamp || b.replyAt).getTime() - new Date(a.created || a.timestamp || a.replyAt).getTime())
        .slice(0, 3); // Max 3 recent replies per ticket

      for (const reply of recentReplies) {
        const replyDate = new Date(reply.created || reply.timestamp || reply.replyAt);
        const isRead = subscription.lastReadAt && replyDate <= new Date(subscription.lastReadAt);
        
        updatesWithDetails.push({
          id: `${ticket._id}-${reply.id || reply._id || Date.now()}`,
          ticketId: ticket._id.toString(),
          ticketTitle: ticket.subject || ticket.title || 'Untitled Ticket',
          replyContent: reply.content || reply.message || reply.text || 'No content',
          replyBy: reply.name || reply.sender || reply.author || 'Unknown',
          replyAt: replyDate,
          isStaffReply: reply.staff || reply.senderType === 'staff' || false,
          isRead: isRead || false
        });
      }

      if (updatesWithDetails.length >= parseInt(limit as string)) {
        break;
      }
    }

    // Sort all updates by date and limit
    updatesWithDetails.sort((a, b) => new Date(b.replyAt).getTime() - new Date(a.replyAt).getTime());
    
    res.json(updatesWithDetails.slice(0, parseInt(limit as string)));
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

    // Extract ticketId from updateId (format: ticketId-replyId)
    const ticketId = updateId.split('-')[0];
    
    if (!ticketId) {
      return res.status(400).json({ message: 'Invalid update ID' });
    }

    const Staff = db.model('Staff');

    // Update the lastReadAt timestamp for this ticket subscription
    const result = await Staff.updateOne(
      { 
        username: staffUsername,
        'subscribedTickets.ticketId': ticketId,
        'subscribedTickets.active': true
      },
      { 
        $set: {
          'subscribedTickets.$.lastReadAt': new Date()
        }
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
    const Staff = db.model('Staff');
    
    // Find staff member
    const staff = await Staff.findOne({ username: staffUsername });
    
    if (!staff) {
      console.error(`Staff member ${staffUsername} not found`);
      return;
    }

    // Initialize subscribedTickets array if it doesn't exist
    if (!staff.subscribedTickets) {
      staff.subscribedTickets = [];
    }

    // Check if subscription already exists
    const existingSubscriptionIndex = staff.subscribedTickets.findIndex(
      sub => sub.ticketId.toString() === ticketId
    );

    if (existingSubscriptionIndex === -1) {
      // Create new subscription
      staff.subscribedTickets.push({
        ticketId: ticketId,
        subscribedAt: new Date(),
        active: true
      });
      
      await staff.save();
      console.log(`Created ticket subscription for ${staffUsername} on ticket ${ticketId}`);
    } else {
      // Reactivate existing subscription if inactive
      const existingSubscription = staff.subscribedTickets[existingSubscriptionIndex];
      if (!existingSubscription.active) {
        existingSubscription.active = true;
        existingSubscription.subscribedAt = new Date();
        
        await staff.save();
        console.log(`Reactivated ticket subscription for ${staffUsername} on ticket ${ticketId}`);
      }
    }
  } catch (error) {
    console.error('Error ensuring ticket subscription:', error);
  }
}

// Helper function to mark ticket as read when staff opens it
export async function markTicketAsRead(db: any, ticketId: string, staffUsername: string) {
  try {
    const Staff = db.model('Staff');
    
    // Update the lastReadAt timestamp for this ticket subscription
    await Staff.updateOne(
      { 
        username: staffUsername,
        'subscribedTickets.ticketId': ticketId,
        'subscribedTickets.active': true
      },
      { 
        $set: {
          'subscribedTickets.$.lastReadAt': new Date()
        }
      }
    );
    
    console.log(`Marked ticket ${ticketId} as read for ${staffUsername}`);
  } catch (error) {
    console.error('Error marking ticket as read:', error);
  }
}

export default router;