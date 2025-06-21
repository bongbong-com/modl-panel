import express, { Request, Response, NextFunction } from 'express';
import { Document as MongooseDocument, Connection } from 'mongoose';
import { isAuthenticated } from '../middleware/auth-middleware';

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
    if (tickets.length > 0) {
      console.log(`[Debug] Sample ticket fields:`, Object.keys(tickets[0]));
      console.log(`[Debug] Sample ticket:`, tickets[0]);
    }
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
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

    res.status(200).json(ticket.tags);
  } catch (error: any) {
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
