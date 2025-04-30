import { useState, useEffect } from 'react';
import { WindowPosition } from '@/lib/types';
import ResizableWindow from '@/components/layout/ResizableWindow';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  StickyNote
} from 'lucide-react';
import { tickets } from '@/data/mockData';

interface TicketWindowProps {
  ticketId: string;
  isOpen: boolean;
  onClose: () => void;
  initialPosition?: WindowPosition;
}

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

const TicketWindow = ({ ticketId, isOpen, onClose, initialPosition }: TicketWindowProps) => {
  const [activeTab, setActiveTab] = useState('conversation');
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
    if (ticketId && isOpen) {
      // In a real app, fetch ticket data using the ticketId
      console.log('Fetching data for ticket:', ticketId);
      
      // Find the ticket in our mock data
      const ticket = tickets.find(t => t.id === ticketId);
      if (ticket) {
        setTicketDetails(prev => ({
          ...prev,
          id: ticket.id,
          subject: ticket.subject,
          reportedBy: ticket.reportedBy,
          date: ticket.date,
          status: ticket.status as any,
          priority: ticket.priority
        }));
      }
    }
  }, [ticketId, isOpen]);

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
    <ResizableWindow
      id={`ticket-${ticketId}`}
      title={`Ticket: ${ticketDetails.subject}`}
      isOpen={isOpen}
      onClose={onClose}
      initialPosition={initialPosition}
      initialSize={{ width: 700, height: 600 }}
    >
      <div className="space-y-4">
        <div className="pt-2">
          <div className="bg-background-lighter p-4 rounded-lg">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-medium">{ticketDetails.subject}</h3>
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
                    size="sm"
                    onClick={() => ticketDetails.status !== 'Resolved' ? handleStatusChange('Resolved') : handleStatusChange('Open')}
                  >
                    {ticketDetails.status === 'Resolved' ? 'Reopen' : 'Resolve'}
                  </Button>
                  <Button variant="outline" size="sm">Assign</Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 text-sm">
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
        </div>
        
        <div className="px-1">
          <div className="flex gap-2">
            <Button 
              variant={activeTab === 'conversation' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setActiveTab('conversation')}
              className="rounded-md"
            >
              <MessageSquare className="h-4 w-4 mr-1.5" />
              Conversation
            </Button>
            <Button 
              variant={activeTab === 'notes' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setActiveTab('notes')}
              className="rounded-md"
            >
              <StickyNote className="h-4 w-4 mr-1.5" />
              Staff Notes
            </Button>
          </div>
          
          <div className="border rounded-md rounded-tl-none p-3 bg-background">
            {activeTab === 'conversation' && (
              <div className="flex flex-col h-80">
                <div className="flex-1 overflow-y-auto space-y-3 mb-3">
                  {ticketDetails.messages.map((message) => (
                    <div 
                      key={message.id} 
                      className={`flex gap-3 ${message.senderType === 'user' ? '' : 'bg-muted/20 p-2 rounded-md'}`}
                    >
                      <Avatar className="h-8 w-8">
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
                
                <div className="border-t pt-3">
                  <div className="flex gap-3">
                    <textarea
                      className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm h-16 resize-none"
                      placeholder="Type your reply here..."
                      value={ticketDetails.newReply || ''}
                      onChange={(e) => setTicketDetails(prev => ({ ...prev, newReply: e.target.value }))}
                    ></textarea>
                    <div>
                      <Button 
                        onClick={handleSendReply}
                        disabled={!ticketDetails.newReply?.trim()}
                      >
                        <Send className="h-4 w-4 mr-1.5" />
                        Send
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between mt-2">
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
                    {/* Close ticket button removed */}
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'notes' && (
              <div className="h-80">
                <div className="bg-muted/30 p-3 rounded-lg">
                  <ul className="space-y-2">
                    {ticketDetails.notes.map((note, idx) => (
                      <li key={idx} className="text-sm flex items-start">
                        <StickyNote className="h-3.5 w-3.5 mr-2 mt-0.5 text-muted-foreground" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                  
                  {ticketDetails.isAddingNote && (
                    <div className="mt-3 border-t border-border pt-3">
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
                </div>
                
                {!ticketDetails.isAddingNote && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-2"
                    onClick={() => setTicketDetails(prev => ({...prev, isAddingNote: true}))}
                  >
                    <StickyNote className="h-3.5 w-3.5 mr-1" /> Add Note
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">Status:</span>
              <div className="flex gap-1">
                <Button 
                  size="sm"
                  variant={ticketDetails.status === 'Open' ? 'default' : 'outline'}
                  className="h-7 px-2"
                  onClick={() => handleStatusChange('Open')}
                >Open</Button>
                <Button 
                  size="sm"
                  variant={ticketDetails.status === 'In Progress' ? 'default' : 'outline'}
                  className="h-7 px-2"
                  onClick={() => handleStatusChange('In Progress')}
                >In Progress</Button>
                <Button 
                  size="sm"
                  variant={ticketDetails.status === 'Resolved' ? 'default' : 'outline'}
                  className="h-7 px-2"
                  onClick={() => handleStatusChange('Resolved')}
                >Resolved</Button>
                <Button 
                  size="sm"
                  variant={ticketDetails.status === 'Closed' ? 'default' : 'outline'}
                  className="h-7 px-2"
                  onClick={() => handleStatusChange('Closed')}
                >Closed</Button>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm">Priority:</span>
              <div className="flex gap-1">
                <Button 
                  size="sm"
                  variant={ticketDetails.priority === 'Critical' ? 'default' : 'outline'}
                  className="h-7 px-2"
                  onClick={() => handlePriorityChange('Critical')}
                >Critical</Button>
                <Button 
                  size="sm"
                  variant={ticketDetails.priority === 'Medium' ? 'default' : 'outline'}
                  className="h-7 px-2"
                  onClick={() => handlePriorityChange('Medium')}
                >Medium</Button>
                <Button 
                  size="sm"
                  variant={ticketDetails.priority === 'Low' ? 'default' : 'outline'}
                  className="h-7 px-2"
                  onClick={() => handlePriorityChange('Low')}
                >Low</Button>
                <Button 
                  size="sm"
                  variant={ticketDetails.priority === 'Fixed' ? 'default' : 'outline'}
                  className="h-7 px-2"
                  onClick={() => handlePriorityChange('Fixed')}
                >Fixed</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ResizableWindow>
  );
};

export default TicketWindow;