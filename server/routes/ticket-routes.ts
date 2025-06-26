import express, { Request, Response, NextFunction } from 'express';
import { Document as MongooseDocument, Connection } from 'mongoose';
import { isAuthenticated } from '../middleware/auth-middleware';
import AIModerationService from '../services/ai-moderation-service';

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
}

const router = express.Router();

router.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.serverDbConnection) {
    return res.status(503).json({ error: 'Service unavailable. Database connection not established for this server.' });
  }
  if (!req.serverName) {
    return res.status(500).json({ error: 'Internal server error. Server name missing.' });
  }
  next();
});

router.use(isAuthenticated);

router.get('/', async (req: Request, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model('Ticket');
    const tickets = await Ticket.find({}).lean();
    console.log(`[Debug] Found ${tickets.length} tickets in database`);
      // Transform tickets to match client expectations
    const transformedTickets = tickets.map(ticket => ({
      ...ticket,
      id: ticket._id,
      date: ticket.created || new Date().toISOString(),
      reportedBy: ticket.creator || ticket.creatorName || 'Unknown',
      messages: ticket.replies ? ticket.replies.map((reply: any) => ({
        id: reply._id || Math.random().toString(),
        sender: reply.name,
        senderType: reply.staff ? 'staff' : 'user',
        content: reply.content,
        timestamp: reply.created || new Date().toISOString(),
        staff: reply.staff || false
      })) : []
    }));
    
    if (transformedTickets.length > 0) {
      console.log(`[Debug] Sample transformed ticket:`, transformedTickets[0]);
    }
    res.json(transformedTickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    console.log('=== PANEL TICKET DETAIL REQUEST DEBUG ===');
    console.log('Request URL:', req.originalUrl);
    console.log('Request method:', req.method);
    console.log('Server name:', req.serverName);
    console.log('User session:', req.session);
    console.log('Request headers:', req.headers);
    console.log('Request params:', req.params);
    console.log('Database connection available:', !!req.serverDbConnection);
    
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    console.log(`[Debug] Looking for ticket with ID: ${req.params.id}`);
    const ticket = await Ticket.findById(req.params.id).lean();
    if (!ticket) {
      console.log(`[Debug] Ticket not found: ${req.params.id}`);
      console.log('==========================================');
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    console.log(`[Debug] Found ticket:`, ticket);
    
    // Transform ticket to match client expectations
    const transformedTicket = {
      ...ticket,
      id: ticket._id,
      date: ticket.created || new Date().toISOString(),
      reportedBy: ticket.creator || ticket.creatorName || 'Unknown',
      messages: ticket.replies ? ticket.replies.map((reply: any) => ({
        id: reply._id || Math.random().toString(),
        sender: reply.name,
        senderType: reply.staff ? 'staff' : 'user',
        content: reply.content,
        timestamp: reply.created || new Date().toISOString(),
        staff: reply.staff || false
      })) : []
    };
    
    console.log(`[Debug] Transformed ticket:`, transformedTicket);
    console.log('==========================================');
    res.json(transformedTicket);
  } catch (error: any) {
    console.error('Error fetching ticket:', error);
    console.log('==========================================');
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

router.post('/:id/replies', async (req: Request<{ id: string }, {}, AddReplyBody>, res: Response) => {
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
router.patch('/:id', async (req: Request<{ id: string }, {}, UpdateTicketBody>, res: Response) => {
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
      // Add locked field to ticket data Map
      ticket.data.set('locked', updates.locked);
    }

    // Add new reply if provided
    if (updates.newReply) {
      const newReply: IReply = {
        name: updates.newReply.name,
        content: updates.newReply.content,
        type: updates.newReply.type,
        created: new Date(updates.newReply.created),
        staff: updates.newReply.staff
      };
      ticket.replies.push(newReply);
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
      locked: ticket.data.get('locked') || false
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
    const tickets = await Ticket.find({ creator: req.params.uuid });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
