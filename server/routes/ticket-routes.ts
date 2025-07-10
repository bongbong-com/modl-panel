import express, { Request, Response, NextFunction } from 'express';
import { Document as MongooseDocument, Connection } from 'mongoose';
import { isAuthenticated } from '../middleware/auth-middleware';
import { checkPermission } from '../middleware/permission-middleware';
import AIModerationService from '../services/ai-moderation-service';
import { IReply, ITicket } from 'modl-shared-web/types';

interface INote {
  text: string;
  issuerName: string;
  issuerAvatar?: string;
  date: Date;
}

interface IReply {
  name: string;
  avatar?: string;
  content: string;
  type: string; // e.g., 'public', 'internal'
  created: Date;
  staff: boolean;
  action?: string; // Action taken with this reply (e.g., 'Close', 'Pardon', 'Reduce')
}

interface ITicket extends MongooseDocument {
  _id: string; // Ticket ID, e.g., CATEGORY-123456
  category: string;
  tags: string[];
  created: Date;
  creator: string; // UUID of the creator
  creatorName?: string;
  creatorAvatar?: string;
  notes: INote[];
  replies: IReply[];
  data: Map<string, any>; // For custom fields
  status: string; // e.g., 'Open', 'Closed', 'In Progress'
  assignedTo?: string; // Staff username or ID
  priority?: string; // e.g., 'Low', 'Medium', 'High'
  locked?: boolean;
}

/**
 * Add a notification to a player's pending notifications
 * If player is not found, the notification is skipped
 */
async function addNotificationToPlayer(
  dbConnection: Connection, 
  playerUuid: string, 
  notificationId: string
): Promise<void> {
  try {
    const Player = dbConnection.model('Player');
    await Player.updateOne(
      { minecraftUuid: playerUuid },
      { $addToSet: { pendingNotifications: notificationId } }
    );
  } catch (error) {
    console.error(`Error adding notification to player ${playerUuid}:`, error);
  }
}

/**
 * Create a notification for a staff reply to a ticket
 * Returns the notification ID that can be stored in pendingNotifications
 */
function createTicketReplyNotification(ticketId: string, staffName: string, replyContent: string): string {
  // Create a unique notification ID
  const notificationId = `ticket-reply-${ticketId}-${Date.now()}`;
  
  // For now, we'll just return the ID. Later this could be expanded to store
  // full notification data in a separate notifications collection
  return notificationId;
}

/**
 * Get and clear pending notifications for a player
 * Returns the notifications and removes them from the player's pendingNotifications array
 */
async function getAndClearPlayerNotifications(
  dbConnection: Connection, 
  playerUuid: string
): Promise<string[]> {
  try {
    const Player = dbConnection.model('Player');
    const player = await Player.findOne({ minecraftUuid: playerUuid });
    
    if (!player || !player.pendingNotifications || player.pendingNotifications.length === 0) {
      return [];
    }
    
    const notifications = [...player.pendingNotifications];
    
    // Clear the notifications
    await Player.updateOne(
      { minecraftUuid: playerUuid },
      { $set: { pendingNotifications: [] } }
    );
    
    return notifications;
  } catch (error) {
    console.error(`Error getting notifications for player ${playerUuid}:`, error);
    return [];
  }
}

const router = express.Router();

router.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.serverDbConnection) {
    return res.status(503).json({ error: 'Service unavailable. Database connection not established.' });
  }
  if (!req.serverName) {
    return res.status(500).json({ error: 'Internal server error. Server name missing.' });
  }
  next();
});

router.use(isAuthenticated);

function getCategoryFromType(type: string): string {
  switch(type) {
    case 'bug': return 'Bug Report';
    case 'player': return 'Player Report';
    case 'chat': return 'Chat Report';
    case 'appeal': return 'Ban Appeal';
    case 'staff': return 'Staff Application';
    case 'support': return 'General Support';
    default: return 'Other';
  }
}

