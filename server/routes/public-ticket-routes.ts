import express, { Request, Response } from 'express';
import { verifyTicketApiKey } from '../middleware/ticket-api-auth';

const router = express.Router();

// Apply API key verification to all routes in this router
router.use(verifyTicketApiKey);

// Interface for ticket creation request
interface CreateTicketRequest {
  creatorUuid?: string;
  creatorName?: string;
  type: 'bug' | 'player' | 'chat' | 'appeal' | 'staff' | 'support';
  subject: string;
  description?: string;
  reportedPlayerUuid?: string;
  reportedPlayerName?: string;
  chatMessages?: string[];
  formData?: Record<string, any>;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
}

// Helper function to generate ticket ID
async function generateTicketId(serverDbConnection: any, type: string): Promise<string> {
  const Ticket = serverDbConnection.model('Ticket');
  const prefix = type === 'bug' ? 'BUG' : 
                type === 'player' ? 'PLAYER' :
                type === 'chat' ? 'CHAT' :
                type === 'appeal' ? 'APPEAL' :
                type === 'staff' ? 'STAFF' : 'SUPPORT';
  const randomId = Math.floor(100000 + Math.random() * 900000);
  const ticketId = `${prefix}-${randomId}`;
  const existingTicket = await Ticket.findById(ticketId);
  if (existingTicket) {
    return generateTicketId(serverDbConnection, type);
  }
  return ticketId;
}

// Create a new ticket via API
router.post('/api/public/tickets', async (req: Request, res: Response) => {
  if (!req.serverDbConnection || !req.serverName) {
    return res.status(503).json({ 
      error: 'Service unavailable',
      message: 'Server database or server name not available' 
    });
  }
  
  const Ticket = req.serverDbConnection.model('Ticket');
  
  try {
    const {
      creatorUuid,
      creatorName,
      type,
      subject,
      description,
      reportedPlayerUuid,
      reportedPlayerName,
      chatMessages,
      formData,
      tags,
      priority
    }: CreateTicketRequest = req.body;
    
    // Validate required fields
    if (!type || !subject) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Type and subject are required fields'
      });
    }
    
    // Validate ticket type
    const validTypes = ['bug', 'player', 'chat', 'appeal', 'staff', 'support'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Bad request',
        message: `Invalid ticket type. Must be one of: ${validTypes.join(', ')}`
      });
    }
    
    // Type-specific validation
    if (['player', 'chat'].includes(type) && !reportedPlayerUuid && !reportedPlayerName) {
      return res.status(400).json({
        error: 'Bad request',
        message: `${type} reports require either reportedPlayerUuid or reportedPlayerName`
      });
    }
    
    if (type === 'chat' && (!chatMessages || chatMessages.length === 0)) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Chat reports require chatMessages array'
      });
    }
    
    // Generate ticket ID
    const ticketId = await generateTicketId(req.serverDbConnection, type);
    
    // Create initial message content
    let contentString = '';
    if (description) {
      contentString += `Description: ${description}\n\n`;
    }
    
    if (formData && Object.keys(formData).length > 0) {
      Object.entries(formData).forEach(([key, value]) => {
        contentString += `${key}: ${value}\n\n`;
      });
    }
    
    // Prepare ticket data
    const ticketData: any = {
      _id: ticketId,
      type,
      subject,
      status: 'Open',
      tags: tags || [type],
      creator: creatorName || 'API User',
      creatorUuid: creatorUuid || undefined,
      created: new Date(),
      locked: false,
      notes: [],
      replies: [],
      data: new Map<string, any>()
    };
    
    // Add type-specific fields
    if (reportedPlayerUuid) ticketData.reportedPlayerUuid = reportedPlayerUuid;
    if (reportedPlayerName) ticketData.reportedPlayer = reportedPlayerName;
    if (chatMessages) ticketData.chatMessages = chatMessages;
    if (priority) ticketData.data.set('priority', priority);
    
    // Add initial message if there's content
    if (contentString.trim()) {
      const initialMessage = {
        name: creatorName || 'API User',
        content: contentString.trim(),
        type: 'user',
        created: new Date(),
        staff: false
      };
      ticketData.replies = [initialMessage];
    }
    
    // Create and save ticket
    const newTicket = new Ticket(ticketData);
    await newTicket.save();
    
    // Log the creation
    console.log(`[Ticket API] Created ticket ${ticketId} of type ${type} via API`);
    
    res.status(201).json({
      success: true,
      ticketId: ticketId,
      message: 'Ticket created successfully',
      ticket: {
        id: ticketId,
        type,
        subject,
        status: 'Open',
        created: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error creating ticket via API:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create ticket'
    });
  }
});

// Get ticket status (useful for checking if ticket was created successfully)
router.get('/api/public/tickets/:id/status', async (req: Request, res: Response) => {
  if (!req.serverDbConnection) {
    return res.status(503).json({ 
      error: 'Service unavailable',
      message: 'Server database not available' 
    });
  }
  
  const Ticket = req.serverDbConnection.model('Ticket');
  
  try {
    const { id } = req.params;
    const ticket = await Ticket.findById(id);
    
    if (!ticket) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Ticket not found'
      });
    }
    
    res.json({
      id: ticket._id,
      type: ticket.type,
      subject: ticket.subject,
      status: ticket.status,
      created: ticket.created,
      locked: ticket.locked || false
    });
    
  } catch (error) {
    console.error('Error fetching ticket status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch ticket status'
    });
  }
});

export default router;
