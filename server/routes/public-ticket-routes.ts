import express, { Request, Response } from 'express';
import { verifyTicketApiKey } from '../middleware/ticket-api-auth';

const router = express.Router();

// DO NOT apply API key verification to all routes - only apply to specific endpoints

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
  }  return ticketId;
}

// Create a new ticket via API (with API key authentication)
router.post('/tickets', verifyTicketApiKey, async (req: Request, res: Response) => {
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
    if (!type) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Type is required'
      });
    }
    
    // If no subject provided, create as Unfinished ticket
    const ticketStatus = subject ? 'Open' : 'Unfinished';
    const ticketSubject = subject || `${type.charAt(0).toUpperCase() + type.slice(1)} Ticket`;
    
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
      category: type, // Also set category for compatibility with panel interface
      subject: ticketSubject,
      status: ticketStatus,
      tags: tags || [type],
      creator: creatorName || 'API User',
      creatorUuid: creatorUuid || 'unknown-uuid',
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
    
    // Trigger AI analysis for Player Report tickets with chat messages
    if (req.serverDbConnection && type === 'chat' && chatMessages && chatMessages.length > 0) {
      try {
        const AIModerationService = (await import('../services/ai-moderation-service')).default;
        const aiModerationService = new AIModerationService(req.serverDbConnection);
        await aiModerationService.processNewTicket(ticketId, newTicket.toObject());
      } catch (aiError: any) {
        console.error(`[Public Ticket API] AI moderation processing failed for ticket ${ticketId}:`, aiError.message);
        // Don't fail the ticket creation if AI processing fails
      }
    }
      // Log the creation
    // Ticket created successfully
    
    res.status(201).json({
      success: true,
      ticketId: ticketId,
      message: 'Ticket created successfully',
      ticket: {
        id: ticketId,
        type,
        subject: ticketSubject,
        status: ticketStatus,
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

// Create a new ticket without API key authentication (initially Unfinished)
router.post('/tickets/unfinished', async (req: Request, res: Response) => {
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
      status: 'Unfinished',
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
    
    // Trigger AI analysis for Player Report tickets with chat messages
    if (req.serverDbConnection && type === 'chat' && chatMessages && chatMessages.length > 0) {
      try {
        const AIModerationService = (await import('../services/ai-moderation-service')).default;
        const aiModerationService = new AIModerationService(req.serverDbConnection);
        await aiModerationService.processNewTicket(ticketId, newTicket.toObject());
      } catch (aiError: any) {
        console.error(`[Public Ticket API] AI moderation processing failed for ticket ${ticketId}:`, aiError.message);
        // Don't fail the ticket creation if AI processing fails
      }
    }
      // Log the creation
    // Ticket created successfully
    
    res.status(201).json({
      success: true,
      ticketId: ticketId,
      message: 'Ticket created successfully (Unfinished)',
      ticket: {
        id: ticketId,
        type,
        subject,
        status: 'Unfinished',
        created: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error creating unfinished ticket via API:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create unfinished ticket'
    });
  }
});

// Get ticket status (useful for checking if ticket was created successfully)
router.get('/tickets/:id/status', verifyTicketApiKey, async (req: Request, res: Response) => {
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

// Public ticket viewing routes (no authentication required)
// Get full ticket details (public access)
router.get('/tickets/:id', async (req: Request, res: Response) => {
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
    
    // Return full ticket data for public access
    res.json({
      id: ticket._id,
      _id: ticket._id,
      type: ticket.type,
      subject: ticket.subject,
      status: ticket.status,
      creator: ticket.creator,
      creatorUuid: ticket.creatorUuid,
      reportedBy: ticket.creator, // Alias for compatibility
      created: ticket.created,
      date: ticket.created, // Alias for compatibility
      category: ticket.type, // Use type as category for compatibility
      locked: ticket.locked || false,
      replies: ticket.replies || [],
      messages: ticket.replies || [], // Alias for compatibility
      notes: ticket.notes || [],
      tags: ticket.tags || [],
      data: ticket.data || new Map(),
      formData: ticket.formData || {},
      reportedPlayer: ticket.reportedPlayer,
      reportedPlayerUuid: ticket.reportedPlayerUuid,
      chatMessages: ticket.chatMessages
    });
    
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch ticket'
    });
  }
});

// Add reply to ticket (public access)
router.post('/tickets/:id/replies', async (req: Request, res: Response) => {
  if (!req.serverDbConnection) {
    return res.status(503).json({ 
      error: 'Service unavailable',
      message: 'Server database not available' 
    });
  }
  
  const Ticket = req.serverDbConnection.model('Ticket');
  
  try {
    const { id } = req.params;
    const { name, content, type = 'user', staff = false } = req.body;
    
    if (!name || !content) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Name and content are required'
      });
    }
    
    const ticket = await Ticket.findById(id);
    
    if (!ticket) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Ticket not found'
      });
    }
    
    if (ticket.locked) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This ticket is locked and cannot accept new replies'
      });
    }
    
    // Create new reply
    const newReply = {
      id: Date.now().toString(),
      name: name,
      content: content,
      type: type,
      created: new Date(),
      staff: staff,
      // Compatibility fields
      sender: name,
      senderType: staff ? 'staff' : 'user',
      timestamp: new Date().toISOString()
    };
    
    // Add reply to ticket
    if (!ticket.replies) {
      ticket.replies = [];
    }
    ticket.replies.push(newReply);
    
    await ticket.save();
    
    res.status(201).json({
      success: true,
      message: 'Reply added successfully',
      reply: newReply
    });
    
  } catch (error) {
    console.error('Error adding reply to ticket:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to add reply'
    });
  }
});

