import { Express, Request, Response } from 'express';
import { Player, Staff, Ticket, Log, Settings } from '../models/mongodb-schemas';
import { createSystemLog } from '../routes/log-routes';

// Player routes
export function setupPlayerRoutes(app: Express) {
  // Search player by username
  app.get('/api/player/:username', async (req: Request, res: Response) => {
    try {
      const username = req.params.username;
      
      // Create a case-insensitive regex for partial matching
      const regex = new RegExp(username, 'i');
      
      // Search for players with a matching username in their history
      const player = await Player.findOne({
        'usernames.username': { $regex: regex }
      });
      
      if (!player) {
        return res.status(404).json({ message: 'Player not found' });
      }
      
      // Get the latest username
      const latestUsername = player.usernames && player.usernames.length > 0
        ? player.usernames[player.usernames.length - 1].username
        : 'Unknown';
      
      // Return minimal player info with UUID for lookup
      res.json({
        uuid: player.minecraftUuid,
        username: latestUsername
      });
    } catch (error) {
      console.error('Error searching for player:', error);
      res.status(500).json({ error: 'Failed to search for player' });
    }
  });

  // Get all players
  app.get('/api/players', async (req: Request, res: Response) => {
    try {
      const players = await Player.find({}, { 
        minecraftUuid: 1, 
        'usernames': { $slice: -1 }, // Get only the most recent username
        'punishments.active': 1 
      });
      
      // Transform for client consumption
      const transformedPlayers = players.map(player => {
        const latestUsername = player.usernames && player.usernames.length > 0 
          ? player.usernames[player.usernames.length - 1].username 
          : 'Unknown';
        
        const status = player.punishments && player.punishments.some(p => p.active) 
          ? 'Banned' 
          : 'Active';
        
        return {
          uuid: player.minecraftUuid,
          username: latestUsername,
          status
        };
      });
      
      res.json(transformedPlayers);
    } catch (error) {
      console.error('Error fetching players:', error);
      res.status(500).json({ error: 'Failed to fetch players' });
    }
  });

  // Get player by UUID
  app.get('/api/players/:uuid', async (req: Request, res: Response) => {
    try {
      const uuid = req.params.uuid;
      const player = await Player.findOne({ minecraftUuid: uuid });
      
      if (!player) {
        return res.status(404).json({ error: 'Player not found' });
      }
      
      res.json(player);
    } catch (error) {
      console.error('Error fetching player:', error);
      res.status(500).json({ error: 'Failed to fetch player' });
    }
  });

  // Create a new player
  app.post('/api/players', async (req: Request, res: Response) => {
    try {
      const newPlayer = new Player(req.body);
      await newPlayer.save();
      
      await createSystemLog(`Player ${req.body.usernames[0].username} created`);
      res.status(201).json(newPlayer);
    } catch (error) {
      console.error('Error creating player:', error);
      res.status(500).json({ error: 'Failed to create player' });
    }
  });

  // Update player
  app.patch('/api/players/:uuid', async (req: Request, res: Response) => {
    try {
      const uuid = req.params.uuid;
      const player = await Player.findOneAndUpdate(
        { minecraftUuid: uuid },
        { $set: req.body },
        { new: true }
      );
      
      if (!player) {
        return res.status(404).json({ error: 'Player not found' });
      }
      
      await createSystemLog(`Player ${uuid} updated`);
      res.json(player);
    } catch (error) {
      console.error('Error updating player:', error);
      res.status(500).json({ error: 'Failed to update player' });
    }
  });
  
  // Add punishment to player
  app.post('/api/players/:uuid/punishments', async (req: Request, res: Response) => {
    try {
      const uuid = req.params.uuid;
      const punishment = req.body;
      
      const player = await Player.findOneAndUpdate(
        { minecraftUuid: uuid },
        { $push: { punishments: punishment } },
        { new: true }
      );
      
      if (!player) {
        return res.status(404).json({ error: 'Player not found' });
      }
      
      await createSystemLog(`Punishment added to player ${uuid}`);
      res.json(player);
    } catch (error) {
      console.error('Error adding punishment:', error);
      res.status(500).json({ error: 'Failed to add punishment' });
    }
  });

  // Add note to player
  app.post('/api/players/:uuid/notes', async (req: Request, res: Response) => {
    try {
      const uuid = req.params.uuid;
      const note = req.body;
      
      console.log('Adding note to player:', uuid, 'Note data:', note);
      
      // Try to find the player by either UUID or minecraftUuid
      let player = await Player.findOne({
        $or: [
          { _id: uuid },
          { uuid: uuid },
          { minecraftUuid: uuid }
        ]
      });
      
      if (!player) {
        console.log('Player not found with UUID:', uuid);
        return res.status(404).json({ error: 'Player not found' });
      }
      
      console.log('Found player:', player.usernames && player.usernames.length ? player.usernames[player.usernames.length - 1].username : 'Unknown');
      
      // Add the note
      player = await Player.findByIdAndUpdate(
        player._id,
        { $push: { notes: note } },
        { new: true }
      );
      
      console.log('Note added successfully');
      await createSystemLog(`Note added to player ${uuid}`);
      res.json(player);
    } catch (error) {
      console.error('Error adding note:', error);
      res.status(500).json({ error: 'Failed to add note' });
    }
  });
}

