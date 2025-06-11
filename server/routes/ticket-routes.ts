// filepath: d:\bongbong\modl-panel\server\routes\ticket-routes.ts
import express, { Request, Response, NextFunction } from 'express';
import { Document as MongooseDocument, Connection } from 'mongoose';
import { createSystemLog } from './log-routes'; // Import from .ts file

// Interfaces based on Mongoose schema and usage
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

// Middleware to check for serverDbConnection
router.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.serverDbConnection) {
    console.error('Database connection not found for this server.');
    return res.status(503).json({ error: 'Service unavailable. Database connection not established for this server.' });
  }
  if (!req.serverName) {
    console.error('Server name not found in request.');
    return res.status(500).json({ error: 'Internal server error. Server name missing.' });
  }
  next();
});

// Get all tickets
router.get('/api/tickets', async (req: Request, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const tickets = await Ticket.find({});
    res.json(tickets);
  } catch (error) {
    console.error(`[Server: ${req.serverName}] Error fetching tickets:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get ticket by ID
router.get('/api/tickets/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(ticket);
  } catch (error) {
    console.error(`[Server: ${req.serverName}] Error fetching ticket:`, error);
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

router.post('/api/tickets', async (req: Request<{}, {}, CreateTicketBody>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const { category, creator, tags, data, creatorName, creatorAvatar } = req.body;
    
    const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
    const ticketId = `${category.toUpperCase()}-${randomDigits}`;
    
    const ticket = new Ticket({
      _id: ticketId,
      category,
      tags: tags || [],
      created: new Date(),
      creator,
      creatorName,
      creatorAvatar,
      notes: [],
      replies: [],
      data: data ? new Map(Object.entries(data)) : new Map(),
      status: 'Open'
    });
    
    await ticket.save();
    await createSystemLog(req.serverDbConnection, req.serverName, `Ticket ${ticketId} created by ${creatorName || creator}`, 'info', 'ticket-creation');
    res.status(201).json(ticket);
  } catch (error: any) {
    console.error(`[Server: ${req.serverName}] Error creating ticket:`, error);
    await createSystemLog(req.serverDbConnection, req.serverName, `Failed to create ticket for ${req.body.creatorName || req.body.creator}: ${error.message}`, 'error', 'ticket-creation');
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface AddNoteBody {
  text: string;
  issuerName: string;
  issuerAvatar?: string;
}

router.post('/api/tickets/:id/notes', async (req: Request<{ id: string }, {}, AddNoteBody>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const { text, issuerName, issuerAvatar } = req.body;
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    ticket.notes.push({
      text,
      issuerName,
      issuerAvatar,
      date: new Date()
    });
    
    await ticket.save();
    await createSystemLog(req.serverDbConnection, req.serverName, `Note added to ticket ${req.params.id} by ${issuerName}`, 'info', 'ticket-update');
    res.json(ticket);
  } catch (error: any) {
    console.error(`[Server: ${req.serverName}] Error adding note:`, error);
    await createSystemLog(req.serverDbConnection, req.serverName, `Failed to add note to ticket ${req.params.id}: ${error.message}`, 'error', 'ticket-update');
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface AddReplyBody {
  name: string;
  content: string;
  type: string;
  staff?: boolean;
  avatar?: string;
}

router.post('/api/tickets/:id/replies', async (req: Request<{ id: string }, {}, AddReplyBody>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const { name, content, type, staff, avatar } = req.body;
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    ticket.replies.push({
      name,
      avatar,
      content,
      type,
      created: new Date(),
      staff: staff || false
    });
    
    await ticket.save();
    await createSystemLog(req.serverDbConnection, req.serverName, `Reply added to ticket ${req.params.id} by ${name}`, 'info', 'ticket-update');
    res.json(ticket);
  } catch (error: any) {
    console.error(`[Server: ${req.serverName}] Error adding reply:`, error);
    await createSystemLog(req.serverDbConnection, req.serverName, `Failed to add reply to ticket ${req.params.id}: ${error.message}`, 'error', 'ticket-update');
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface AddTagBody {
  tag: string;
  staffName?: string;
}

router.post('/api/tickets/:id/tags', async (req: Request<{ id: string }, {}, AddTagBody>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const { tag, staffName } = req.body;
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    if (!ticket.tags.includes(tag)) {
      ticket.tags.push(tag);
      await ticket.save();
      await createSystemLog(req.serverDbConnection, req.serverName, `Tag '${tag}' added to ticket ${req.params.id} by ${staffName || 'system'}`, 'info', 'ticket-update');
    }
    res.json(ticket);
  } catch (error: any) {
    console.error(`[Server: ${req.serverName}] Error adding tag:`, error);
    await createSystemLog(req.serverDbConnection, req.serverName, `Failed to add tag '${req.body.tag}' to ticket ${req.params.id}: ${error.message}`, 'error', 'ticket-update');
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface RemoveTagBody {
    staffName?: string;
}

router.delete('/api/tickets/:id/tags/:tag', async (req: Request<{ id: string, tag: string }, {}, RemoveTagBody>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const staffName = req.body.staffName;

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    ticket.tags = ticket.tags.filter(t => t !== req.params.tag);
    await ticket.save();
    await createSystemLog(req.serverDbConnection, req.serverName, `Tag '${req.params.tag}' removed from ticket ${req.params.id} by ${staffName || 'system'}`, 'info', 'ticket-update');
    
    res.json(ticket);
  } catch (error: any) {
    console.error(`[Server: ${req.serverName}] Error removing tag:`, error);
    await createSystemLog(req.serverDbConnection, req.serverName, `Failed to remove tag '${req.params.tag}' from ticket ${req.params.id}: ${error.message}`, 'error', 'ticket-update');
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface UpdateTicketDataBody {
  data: Record<string, any>; // This will contain fields like status, assignedTo, priority, or custom data fields
  staffName?: string;
}

router.patch('/api/tickets/:id/data', async (req: Request<{ id: string }, {}, UpdateTicketDataBody>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const { data, staffName } = req.body;
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    let logMessage = `Ticket ${req.params.id} data updated by ${staffName || 'system'}. Changes: `;
    const changes: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (key === 'status' || key === 'assignedTo' || key === 'priority') {
        if (ticket[key as keyof ITicket] !== value) {
          changes.push(`${key}: '${ticket[key as keyof ITicket]}' -> '${value}'`);
          (ticket as any)[key] = value; // Use any for direct assignment to potentially non-Map fields
        }
      } else { 
        if (ticket.data.get(key) !== value) {
          changes.push(`data.${key}: '${ticket.data.get(key)}' -> '${value}'`);
          ticket.data.set(key, value);
        }
      }
    }
    
    if (changes.length > 0) {
        await ticket.save();
        logMessage += changes.join(', ');
        await createSystemLog(req.serverDbConnection, req.serverName, logMessage, 'info', 'ticket-update');
    } else {
        // No actual changes, perhaps log this if desired or just return the ticket
    }
    res.json(ticket);
  } catch (error: any) {
    console.error(`[Server: ${req.serverName}] Error updating ticket data:`, error);
    await createSystemLog(req.serverDbConnection, req.serverName, `Failed to update data for ticket ${req.params.id}: ${error.message}`, 'error', 'ticket-update');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tickets by tag
router.get('/api/tickets/tag/:tag', async (req: Request<{ tag: string }>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const tickets = await Ticket.find({ tags: req.params.tag });
    res.json(tickets);
  } catch (error) {
    console.error(`[Server: ${req.serverName}] Error fetching tickets by tag:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tickets by creator
router.get('/api/tickets/creator/:uuid', async (req: Request<{ uuid: string }>, res: Response) => {
  try {
    const Ticket = req.serverDbConnection!.model<ITicket>('Ticket');
    const tickets = await Ticket.find({ creator: req.params.uuid });
    res.json(tickets);
  } catch (error) {
    console.error(`[Server: ${req.serverName}] Error fetching tickets by creator:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