// Submit ticket form (convert from Unfinished to Open)
router.post('/tickets/:id/submit', async (req: Request, res: Response) => {
  if (!req.serverDbConnection) {
    return res.status(503).json({ 
      error: 'Service unavailable',
      message: 'Server database not available' 
    });
  }
  
  const Ticket = req.serverDbConnection.model('Ticket');
  
  try {
    const { id } = req.params;
    const { subject, formData } = req.body;
    
    const ticket = await Ticket.findById(id);
    
    if (!ticket) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Ticket not found'
      });
    }
      // Update ticket with form data
    if (subject) {
      ticket.subject = subject;
    }
    
    if (formData) {
      if (!ticket.data) {
        ticket.data = new Map();
      }
      // Store form data
      Object.entries(formData).forEach(([key, value]) => {
        ticket.data.set(key, value);
      });
      ticket.formData = formData;
      
      // Create initial message content from form data
      let contentString = '';
      Object.entries(formData).forEach(([key, value]) => {
        if (value && value.toString().trim()) {
          // Format field names to be more readable
          const fieldLabel = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
          contentString += `**${fieldLabel}:**\n${value}\n\n`;
        }
      });
      
      // Add initial message if there's content and no existing replies
      if (contentString.trim() && (!ticket.replies || ticket.replies.length === 0)) {
        const initialMessage = {
          id: Date.now().toString(),
          name: ticket.creator || 'User',
          content: contentString.trim(),
          type: 'user',
          created: new Date(),
          staff: false,
          // Compatibility fields
          sender: ticket.creator || 'User',
          senderType: 'user',
          timestamp: new Date().toISOString()
        };
        
        if (!ticket.replies) {
          ticket.replies = [];
        }
        ticket.replies.push(initialMessage);
      }
    }
    
    // Change status from Unfinished to Open
    ticket.status = 'Open';
    
    await ticket.save();
    
    res.json({
      success: true,
      message: 'Ticket submitted successfully',
      ticket: {
        id: ticket._id,
        subject: ticket.subject,
        status: ticket.status
      }
    });
    
  } catch (error) {
    console.error('Error submitting ticket:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to submit ticket'
    });
  }
});

export default router;