// Helper function to generate ticket ID
async function generateTicketId(type: string): Promise<string> {
  // Convert ticket type to prefix
  const prefix = type === 'bug' ? 'BUG' : 
                type === 'player' ? 'PLAYER' :
                type === 'chat' ? 'CHAT' :
                type === 'appeal' ? 'APPEAL' :
                type === 'staff' ? 'STAFF' : 'SUPPORT';
  
  // Generate a random 6-digit number
  const randomId = Math.floor(100000 + Math.random() * 900000);
  
  // Combine to create ticket ID
  const ticketId = `${prefix}-${randomId}`;
  
  // Check if this ID already exists, if so, try again
  const existingTicket = await Ticket.findById(ticketId);
  if (existingTicket) {
    return generateTicketId(type);
  }
  
  return ticketId;
}

// Helper function to get player by UUID
async function getPlayerByUuid(uuid: string) {
  try {
    const player = await Player.findOne({ minecraftUuid: uuid });
    if (!player) return null;
    
    // Get the latest username
    const latestUsername = player.usernames && player.usernames.length > 0
      ? player.usernames[player.usernames.length - 1].username
      : 'Unknown';
    
    return { player, latestUsername };
  } catch (error) {
    console.error('Error finding player:', error);
    return null;
  }
}

// Ticket routes
export function setupTicketRoutes(app: Express) {
  // Get all tickets (exclude Unfinished tickets)
  app.get('/api/tickets', async (req: Request, res: Response) => {
    try {
      // Only get tickets that don't have Unfinished status
      const tickets = await Ticket.find({ status: { $ne: 'Unfinished' } });
      
      // Transform for client consumption
      const transformedTickets = tickets.map(ticket => {
        return {
          id: ticket._id,
          subject: ticket.subject || 'No Subject',
          status: ticket.status,
          reportedBy: ticket.creator,
          date: ticket.created,
          category: getCategoryFromType(ticket.type),
          locked: ticket.locked || false,
          type: ticket.type
        };
      });
      
      res.json(transformedTickets);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      res.status(500).json({ error: 'Failed to fetch tickets' });
    }
  });
  
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

  // Get ticket by ID
  app.get('/api/tickets/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const ticket = await Ticket.findById(id);
      
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      
      // Transform for client consumption
      const transformedTicket = {
        id: ticket._id,
        subject: ticket.subject || 'No Subject',
        status: ticket.status,
        type: ticket.type,
        category: getCategoryFromType(ticket.type),
        reportedBy: ticket.creator,
        date: ticket.created,
        locked: ticket.locked || false,
        formData: ticket.formData ? Object.fromEntries(ticket.formData) : {},
        reportedPlayer: ticket.reportedPlayer,
        reportedPlayerUuid: ticket.reportedPlayerUuid,
        messages: ticket.replies.map(reply => ({
          id: reply._id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          sender: reply.name,
          senderType: reply.type,
          content: reply.content,
          timestamp: reply.created,
          staff: reply.staff,
          closedAs: reply.action
        })),
        notes: ticket.notes,
        tags: ticket.tags
      };
      
      res.json(transformedTicket);
    } catch (error) {
      console.error('Error fetching ticket:', error);
      res.status(500).json({ error: 'Failed to fetch ticket' });
    }
  });

  // Create a bug report
  app.post('/api/tickets/bug', async (req: Request, res: Response) => {
    try {
      const { creatorUuid } = req.body;
      if (!creatorUuid) {
        return res.status(400).json({ error: 'Creator UUID is required' });
      }
      
      // Get creator info
      const creatorInfo = await getPlayerByUuid(creatorUuid);
      if (!creatorInfo) {
        return res.status(404).json({ error: 'Creator not found' });
      }
      
      // Create ticket ID
      const ticketId = await generateTicketId('bug');
      
      // Create the ticket
      const newTicket = new Ticket({
        _id: ticketId,
        type: 'bug',
        status: 'Unfinished',
        tags: ['bug'],
        creator: creatorInfo.latestUsername,
        creatorUuid: creatorUuid
      });
      
      await newTicket.save();
      
      await createSystemLog(`Bug report ticket ${ticketId} initialized by ${creatorInfo.latestUsername}`);
      res.status(201).json({ ticketId });
    } catch (error) {
      console.error('Error creating bug report ticket:', error);
      res.status(500).json({ error: 'Failed to create bug report ticket' });
    }
  });

  // Create a player report
  app.post('/api/tickets/player', async (req: Request, res: Response) => {
    try {
      const { creatorUuid, reportedPlayerUuid } = req.body;
      
      if (!creatorUuid) {
        return res.status(400).json({ error: 'Creator UUID is required' });
      }
      
      if (!reportedPlayerUuid) {
        return res.status(400).json({ error: 'Reported player UUID is required' });
      }
      
      // Get creator info
      const creatorInfo = await getPlayerByUuid(creatorUuid);
      if (!creatorInfo) {
        return res.status(404).json({ error: 'Creator not found' });
      }
      
      // Get reported player info
      const reportedPlayerInfo = await getPlayerByUuid(reportedPlayerUuid);
      if (!reportedPlayerInfo) {
        return res.status(404).json({ error: 'Reported player not found' });
      }
      
      // Create ticket ID
      const ticketId = await generateTicketId('player');
      
      // Create the ticket
      const newTicket = new Ticket({
        _id: ticketId,
        type: 'player',
        status: 'Unfinished',
        tags: ['player'],
        creator: creatorInfo.latestUsername,
        creatorUuid: creatorUuid,
        reportedPlayer: reportedPlayerInfo.latestUsername,
        reportedPlayerUuid: reportedPlayerUuid
      });
      
      await newTicket.save();
      
      await createSystemLog(`Player report ticket ${ticketId} initialized by ${creatorInfo.latestUsername}`);
      res.status(201).json({ ticketId });
    } catch (error) {
      console.error('Error creating player report ticket:', error);
      res.status(500).json({ error: 'Failed to create player report ticket' });
    }
  });

  // Create a chat report
  app.post('/api/tickets/chat', async (req: Request, res: Response) => {
    try {
      const { creatorUuid, reportedPlayerUuid, chatMessages } = req.body;
      
      if (!creatorUuid) {
        return res.status(400).json({ error: 'Creator UUID is required' });
      }
      
      if (!reportedPlayerUuid) {
        return res.status(400).json({ error: 'Reported player UUID is required' });
      }
      
      if (!chatMessages || !Array.isArray(chatMessages) || chatMessages.length === 0) {
        return res.status(400).json({ error: 'Chat messages are required' });
      }
      
      // Get creator info
      const creatorInfo = await getPlayerByUuid(creatorUuid);
      if (!creatorInfo) {
        return res.status(404).json({ error: 'Creator not found' });
      }
      
      // Get reported player info
      const reportedPlayerInfo = await getPlayerByUuid(reportedPlayerUuid);
      if (!reportedPlayerInfo) {
        return res.status(404).json({ error: 'Reported player not found' });
      }
      
      // Create ticket ID
      const ticketId = await generateTicketId('chat');
      
      // Create the ticket
      const newTicket = new Ticket({
        _id: ticketId,
        type: 'chat',
        status: 'Unfinished',
        tags: ['chat'],
        creator: creatorInfo.latestUsername,
        creatorUuid: creatorUuid,
        reportedPlayer: reportedPlayerInfo.latestUsername,
        reportedPlayerUuid: reportedPlayerUuid,
        chatMessages: chatMessages
      });
      
      await newTicket.save();
      
      await createSystemLog(`Chat report ticket ${ticketId} initialized by ${creatorInfo.latestUsername}`);
      res.status(201).json({ ticketId });
    } catch (error) {
      console.error('Error creating chat report ticket:', error);
      res.status(500).json({ error: 'Failed to create chat report ticket' });
    }
  });

  // Create a staff application
  app.post('/api/tickets/staff', async (req: Request, res: Response) => {
    try {
      const { creatorUuid } = req.body;
      if (!creatorUuid) {
        return res.status(400).json({ error: 'Creator UUID is required' });
      }
      
      // Get creator info
      const creatorInfo = await getPlayerByUuid(creatorUuid);
      if (!creatorInfo) {
        return res.status(404).json({ error: 'Creator not found' });
      }
      
      // Create ticket ID
      const ticketId = await generateTicketId('staff');
      
      // Create the ticket
      const newTicket = new Ticket({
        _id: ticketId,
        type: 'staff',
        status: 'Unfinished',
        tags: ['staff'],
        creator: creatorInfo.latestUsername,
        creatorUuid: creatorUuid
      });
      
      await newTicket.save();
      
      await createSystemLog(`Staff application ticket ${ticketId} initialized by ${creatorInfo.latestUsername}`);
      res.status(201).json({ ticketId });
    } catch (error) {
      console.error('Error creating staff application ticket:', error);
      res.status(500).json({ error: 'Failed to create staff application ticket' });
    }
  });

  // Create a general support ticket
  app.post('/api/tickets/support', async (req: Request, res: Response) => {
    try {
      const { creatorUuid } = req.body;
      if (!creatorUuid) {
        return res.status(400).json({ error: 'Creator UUID is required' });
      }
      
      // Get creator info
      const creatorInfo = await getPlayerByUuid(creatorUuid);
      if (!creatorInfo) {
        return res.status(404).json({ error: 'Creator not found' });
      }
      
      // Create ticket ID
      const ticketId = await generateTicketId('support');
      
      // Create the ticket
      const newTicket = new Ticket({
        _id: ticketId,
        type: 'support',
        status: 'Unfinished',
        tags: ['support'],
        creator: creatorInfo.latestUsername,
        creatorUuid: creatorUuid
      });
      
      await newTicket.save();
      
      await createSystemLog(`Support ticket ${ticketId} initialized by ${creatorInfo.latestUsername}`);
      res.status(201).json({ ticketId });
    } catch (error) {
      console.error('Error creating support ticket:', error);
      res.status(500).json({ error: 'Failed to create support ticket' });
    }
  });
  
  // Submit form data for an unfinished ticket and make it active
  app.post('/api/tickets/:id/submit', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { subject, formData } = req.body;
      
      if (!subject || !formData) {
        return res.status(400).json({ error: 'Subject and form data are required' });
      }
      
      // Find the ticket
      const ticket = await Ticket.findById(id);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      
      // Verify it's unfinished
      if (ticket.status !== 'Unfinished') {
        return res.status(400).json({ error: 'Only unfinished tickets can be submitted' });
      }
      
      // Create a content string from form data
      let contentString = '';
      Object.entries(formData).forEach(([key, value]) => {
        contentString += `${key}: ${value}\n\n`;
      });
      
      // Create initial message
      const initialMessage = {
        name: ticket.creator,
        content: contentString,
        type: 'player',
        created: new Date(),
        staff: false
      };
      
      // Update the ticket
      const updatedTicket = await Ticket.findByIdAndUpdate(
        id,
        {
          $set: {
            status: 'Open',
            subject: subject,
            formData: formData
          },
          $push: { replies: initialMessage }
        },
        { new: true }
      );
      
      await createSystemLog(`Ticket ${id} submitted by ${ticket.creator}`);
      res.json({ 
        success: true, 
        ticketId: id,
        ticket: updatedTicket
      });
    } catch (error) {
      console.error('Error submitting ticket form:', error);
      res.status(500).json({ error: 'Failed to submit ticket form' });
    }
  });

  // Update ticket
  app.patch('/api/tickets/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      
      // Handle special cases like adding replies or notes
      if (req.body.newReply) {
        const reply = req.body.newReply;
        
        // Ensure staff replies are marked correctly
        if (reply.type === 'staff') {
          reply.staff = true;
        }
        
        // Add the reply to the ticket
        await Ticket.findByIdAndUpdate(
          id,
          { $push: { replies: reply } }
        );
        
        // If the reply has an action that should close/reopen the ticket, update status
        if (reply.action) {
          const closingActions = ['Accepted', 'Completed', 'Pardon', 'Reduce', 'Rejected', 'Stale', 
                                 'Duplicate', 'Reject', 'Close'];
          const reopenAction = 'Reopen';
          
          // Update ticket status based on the action in the latest reply
          if (closingActions.includes(reply.action)) {
            // Closing actions
            req.body.status = reply.action === 'Accepted' || 
                             reply.action === 'Completed' || 
                             reply.action === 'Pardon' || 
                             reply.action === 'Reduce' 
                             ? 'Resolved' : 'Closed';
            
            // Also lock the ticket
            req.body.locked = true;
            
            // Directly update locked state in case the rest of the code misses it
            await Ticket.findByIdAndUpdate(
              id,
              { $set: { locked: true } }
            );
          } else if (reply.action === reopenAction) {
            // Reopening action
            req.body.status = 'Open';
            req.body.locked = false;
            
            // Directly update locked state in case the rest of the code misses it
            await Ticket.findByIdAndUpdate(
              id,
              { $set: { locked: false } }
            );
          }
          // Comment action doesn't change status or locked state
        }
      } 
      
      if (req.body.newNote) {
        const note = {
          content: req.body.newNote.content,
          author: req.body.newNote.author,
          date: new Date()
        };
        await Ticket.findByIdAndUpdate(
          id,
          { $push: { notes: note } }
        );
      }
      
      // Update data map for data fields
      const dataUpdates = {};
      if (req.body.status) dataUpdates['data.status'] = req.body.status;
      if (req.body.priority) dataUpdates['data.priority'] = req.body.priority;
      if (req.body.assignedTo) dataUpdates['data.assignedTo'] = req.body.assignedTo;
      
      // Direct field updates for built-in schema fields
      const directUpdates = {};
      // Update main status if needed
      if (req.body.status) directUpdates['status'] = req.body.status;
      // Handle locked status - update it on the main document
      if (req.body.locked !== undefined) directUpdates['locked'] = req.body.locked;
      
      // Handle tags
      if (req.body.tags) {
        await Ticket.findByIdAndUpdate(
          id,
          { $set: { tags: req.body.tags } }
        );
      }
      
      // Merge direct and data updates
      const updateOperations = { $set: {} };
      
      // Add data field updates
      if (Object.keys(dataUpdates).length > 0) {
        Object.assign(updateOperations.$set, dataUpdates);
      }
      
      // Add direct field updates
      if (Object.keys(directUpdates).length > 0) {
        Object.assign(updateOperations.$set, directUpdates);
      }
      
      // Apply all updates and get updated ticket
      const ticket = await Ticket.findByIdAndUpdate(
        id,
        updateOperations,
        { new: true }
      );
      
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      
      // Log status for debugging
      console.log(`Updated ticket ${id} - Locked status: ${ticket.locked}`);
      
      await createSystemLog(`Ticket ${id} updated`);
      res.json(ticket);
    } catch (error) {
      console.error('Error updating ticket:', error);
      res.status(500).json({ error: 'Failed to update ticket' });
    }
  });
}