router.get('/', checkPermission('ticket.view.all'), async (req: Request, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model('Ticket');
    const tickets = await Ticket.find({ status: { $ne: 'Unfinished' } }).lean();
    
    const transformedTickets = tickets.map((ticket: any) => ({
      id: ticket._id,
      subject: ticket.subject || 'No Subject',
      status: ticket.status,
      reportedBy: ticket.creator,
      date: ticket.created,
      category: getCategoryFromType(ticket.type),
      locked: ticket.locked || false,
      type: ticket.type
    }));
    
    res.json(transformedTickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const ticket: ITicket | null = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Manually construct the object to send, ensuring Maps are converted
    const transformedTicket = {
      id: ticket._id,
      subject: ticket.subject || 'No Subject',
      status: ticket.status,
      type: ticket.type,
      category: getCategoryFromType(ticket.type),
      reportedBy: ticket.creator || 'Unknown',
      date: ticket.created,
      locked: ticket.locked || false,
      formData: ticket.formData ? Object.fromEntries(ticket.formData) : {},
      reportedPlayer: ticket.reportedPlayer,
      reportedPlayerUuid: ticket.reportedPlayerUuid,
      creator: ticket.creator,
      creatorUuid: ticket.creatorUuid,
      chatMessages: ticket.chatMessages || [],
      messages: ticket.replies?.map((reply: any) => ({
        id: reply._id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sender: reply.name,
        senderType: reply.type,
        content: reply.content,
        timestamp: reply.created,
        staff: reply.staff,
        closedAs: reply.action
      })) || [],
      notes: ticket.notes || [],
      tags: ticket.tags || [],
      data: ticket.data ? Object.fromEntries(ticket.data) : {} // Correctly convert Map to object
    };
    
    res.json(transformedTicket);
  } catch (error: any) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

interface CreateTicketBody {
  category: string;
  creator: string; // UUID
  tags?: string[];
  data?: Record<string, any>;
  creatorName?: string;
  creatorAvatar?: string;
}

router.post('/', async (req: Request<{}, {}, CreateTicketBody>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const { category, creator, tags, data, creatorName, creatorAvatar } = req.body;
    
    const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
    const ticketId = `${category.toUpperCase()}-${randomDigits}`;

    const newTicket = new Ticket({
      _id: ticketId,
      category,
      tags: tags || [],
      created: new Date(),
      creator, // UUID
      creatorName,
      creatorAvatar,
      notes: [],
      replies: [],
      data: data || new Map(),
      status: 'Open', // Default status
    });

    await newTicket.save();

    // Trigger AI analysis for Player Report tickets with chat messages
    if (req.serverDbConnection) {
      try {
        const aiModerationService = new AIModerationService(req.serverDbConnection);
        await aiModerationService.processNewTicket(ticketId, newTicket);
      } catch (aiError) {
        console.error(`[Ticket Routes] AI moderation processing failed for ticket ${ticketId}:`, aiError);
        // Don't fail the ticket creation if AI processing fails
      }
    }

    res.status(201).json(newTicket);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

interface AddNoteBody {
  text: string;
  issuerName: string;
  issuerAvatar?: string;
}

router.post('/:id/notes', async (req: Request<{ id: string }, {}, AddNoteBody>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const newNote: INote = {
      text: req.body.text,
      issuerName: req.body.issuerName,
      issuerAvatar: req.body.issuerAvatar,
      date: new Date(),
    };

    ticket.notes.push(newNote);
    await ticket.save();

    res.status(201).json(newNote);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

interface AddReplyBody {
  name: string;
  content: string;
  type: string;
  staff?: boolean;
  avatar?: string;
}

router.post('/:id/replies', checkPermission('ticket.reply.all'), async (req: Request<{ id: string }, {}, AddReplyBody>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const newReply: IReply = {
      name: req.body.name,
      avatar: req.body.avatar,
      content: req.body.content,
      type: req.body.type,
      created: new Date(),
      staff: req.body.staff || false,
    };

    ticket.replies.push(newReply);
    await ticket.save();

    // Add notification for staff replies
    if (newReply.staff && ticket.creator) {
      const notificationId = createTicketReplyNotification(
        req.params.id, 
        newReply.name, 
        newReply.content
      );
      await addNotificationToPlayer(req.serverDbConnection!, ticket.creator, notificationId);
      
      // Send email notification if ticket has creator email
      if (ticket.data && (ticket.data.get('creatorEmail') || ticket.data.get('contactEmail') || ticket.data.get('contact_email'))) {
        try {
          const TicketEmailService = (await import('../services/ticket-email-service')).default;
          const emailService = new TicketEmailService();
          
          await emailService.sendTicketReplyNotification({
            ticketId: ticket._id,
            ticketSubject: ticket.subject,
            ticketType: ticket.type,
            playerName: ticket.creator,
            playerEmail: ticket.data.get('creatorEmail') || ticket.data.get('contactEmail') || ticket.data.get('contact_email'),
            replyContent: newReply.content,
            replyAuthor: newReply.name,
            isStaffReply: newReply.staff,
            serverName: req.serverName
          });
        } catch (emailError) {
          console.error(`[Staff Reply] Failed to send email notification for ticket ${req.params.id}:`, emailError);
          // Don't fail the reply if email fails
        }
      }
    }

    res.status(201).json(newReply);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

interface AddTagBody {
  tag: string;
  staffName?: string;
}

router.post('/:id/tags', async (req: Request<{ id: string }, {}, AddTagBody>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const tagToAdd = req.body.tag;
    if (!ticket.tags.includes(tagToAdd)) {
      ticket.tags.push(tagToAdd);
      await ticket.save();

    }

    res.status(200).json(ticket.tags);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

interface RemoveTagBody {
    staffName?: string;
}

router.delete('/:id/tags/:tag', async (req: Request<{ id: string, tag: string }, {}, RemoveTagBody>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const tagToRemove = req.params.tag;
    const initialLength = ticket.tags.length;
    ticket.tags = ticket.tags.filter(tag => tag !== tagToRemove);

    if (ticket.tags.length < initialLength) {
      await ticket.save();
    }

    res.status(200).json(ticket.tags);  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

interface UpdateTicketBody {
  status?: string;
  locked?: boolean;
  newReply?: {
    id: string;
    name: string;
    type: string;
    content: string;
    created: Date;
    staff: boolean;
    action?: string;
  };
  newNote?: {
    content: string;
    author: string;
    date: string;
  };
  tags?: string[];
  data?: Record<string, any>;
}

// General PATCH route for ticket updates
router.patch('/:id', checkPermission('ticket.close.all'), async (req: Request<{ id: string }, {}, UpdateTicketBody>, res: Response) => {
  console.log(`[Ticket PATCH] Updating ticket ${req.params.id}`);
  console.log(`[Ticket PATCH] Request body:`, JSON.stringify(req.body, null, 2));
  
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const updates = req.body;

    // Update status if provided
    if (updates.status !== undefined) {
      ticket.status = updates.status;
    }

    // Update locked status if provided
    if (updates.locked !== undefined) {
      ticket.locked = updates.locked;
    }

    // Add new reply if provided
    if (updates.newReply) {
      const newReply: IReply = {
        name: updates.newReply.name,
        content: updates.newReply.content,
        type: updates.newReply.type,
        created: new Date(updates.newReply.created),
        staff: updates.newReply.staff,
        action: updates.newReply.action
      };
      ticket.replies.push(newReply);

      // Add notification for staff replies
      if (newReply.staff && ticket.creator) {
        console.log(`[Ticket PATCH] Staff reply detected from ${newReply.name}`);
        
        const notificationId = createTicketReplyNotification(
          req.params.id, 
          newReply.name, 
          newReply.content
        );
        await addNotificationToPlayer(req.serverDbConnection!, ticket.creator, notificationId);
        
        // Send email notification if ticket has creator email
        const emailField = ticket.data?.get('creatorEmail') || ticket.data?.get('contactEmail') || ticket.data?.get('contact_email');
        console.log(`[Ticket PATCH] Checking for email field. Found: ${emailField}`);
        console.log(`[Ticket PATCH] ticket.data keys:`, ticket.data ? Array.from(ticket.data.keys()) : 'No data');
        
        if (ticket.data && emailField) {
          try {
            const TicketEmailService = (await import('../services/ticket-email-service')).default;
            const emailService = new TicketEmailService();
            
            await emailService.sendTicketReplyNotification({
              ticketId: ticket._id,
              ticketSubject: ticket.subject,
              ticketType: ticket.type,
              playerName: ticket.creator,
              playerEmail: emailField,
              replyContent: newReply.content,
              replyAuthor: newReply.name,
              isStaffReply: newReply.staff,
              serverName: req.serverName
            });
            console.log(`[Ticket PATCH] Email notification sent successfully to ${emailField}`);
          } catch (emailError) {
            console.error(`[Staff PATCH Reply] Failed to send email notification for ticket ${req.params.id}:`, emailError);
            // Don't fail the reply if email fails
          }
        }
      }
    }

    // Add new note if provided
    if (updates.newNote) {
      const newNote: INote = {
        text: updates.newNote.content,
        issuerName: updates.newNote.author,
        date: new Date(updates.newNote.date)
      };
      ticket.notes.push(newNote);
    }

    // Update tags if provided
    if (updates.tags !== undefined) {
      ticket.tags = updates.tags;
    }


    // Update data fields if provided
    if (updates.data && typeof updates.data === 'object') {
      for (const [key, value] of Object.entries(updates.data)) {
        ticket.data.set(key, value);
      }
    }

    await ticket.save();

    // Return the updated ticket
    res.status(200).json({
      id: ticket._id,
      status: ticket.status,
      tags: ticket.tags,
      notes: ticket.notes,
      replies: ticket.replies,
      data: Object.fromEntries(ticket.data),
      locked: ticket.locked || false
    });
  } catch (error: any) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

interface UpdateTicketDataBody {
  data: Record<string, any>; // This will contain fields like status, assignedTo, priority, or custom data fields
  staffName?: string;
}

router.patch('/:id/data', async (req: Request<{ id: string }, {}, UpdateTicketDataBody>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Assuming req.body.data is an object with key-value pairs to update in ticket.data (Map)
    if (req.body.data && typeof req.body.data === 'object') {
      for (const [key, value] of Object.entries(req.body.data)) {
        ticket.data.set(key, value);
      }
      await ticket.save();

    }

    res.status(200).json(Object.fromEntries(ticket.data)); // Convert Map to object for JSON response
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

router.get('/tag/:tag', async (req: Request<{ tag: string }>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const tickets = await Ticket.find({ tags: req.params.tag });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/creator/:uuid', async (req: Request<{ uuid: string }>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const tickets = await Ticket.find({ creatorUuid: req.params.uuid });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all tickets involving a player (both created by them and reports against them)
router.get('/player/:uuid', async (req: Request<{ uuid: string }>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    
    // Find tickets where the player is either the creator OR the reported player
    // Exclude unfinished tickets
    const tickets = await Ticket.find({
      $and: [
        {
          $or: [
            { creatorUuid: req.params.uuid },
            { reportedPlayerUuid: req.params.uuid }
          ]
        },
        { status: { $ne: 'Unfinished' } }
      ]
    }).sort({ created: -1 }); // Sort by creation date, newest first
    
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Quick Response endpoint
interface QuickResponseBody {
  actionId: string;
  categoryId: string;
  punishmentTypeId?: number;
  punishmentSeverity?: 'low' | 'regular' | 'severe';
  customValues?: any;
  appealAction?: 'pardon' | 'reduce' | 'reject' | 'none';
}

router.post('/:id/quick-response', checkPermission('ticket.reply.all'), async (req: Request<{ id: string }, {}, QuickResponseBody>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const Settings = req.serverDbConnection!.model('Settings');
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Get quick responses configuration from settings
    const settingsDoc = await Settings.findOne();
    if (!settingsDoc || !settingsDoc.settings) {
      return res.status(500).json({ error: 'Settings not found' });
    }

    const quickResponsesConfig = settingsDoc.settings.get('quickResponses');
    if (!quickResponsesConfig) {
      return res.status(500).json({ error: 'Quick responses configuration not found' });
    }

    // Find the specific action
    const category = quickResponsesConfig.categories.find((cat: any) => cat.id === req.body.categoryId);
    if (!category) {
      return res.status(400).json({ error: 'Category not found' });
    }

    const action = category.actions.find((act: any) => act.id === req.body.actionId);
    if (!action) {
      return res.status(400).json({ error: 'Action not found' });
    }

    // Add the response message as a reply
    const responseReply: IReply = {
      name: req.user?.displayName || 'System',
      avatar: req.user?.avatar,
      content: action.message,
      type: 'public',
      created: new Date(),
      staff: true,
    };

    ticket.replies.push(responseReply);

    // Handle punishment issuance for report tickets only (player_report or chat_report)
    const isReportTicket = ['player_report', 'chat_report'].includes(ticket.category.toLowerCase()) || 
                          ticket.category.toLowerCase().includes('report');
    
    if (action.issuePunishment && isReportTicket) {
      if (req.body.punishmentTypeId && ticket.data.get('reported_player')) {
        try {
          const PunishmentService = (await import('../services/punishment-service')).PunishmentService;
          const punishmentService = new PunishmentService(req.serverDbConnection!);
          
          const reportedPlayer = ticket.data.get('reported_player');
          const severity = req.body.punishmentSeverity || 'regular';
          const reason = `Report accepted: ${ticket._id}`;
          
          await punishmentService.applyPunishment(
            reportedPlayer,
            req.body.punishmentTypeId,
            severity,
            reason,
            ticket._id,
            req.user?.displayName || 'System'
          );

          // Add a note about the punishment
          const punishmentNote: INote = {
            text: `Punishment applied to ${reportedPlayer} (${severity} severity)`,
            issuerName: req.user?.displayName || 'System',
            issuerAvatar: req.user?.avatar,
            date: new Date(),
          };
          ticket.notes.push(punishmentNote);
          
        } catch (punishmentError) {
          console.error('Failed to apply punishment:', punishmentError);
          // Don't fail the entire request if punishment fails
        }
      }
    }

    // Handle appeal actions
    if (action.appealAction && ticket.category.toLowerCase().includes('appeal')) {
      const appealAction = req.body.appealAction || action.appealAction;
      
      if (appealAction === 'pardon') {
        // Execute pardon action on the actual punishment
        const punishmentId = ticket.data?.get('punishmentId');
        const playerUuid = ticket.data?.get('playerUuid');
        
        if (punishmentId && playerUuid) {
          try {
            const Player = req.serverDbConnection!.model('Player');
            const player = await Player.findOne({ minecraftUuid: playerUuid, 'punishments.id': punishmentId });
            
            if (player) {
              const punishment = player.punishments.find((p: any) => p.id === punishmentId);
              if (punishment) {
                // Add pardon modification
                punishment.modifications = punishment.modifications || [];
                punishment.modifications.push({
                  type: 'APPEAL_ACCEPT',
                  issuerName: req.user?.displayName || 'System',
                  issued: new Date(),
                });
                
                // Mark punishment as inactive
                punishment.data = punishment.data || new Map();
                punishment.data.set('active', false);
                punishment.data.set('appealOutcome', 'Approved');
                punishment.data.set('appealTicketId', ticket._id);
                
                await player.save();
                
                const pardonNote: INote = {
                  text: `Appeal approved - Full pardon granted. Punishment ${punishmentId} has been pardoned.`,
                  issuerName: req.user?.displayName || 'System',
                  issuerAvatar: req.user?.avatar,
                  date: new Date(),
                };
                ticket.notes.push(pardonNote);
              }
            }
          } catch (error) {
            console.error('Error executing pardon:', error);
            const errorNote: INote = {
              text: `Appeal approved but failed to execute pardon automatically. Please pardon punishment ${punishmentId} manually.`,
              issuerName: req.user?.displayName || 'System',
              issuerAvatar: req.user?.avatar,
              date: new Date(),
            };
            ticket.notes.push(errorNote);
          }
        }
        
        ticket.status = 'Closed';
      } else if (appealAction === 'reduce') {
        // Execute reduction action on the actual punishment
        const punishmentId = ticket.data?.get('punishmentId');
        const playerUuid = ticket.data?.get('playerUuid');
        
        if (punishmentId && playerUuid && req.body.customValues) {
          try {
            const Player = req.serverDbConnection!.model('Player');
            const player = await Player.findOne({ minecraftUuid: playerUuid, 'punishments.id': punishmentId });
            
            if (player) {
              const punishment = player.punishments.find((p: any) => p.id === punishmentId);
              if (punishment) {
                // Get reduction details from custom values
                const newDuration = req.body.customValues.duration;
                const isPermanent = req.body.customValues.isPermanent;
                
                // Add reduction modification
                punishment.modifications = punishment.modifications || [];
                punishment.modifications.push({
                  type: 'MANUAL_DURATION_CHANGE',
                  issuerName: req.user?.displayName || 'System',
                  issued: new Date(),
                  data: new Map([
                    ['effectiveDuration', isPermanent ? -1 : newDuration],
                    ['reason', 'Appeal partially approved - duration reduced']
                  ])
                });
                
                // Update punishment data
                punishment.data = punishment.data || new Map();
                punishment.data.set('appealOutcome', 'Reduced');
                punishment.data.set('appealTicketId', ticket._id);
                
                await player.save();
                
                const reductionText = isPermanent ? 'permanent' : `${newDuration} milliseconds`;
                const reductionNote: INote = {
                  text: `Appeal partially approved - Punishment ${punishmentId} duration reduced to ${reductionText}.`,
                  issuerName: req.user?.displayName || 'System',
                  issuerAvatar: req.user?.avatar,
                  date: new Date(),
                };
                ticket.notes.push(reductionNote);
              }
            }
          } catch (error) {
            console.error('Error executing reduction:', error);
            const errorNote: INote = {
              text: `Appeal approved but failed to execute reduction automatically. Please reduce punishment ${punishmentId} manually.`,
              issuerName: req.user?.displayName || 'System',
              issuerAvatar: req.user?.avatar,
              date: new Date(),
            };
            ticket.notes.push(errorNote);
          }
        }
        
        // Don't automatically close for reduction - staff may want to add more details
      } else if (appealAction === 'reject') {
        const rejectionNote: INote = {
          text: `Appeal rejected - Original punishment upheld`,
          issuerName: req.user?.displayName || 'System',
          issuerAvatar: req.user?.avatar,
          date: new Date(),
        };
        ticket.notes.push(rejectionNote);
        ticket.status = 'Closed';
      }
    }

    // Update ticket status based on action's closeTicket property
    if (action.closeTicket) {
      ticket.status = 'Closed';
    }

    await ticket.save();

    res.json({ 
      success: true, 
      message: 'Quick response applied successfully',
      ticket: ticket,
      actionApplied: action.name
    });
    
  } catch (error: any) {
    console.error('Quick response error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export default router;
