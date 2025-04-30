import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import {
  MessageSquare,
  User,
  Flag,
  AlertCircle,
  Clock,
  FileText,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Send,
  ArrowUpRight,
  Link2,
  StickyNote,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { tickets } from '@/data/mockData';
import PageContainer from '@/components/layout/PageContainer';

export interface TicketMessage {
  id: string;
  sender: string;
  senderType: 'user' | 'staff' | 'system';
  content: string;
  timestamp: string;
  attachments?: string[];
}

export interface TicketDetails {
  id: string;
  subject: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  priority: 'Critical' | 'Medium' | 'Low' | 'Fixed';
  reportedBy: string;
  assignedTo?: string;
  date: string;
  category: string;
  relatedPlayer?: string;
  relatedPlayerId?: string;
  messages: TicketMessage[];
  notes: string[];
  newNote?: string;
  isAddingNote?: boolean;
  newReply?: string;
}

const TicketDetail = () => {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('conversation');
  const location = useLocation();
  
  // More robust parsing of ticket ID from URL
  const path = location[0];
  const pathParts = path.split('/');
  
  // Get the last part of the URL which should be the ticket ID
  const ticketId = pathParts[pathParts.length - 1];
  
  // Debug
  console.log('Current URL path:', path);
  console.log('Path parts:', pathParts);
  console.log('Extracted ticket ID:', ticketId);

  const [ticketDetails, setTicketDetails] = useState<TicketDetails>({
    id: "T-12345",
    subject: "Player report: inappropriate behavior",
    status: "Open",
    priority: "Medium",
    reportedBy: "GamePlayer123",
    assignedTo: undefined,
    date: "2023-05-15",
    category: "Player Report",
    relatedPlayer: "DragonSlayer123",
    relatedPlayerId: "98f7e654-3d21-321d-4c5b-6a7890123d4e",
    messages: [
      {
        id: "msg-1",
        sender: "GamePlayer123",
        senderType: "user",
        content: "I want to report a player who was being very toxic in chat. They were saying inappropriate things and harassing other players. I have attached screenshots of the chat logs.",
        timestamp: "2023-05-15 14:23",
        attachments: ["screenshot1.png", "screenshot2.png"]
      },
      {
        id: "msg-2",
        sender: "System",
        senderType: "system",
        content: "Ticket #T-12345 has been created and will be reviewed by a staff member shortly.",
        timestamp: "2023-05-15 14:24"
      },
      {
        id: "msg-3",
        sender: "ModeratorAlpha",
        senderType: "staff",
        content: "Thank you for your report. I've reviewed the screenshots and will take appropriate action. Could you provide any additional information about when this occurred?",
        timestamp: "2023-05-15 15:10"
      },
      {
        id: "msg-4",
        sender: "GamePlayer123",
        senderType: "user",
        content: "It happened around 2:00 PM today on the Survival server. There were about 5-6 other players who witnessed it as well.",
        timestamp: "2023-05-15 15:17"
      }
    ],
    notes: [
      "Checked server logs - confirmed toxic behavior in chat",
      "Previous warnings found for the reported player"
    ]
  });

  const statusColors = {
    'Open': 'bg-warning/10 text-warning border-warning/20',
    'In Progress': 'bg-primary/10 text-primary border-primary/20',
    'Resolved': 'bg-success/10 text-success border-success/20',
    'Closed': 'bg-muted/50 text-muted-foreground border-muted/30'
  };

  const priorityColors = {
    'Critical': 'bg-destructive/10 text-destructive border-destructive/20',
    'Medium': 'bg-warning/10 text-warning border-warning/20',
    'Low': 'bg-info/10 text-info border-info/20',
    'Fixed': 'bg-success/10 text-success border-success/20'
  };

  useEffect(() => {
    if (ticketId) {
      // In a real app, fetch ticket data using the ticketId
      console.log('Fetching data for ticket:', ticketId);
      
      // Convert from URL safe format back to original format if needed
      // For example, if ID-BUG-1234 was used instead of #BUG-1234
      const originalTicketId = ticketId.startsWith('ID-') 
        ? '#' + ticketId.substring(3) 
        : ticketId;
      
      console.log('Looking for ticket with ID:', originalTicketId);
      
      // Find the ticket in our mock data - try direct match first
      let ticket = tickets.find(t => t.id === originalTicketId);
      
      // If no match, try with case insensitive comparison
      if (!ticket) {
        console.log('No exact match, trying case insensitive...');
        ticket = tickets.find(t => 
          t.id.toLowerCase() === originalTicketId.toLowerCase() || 
          t.id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === originalTicketId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
        );
      }
      
      // If still no match, try without the ID- prefix
      if (!ticket) {
        console.log('Trying without any special handling');
        ticket = tickets.find(t => 
          t.id === ticketId || 
          t.id.toLowerCase() === ticketId.toLowerCase()
        );
      }
      
      // If still no match, just use first ticket
      if (!ticket && tickets.length > 0) {
        console.log('No match found, using first ticket as fallback');
        ticket = tickets[0];
      }
      
      if (ticket) {
        console.log('Found matching ticket:', ticket);
        setTicketDetails(prev => ({
          ...prev,
          id: ticket.id,
          subject: ticket.subject,
          reportedBy: ticket.reportedBy,
          date: ticket.date,
          status: ticket.status as any,
          priority: ticket.priority
        }));
      } else {
        console.error('No tickets available');
      }
    }
  }, [ticketId]);

  const handleSendReply = () => {
    if (!ticketDetails.newReply?.trim()) return;

    const now = new Date();
    const timestamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
    
    const newMessage: TicketMessage = {
      id: `msg-${ticketDetails.messages.length + 1}`,
      sender: "Admin",
      senderType: "staff",
      content: ticketDetails.newReply,
      timestamp
    };

    setTicketDetails(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage],
      newReply: ''
    }));
  };

  const handleStatusChange = (newStatus: 'Open' | 'In Progress' | 'Resolved' | 'Closed') => {
    setTicketDetails(prev => ({
      ...prev,
      status: newStatus
    }));
  };

  const handlePriorityChange = (newPriority: 'Critical' | 'Medium' | 'Low' | 'Fixed') => {
    setTicketDetails(prev => ({
      ...prev,
      priority: newPriority
    }));
  };

  return (
    <PageContainer title={`Ticket: ${ticketDetails.subject}`}>
      <div className="flex flex-col space-y-6">
        <div className="flex items-center mb-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-1" 
            onClick={() => setLocation('/tickets')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Tickets
          </Button>
        </div>

        <div className="bg-background-lighter p-6 rounded-lg">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-medium">{ticketDetails.subject}</h2>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant="outline" className={statusColors[ticketDetails.status]}>
                    {ticketDetails.status}
                  </Badge>
                  <Badge variant="outline" className={priorityColors[ticketDetails.priority]}>
                    {ticketDetails.priority}
                  </Badge>
                  <Badge variant="outline" className="bg-muted/20 text-muted-foreground border-muted/20">
                    {ticketDetails.category}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => ticketDetails.status !== 'Resolved' ? handleStatusChange('Resolved') : handleStatusChange('Open')}
                >
                  {ticketDetails.status === 'Resolved' ? 'Reopen' : 'Resolve'}
                </Button>
                <Button variant="outline">Assign</Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 mt-2 text-sm">
              <div>
                <span className="text-muted-foreground">Reported By:</span>
                <span className="ml-1">{ticketDetails.reportedBy}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Date:</span>
                <span className="ml-1">{ticketDetails.date}</span>
              </div>
              {ticketDetails.assignedTo && (
                <div>
                  <span className="text-muted-foreground">Assigned To:</span>
                  <span className="ml-1">{ticketDetails.assignedTo}</span>
                </div>
              )}
              {ticketDetails.relatedPlayer && (
                <div className="flex items-center">
                  <span className="text-muted-foreground">Related Player:</span>
                  <span className="ml-1">{ticketDetails.relatedPlayer}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 ml-1">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-3">
            <div className="bg-background-lighter p-4 rounded-lg">
              <div className="flex gap-2 border-b mb-4 pb-1">
                <Button 
                  variant={activeTab === 'conversation' ? 'default' : 'ghost'} 
                  onClick={() => setActiveTab('conversation')}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary pb-2"
                  data-state={activeTab === 'conversation' ? 'active' : undefined}
                >
                  <MessageSquare className="h-4 w-4 mr-1.5" />
                  Conversation
                </Button>
                <Button 
                  variant={activeTab === 'notes' ? 'default' : 'ghost'} 
                  onClick={() => setActiveTab('notes')}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary pb-2"
                  data-state={activeTab === 'notes' ? 'active' : undefined}
                >
                  <StickyNote className="h-4 w-4 mr-1.5" />
                  Staff Notes
                </Button>
              </div>
              
              {activeTab === 'conversation' && (
                <div>
                  <div className="space-y-4 mb-4 max-h-[500px] overflow-y-auto p-1">
                    {ticketDetails.messages.map((message) => (
                      <div 
                        key={message.id} 
                        className={`flex gap-3 ${message.senderType === 'user' ? '' : 'bg-muted/20 p-3 rounded-md'}`}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className={
                            message.senderType === 'user' 
                              ? 'bg-primary/10 text-primary' 
                              : message.senderType === 'staff' 
                                ? 'bg-success/10 text-success' 
                                : 'bg-muted text-muted-foreground'
                          }>
                            {message.senderType === 'system' ? 'SYS' : message.sender.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between">
                            <div className="font-medium text-sm flex items-center">
                              {message.sender}
                              {message.senderType === 'staff' && (
                                <Badge variant="outline" className="ml-2 text-xs bg-success/10 text-success border-success/20">
                                  Staff
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">{message.timestamp}</span>
                          </div>
                          <p className="text-sm mt-1">{message.content}</p>
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {message.attachments.map((attachment, idx) => (
                                <div key={idx} className="text-xs flex items-center bg-muted/20 text-muted-foreground px-2 py-1 rounded">
                                  <FileText className="h-3 w-3 mr-1" />
                                  {attachment}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="flex gap-3">
                      <textarea
                        className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm h-20 resize-none"
                        placeholder="Type your reply here..."
                        value={ticketDetails.newReply || ''}
                        onChange={(e) => setTicketDetails(prev => ({ ...prev, newReply: e.target.value }))}
                      ></textarea>
                      <div className="flex flex-col justify-end">
                        <Button 
                          onClick={handleSendReply}
                          disabled={!ticketDetails.newReply?.trim()}
                        >
                          <Send className="h-4 w-4 mr-1.5" />
                          Send
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-between mt-3">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <FileText className="h-3.5 w-3.5 mr-1" />
                          Attach
                        </Button>
                        <Button variant="outline" size="sm">
                          <Link2 className="h-3.5 w-3.5 mr-1" />
                          Link Player
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'notes' && (
                <div>
                  <div className="space-y-3">
                    {ticketDetails.notes.map((note, idx) => (
                      <div key={idx} className="bg-muted/30 p-3 rounded-lg">
                        <div className="flex items-start">
                          <StickyNote className="h-3.5 w-3.5 mr-2 mt-0.5 text-muted-foreground" />
                          <span className="text-sm">{note}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {ticketDetails.isAddingNote && (
                    <div className="mt-4 bg-muted/10 p-4 rounded-lg border">
                      <textarea 
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm h-20"
                        placeholder="Enter your note here..."
                        value={ticketDetails.newNote || ''}
                        onChange={(e) => setTicketDetails(prev => ({...prev, newNote: e.target.value}))}
                      ></textarea>
                      <div className="flex justify-end mt-2 gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setTicketDetails(prev => ({
                            ...prev, 
                            isAddingNote: false,
                            newNote: ''
                          }))}
                        >
                          Cancel
                        </Button>
                        <Button 
                          size="sm"
                          disabled={!ticketDetails.newNote?.trim()}
                          onClick={() => {
                            const currentDate = new Date();
                            const formattedDate = `${currentDate.toLocaleDateString()} at ${currentDate.toLocaleTimeString()}`;
                            const newNoteWithMetadata = `${ticketDetails.newNote} (Added by Admin on ${formattedDate})`;
                            
                            setTicketDetails(prev => ({
                              ...prev,
                              notes: [...prev.notes, newNoteWithMetadata],
                              isAddingNote: false,
                              newNote: ''
                            }));
                          }}
                        >
                          Save Note
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {!ticketDetails.isAddingNote && (
                    <Button 
                      variant="outline" 
                      className="mt-3"
                      onClick={() => setTicketDetails(prev => ({...prev, isAddingNote: true}))}
                    >
                      <StickyNote className="h-3.5 w-3.5 mr-1" /> Add Note
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-background-lighter p-4 rounded-lg">
            <h3 className="font-medium mb-3">Ticket Actions</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Status</h4>
                <div className="grid grid-cols-1 gap-2">
                  <Button 
                    size="sm"
                    variant={ticketDetails.status === 'Open' ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => handleStatusChange('Open')}
                  >
                    <AlertCircle className="h-3.5 w-3.5 mr-2" />
                    Open
                  </Button>
                  <Button 
                    size="sm"
                    variant={ticketDetails.status === 'In Progress' ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => handleStatusChange('In Progress')}
                  >
                    <Clock className="h-3.5 w-3.5 mr-2" />
                    In Progress
                  </Button>
                  <Button 
                    size="sm"
                    variant={ticketDetails.status === 'Resolved' ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => handleStatusChange('Resolved')}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                    Resolved
                  </Button>
                  <Button 
                    size="sm"
                    variant={ticketDetails.status === 'Closed' ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => handleStatusChange('Closed')}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-2" />
                    Closed
                  </Button>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-2">Priority</h4>
                <div className="grid grid-cols-1 gap-2">
                  <Button 
                    size="sm"
                    variant={ticketDetails.priority === 'Critical' ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => handlePriorityChange('Critical')}
                  >
                    <ShieldAlert className="h-3.5 w-3.5 mr-2" />
                    Critical
                  </Button>
                  <Button 
                    size="sm"
                    variant={ticketDetails.priority === 'Medium' ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => handlePriorityChange('Medium')}
                  >
                    <Flag className="h-3.5 w-3.5 mr-2" />
                    Medium
                  </Button>
                  <Button 
                    size="sm"
                    variant={ticketDetails.priority === 'Low' ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => handlePriorityChange('Low')}
                  >
                    <AlertCircle className="h-3.5 w-3.5 mr-2" />
                    Low
                  </Button>
                  <Button 
                    size="sm"
                    variant={ticketDetails.priority === 'Fixed' ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => handlePriorityChange('Fixed')}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                    Fixed
                  </Button>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-2">Actions</h4>
                <div className="grid grid-cols-1 gap-2">
                  <Button 
                    size="sm"
                    variant="outline"
                    className="justify-start"
                  >
                    <User className="h-3.5 w-3.5 mr-2" />
                    Assign Ticket
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline"
                    className="justify-start"
                  >
                    <Link2 className="h-3.5 w-3.5 mr-2" />
                    Link Player
                  </Button>
                  {ticketDetails.status !== 'Closed' && (
                    <Button 
                      size="sm"
                      variant="outline"
                      className="justify-start text-destructive"
                      onClick={() => handleStatusChange('Closed')}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-2" />
                      Close Ticket
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default TicketDetail;