// Appeal routes (appeals are a special type of ticket)
export function setupAppealRoutes(app: Express) {
  // Get all appeals
  app.get('/api/appeals', async (req: Request, res: Response) => {
    try {
      const appeals = await Ticket.find({ tags: 'appeal' });
      
      // Transform for client consumption
      const transformedAppeals = appeals.map(appeal => {
        const status = appeal.data.get('status') as string || 'Pending Review';
        const punishmentId = appeal.data.get('punishmentId') as string;
        
        return {
          id: appeal._id,
          banId: punishmentId,
          submittedOn: appeal.created,
          status,
          lastUpdate: appeal.replies.length > 0 
            ? appeal.replies[appeal.replies.length - 1].created 
            : appeal.created,
          messages: appeal.replies
        };
      });
      
      res.json(transformedAppeals);
    } catch (error) {
      console.error('Error fetching appeals:', error);
      res.status(500).json({ error: 'Failed to fetch appeals' });
    }
  });

  // Get appeal by ID
  app.get('/api/appeals/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const appeal = await Ticket.findById(id);
      
      if (!appeal) {
        return res.status(404).json({ error: 'Appeal not found' });
      }
      
      // Check if this is actually an appeal
      if (!appeal.tags.includes('appeal')) {
        return res.status(400).json({ error: 'Ticket is not an appeal' });
      }
      
      // Transform for client consumption
      const transformedAppeal = {
        id: appeal._id,
        banId: appeal.data.get('punishmentId') as string,
        submittedOn: appeal.created,
        status: appeal.data.get('status') as string || 'Pending Review',
        lastUpdate: appeal.replies.length > 0 
          ? appeal.replies[appeal.replies.length - 1].created 
          : appeal.created,
        messages: appeal.replies.filter(reply => !reply.staff)
      };
      
      res.json(transformedAppeal);
    } catch (error) {
      console.error('Error fetching appeal:', error);
      res.status(500).json({ error: 'Failed to fetch appeal' });
    }
  });

  // Get appeals for punishment
  app.get('/api/appeals/punishment/:id', async (req: Request, res: Response) => {
    try {
      const punishmentId = req.params.id;
      const appeals = await Ticket.find({ 
        tags: 'appeal',
        'data.punishmentId': punishmentId
      });
      
      // Transform for client consumption
      const transformedAppeals = appeals.map(appeal => {
        return {
          id: appeal._id,
          banId: punishmentId,
          submittedOn: appeal.created,
          status: appeal.data.get('status') as string || 'Pending Review',
          lastUpdate: appeal.replies.length > 0 
            ? appeal.replies[appeal.replies.length - 1].created 
            : appeal.created
        };
      });
      
      res.json(transformedAppeals);
    } catch (error) {
      console.error('Error fetching appeals for punishment:', error);
      res.status(500).json({ error: 'Failed to fetch appeals' });
    }
  });

  // Create a new appeal
  app.post('/api/appeals', async (req: Request, res: Response) => {
    try {
      // Format appeal data as a ticket
      const appealData = {
        _id: `APPEAL-${Math.floor(100000 + Math.random() * 900000)}`,
        tags: ['appeal', ...req.body.tags || []],
        created: new Date(),
        creator: req.body.username,
        replies: [
          {
            name: req.body.username,
            content: req.body.content,
            type: 'player',
            created: new Date(),
            staff: false
          },
          {
            name: 'System',
            content: 'Your appeal has been received and will be reviewed by our moderation team.',
            type: 'system',
            created: new Date(),
            staff: false
          }
        ],
        notes: [],
        data: new Map([
          ['status', 'Pending Review'],
          ['punishmentId', req.body.punishmentId],
          ['playerUuid', req.body.playerUuid],
          ['email', req.body.email]
        ])
      };
      
      const newAppeal = new Ticket(appealData);
      await newAppeal.save();
      
      // Update the punishment to link to this appeal
      await Player.updateOne(
        { 
          minecraftUuid: req.body.playerUuid,
          'punishments.id': req.body.punishmentId
        },
        { 
          $push: { 
            'punishments.$.attachedTicketIds': newAppeal._id 
          } 
        }
      );
      
      await createSystemLog(`Appeal ${newAppeal._id} submitted for punishment ${req.body.punishmentId}`);
      res.status(201).json(newAppeal);
    } catch (error) {
      console.error('Error creating appeal:', error);
      res.status(500).json({ error: 'Failed to create appeal' });
    }
  });

  // Add reply to appeal
  app.post('/api/appeals/:id/reply', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const reply = {
        name: req.body.name,
        content: req.body.content,
        type: req.body.type || 'player',
        created: new Date(),
        staff: req.body.staff || false
      };
      
      const appeal = await Ticket.findByIdAndUpdate(
        id,
        { $push: { replies: reply } },
        { new: true }
      );
      
      if (!appeal) {
        return res.status(404).json({ error: 'Appeal not found' });
      }
      
      await createSystemLog(`Reply added to appeal ${id}`);
      res.json(appeal);
    } catch (error) {
      console.error('Error adding reply to appeal:', error);
      res.status(500).json({ error: 'Failed to add reply' });
    }
  });

  // Update appeal status
  app.patch('/api/appeals/:id/status', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const status = req.body.status;
      
      // Update the ticket data map
      const appeal = await Ticket.findById(id);
      if (!appeal) {
        return res.status(404).json({ error: 'Appeal not found' });
      }
      
      // Update status
      appeal.data.set('status', status);
      await appeal.save();
      
      // Add system message
      const systemMessage = {
        name: 'System',
        content: `Appeal status changed to ${status}`,
        type: 'system',
        created: new Date(),
        staff: false
      };
      
      appeal.replies.push(systemMessage);
      await appeal.save();
      
      await createSystemLog(`Appeal ${id} status changed to ${status}`);
      res.json(appeal);
    } catch (error) {
      console.error('Error updating appeal status:', error);
      res.status(500).json({ error: 'Failed to update appeal status' });
    }
  });
}

// Log routes
export function setupLogRoutes(app: Express) {
  // Get all logs
  app.get('/api/logs', async (req: Request, res: Response) => {
    try {
      const logs = await Log.find().sort({ created: -1 }).limit(100);
      res.json(logs);
    } catch (error) {
      console.error('Error fetching logs:', error);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  });

  // Create a log 
  app.post('/api/logs', async (req: Request, res: Response) => {
    try {
      const newLog = new Log(req.body);
      await newLog.save();
      res.status(201).json(newLog);
    } catch (error) {
      console.error('Error creating log:', error);
      res.status(500).json({ error: 'Failed to create log' });
    }
  });
}

// Settings routes
export function setupSettingsRoutes(app: Express) {
  // Get settings
  app.get('/api/settings', async (req: Request, res: Response) => {
    try {
      const settings = await Settings.findOne();
      res.json(settings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  // Update settings
  app.patch('/api/settings', async (req: Request, res: Response) => {
    try {
      const settings = await Settings.findOne();
      
      if (!settings) {
        // Create settings if they don't exist
        const newSettings = new Settings({ settings: new Map() });
        
        // Update with request data
        Object.entries(req.body).forEach(([key, value]) => {
          newSettings.settings.set(key, value);
        });
        
        await newSettings.save();
        return res.json(newSettings);
      }
      
      // Update existing settings
      Object.entries(req.body).forEach(([key, value]) => {
        settings.settings.set(key, value);
      });
      
      await settings.save();
      await createSystemLog('Settings updated');
      res.json(settings);
    } catch (error) {
      console.error('Error updating settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });
}

// Stats routes
export function setupStatsRoutes(app: Express) {
  app.get('/api/stats', async (req: Request, res: Response) => {
    try {
      // Get overall statistics
      const playerCount = await Player.countDocuments();
      const ticketCount = await Ticket.countDocuments();
      const openTicketCount = await Ticket.countDocuments({ 'data.status': 'Open' });
      const appealCount = await Ticket.countDocuments({ tags: 'appeal' });
      const staffCount = await Staff.countDocuments();
      
      // Get recent activity for display
      const recentTickets = await Ticket.find()
        .sort({ created: -1 })
        .limit(5);
      
      const recentAppeals = await Ticket.find({ tags: 'appeal' })
        .sort({ created: -1 })
        .limit(5);
      
      // Transform tickets for display
      const transformedTickets = recentTickets.map(ticket => {
        const subject = ticket.data.get('subject') as string || 'No Subject';
        return {
          id: ticket._id,
          type: ticket.tags.includes('appeal') ? 'appeal' : 'ticket',
          title: subject,
          date: ticket.created,
          status: ticket.data.get('status') as string || 'Open'
        };
      });
      
      res.json({
        counts: {
          players: playerCount,
          tickets: ticketCount,
          openTickets: openTicketCount,
          appeals: appealCount,
          staff: staffCount
        },
        recent: {
          tickets: transformedTickets,
          appeals: recentAppeals
        }
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });
}

// Staff routes
export function setupStaffRoutes(app: Express) {
  // Get all staff
  app.get('/api/staff', async (req: Request, res: Response) => {
    try {
      const staff = await Staff.find({}, { password: 0, twoFaSecret: 0 });
      res.json(staff);
    } catch (error) {
      console.error('Error fetching staff:', error);
      res.status(500).json({ error: 'Failed to fetch staff' });
    }
  });

  // Get staff by ID
  app.get('/api/staff/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const staff = await Staff.findById(id, { password: 0, twoFaSecret: 0 });
      
      if (!staff) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      
      res.json(staff);
    } catch (error) {
      console.error('Error fetching staff member:', error);
      res.status(500).json({ error: 'Failed to fetch staff member' });
    }
  });
}

// Setup all routes
export function setupApiRoutes(app: Express) {
  setupPlayerRoutes(app);
  setupTicketRoutes(app);
  setupAppealRoutes(app);
  setupLogRoutes(app);
  setupSettingsRoutes(app);
  setupStatsRoutes(app);
  setupStaffRoutes(app);
}