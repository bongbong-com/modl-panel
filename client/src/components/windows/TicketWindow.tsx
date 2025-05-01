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
  StickyNote,
  ThumbsUp,
  ThumbsDown,
  Bug,
  Shield,
  Axe
} from 'lucide-react';
import { tickets } from '@/data/mockData';
import PlayerWindow from './PlayerWindow';

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

interface TicketNote {
  content: string;
  author: string;
  date: string;
}

// Define types for ticket categories and actions
type TicketCategory = 'Player Report' | 'Bug Report' | 'Punishment Appeal' | 'Other';
type PlayerReportAction = 'Accepted' | 'Rejected' | 'Close';
type BugReportAction = 'Completed' | 'Stale' | 'Duplicate' | 'Close';
type PunishmentAppealAction = 'Pardon' | 'Reduce' | 'Reject' | 'Close';

// Default responses for different ticket actions
const defaultReplies: Record<TicketCategory, Record<string, string>> = {
  'Player Report': {
    'Accepted': 'Thank you for creating this report. After careful review, we have accepted this and the reported player will be receiving a punishment.',
    'Rejected': 'Thank you for submitting this report. After reviewing the evidence provided, we have determined that this does not violate our community guidelines.',
    'Close': 'This ticket has been closed. Please feel free to open a new report if you encounter any other issues.'
  },
  'Bug Report': {
    'Completed': 'Thank you for reporting this bug. We have fixed the issue and it will be included in our next update.',
    'Stale': 'This bug report has been marked as stale due to inactivity or lack of information. Please feel free to reopen if you can provide additional details.',
    'Duplicate': 'This bug has been identified as a duplicate of an existing issue that our team is already working on.',
    'Close': 'This bug report has been closed. Thank you for your contribution to improving our game.'
  },
  'Punishment Appeal': {
    'Pardon': 'After reviewing your appeal, we have decided to remove the punishment completely. Thank you for your patience during this process.',
    'Reduce': 'We have reviewed your appeal and decided to reduce the duration of your punishment. The updated duration will be reflected in your account.',
    'Reject': 'After careful consideration of your appeal, we have decided to uphold the original punishment. The decision remains final.',
    'Close': 'This appeal has been closed. If you have additional information, please create a new appeal.'
  },
  'Other': {
    'Close': 'This ticket has been closed. Thank you for your message.'
  }
};

export interface TicketDetails {
  id: string;
  subject: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  priority: 'Critical' | 'Medium' | 'Low' | 'Fixed';
  reportedBy: string;
  assignedTo?: string;
  date: string;
  category: TicketCategory;
  relatedPlayer?: string;
  relatedPlayerId?: string;
  messages: TicketMessage[];
  notes: TicketNote[];
  newNote?: string;
  isAddingNote?: boolean;
  newReply?: string;
  selectedAction?: string;
  newDuration?: string;
  isPunishWindowOpen?: boolean;
}

const TicketWindow = ({ ticketId, isOpen, onClose, initialPosition }: TicketWindowProps) => {
  const [activeTab, setActiveTab] = useState('conversation');
  const [isPlayerWindowOpen, setIsPlayerWindowOpen] = useState(false);
  const [isPunishWindowOpen, setIsPunishWindowOpen] = useState(false);
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
      { content: "Checked server logs - confirmed toxic behavior in chat", author: "Admin", date: "2023-05-15 15:30" },
      { content: "Previous warnings found for the reported player", author: "ModeratorBeta", date: "2023-05-15 16:15" }
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

  const handleTicketAction = (action: string) => {
    setTicketDetails(prev => ({
      ...prev,
      selectedAction: action
    }));
  };

  const handleSendReply = () => {
    const now = new Date();
    const timestamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
    
    // Determine the content and subject based on selected action
    let messageContent = ticketDetails.newReply?.trim() || '';
    let status: 'Open' | 'In Progress' | 'Resolved' | 'Closed' = ticketDetails.status;
    
    // If an action is selected and it's not "Comment", format accordingly
    if (ticketDetails.selectedAction && ticketDetails.selectedAction !== 'Comment') {
      // Create action description
      let actionDesc = '';
      switch(ticketDetails.selectedAction) {
        case 'Accepted':
          actionDesc = "accepted this report";
          status = 'Resolved';
          break;
        case 'Rejected':
          actionDesc = "rejected this report";
          status = 'Closed';
          break;
        case 'Completed':
          actionDesc = "marked this bug as completed";
          status = 'Resolved';
          break;
        case 'Stale':
          actionDesc = "marked this bug as stale";
          status = 'Closed';
          break;
        case 'Duplicate':
          actionDesc = "marked this bug as duplicate";
          status = 'Closed';
          break;
        case 'Pardon':
          actionDesc = "pardoned this punishment";
          status = 'Resolved';
          break;
        case 'Reduce':
          actionDesc = `reduced the punishment to ${ticketDetails.newDuration || 'a shorter duration'}`;
          status = 'Resolved';
          break;
        case 'Reject':
          actionDesc = "rejected this appeal";
          status = 'Closed';
          break;
        case 'Close':
          actionDesc = "closed this ticket";
          status = 'Closed';
          break;
      }
      
      // Combine the action message with any additional comments
      if (messageContent) {
        messageContent = `ModeratorAlpha ${actionDesc}\n\n${messageContent}`;
      } else {
        messageContent = `ModeratorAlpha ${actionDesc}`;
      }
      
      // Update ticket status
      handleStatusChange(status);
    }
    
    // Only send if there's content or an action selected
    if (messageContent) {
      const newMessage: TicketMessage = {
        id: `msg-${ticketDetails.messages.length + 1}`,
        sender: "ModeratorAlpha",
        senderType: "staff",
        content: messageContent,
        timestamp
      };
  
      setTicketDetails(prev => ({
        ...prev,
        messages: [...prev.messages, newMessage],
        newReply: '',
        selectedAction: undefined,
        newDuration: undefined
      }));
    }
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
  
  // Helper function to get placeholder text based on selected action
  const getPlaceholderText = () => {
    if (!ticketDetails.selectedAction || ticketDetails.selectedAction === 'Comment') {
      return "Type your reply here...";
    }
    
    // Return default templates for the selected action if available
    if (ticketDetails.category && ticketDetails.selectedAction) {
      return defaultReplies[ticketDetails.category][ticketDetails.selectedAction] || "Type your reply here...";
    }
    
    return "Type your reply here...";
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
      {/* Player window for viewing related player */}
      {ticketDetails.relatedPlayerId && (
        <PlayerWindow
          playerId={ticketDetails.relatedPlayerId}
          isOpen={isPlayerWindowOpen}
          onClose={() => setIsPlayerWindowOpen(false)}
          initialPosition={{ x: 50, y: 50 }}
        />
      )}
      
      {/* Punish window for reported player */}
      {ticketDetails.relatedPlayerId && (
        <PlayerWindow
          playerId={ticketDetails.relatedPlayerId}
          isOpen={isPunishWindowOpen}
          onClose={() => setIsPunishWindowOpen(false)}
          initialPosition={{ x: 100, y: 100 }}
        />
      )}
      
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
                    <span className="ml-1 cursor-pointer hover:underline" 
                          onClick={() => setIsPlayerWindowOpen(true)}>
                      {ticketDetails.relatedPlayer}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 ml-1"
                      onClick={() => setIsPlayerWindowOpen(true)}
                    >
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
                  {/* Action buttons - moved above reply box */}
                  <div className="mb-4">
                    {/* Selected Action Label */}
                    {ticketDetails.selectedAction && ticketDetails.selectedAction !== 'Comment' && (
                      <div className="flex items-center mb-3 p-2 bg-muted/10 rounded border">
                        <span className="text-sm font-medium mr-2">Selected action:</span>
                        <Badge variant="outline" className={
                          ticketDetails.selectedAction === 'Accepted' || 
                          ticketDetails.selectedAction === 'Completed' || 
                          ticketDetails.selectedAction === 'Pardon' 
                            ? 'bg-success/10 text-success border-success/20'
                            : ticketDetails.selectedAction === 'Rejected' || 
                              ticketDetails.selectedAction === 'Reject'
                              ? 'bg-destructive/10 text-destructive border-destructive/20'
                              : ticketDetails.selectedAction === 'Stale' ||
                                ticketDetails.selectedAction === 'Reduce'
                                ? 'bg-warning/10 text-warning border-warning/20'
                                : ticketDetails.selectedAction === 'Duplicate'
                                  ? 'bg-info/10 text-info border-info/20'
                                  : 'bg-muted/30 text-muted-foreground'
                        }>
                          {ticketDetails.selectedAction}
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="ml-auto" 
                          onClick={() => setTicketDetails(prev => ({ ...prev, selectedAction: undefined }))}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                    
                    {/* Show duration field for "Reduce" action in punishment appeals */}
                    {ticketDetails.selectedAction === 'Reduce' && ticketDetails.category === 'Punishment Appeal' && (
                      <div className="mb-3 p-3 border rounded-md bg-warning/5">
                        <label className="block text-sm font-medium mb-1">New punishment duration:</label>
                        <input
                          type="text"
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                          placeholder="e.g., 7 days"
                          value={ticketDetails.newDuration || ''}
                          onChange={(e) => setTicketDetails(prev => ({ ...prev, newDuration: e.target.value }))}
                        />
                      </div>
                    )}

                    {/* Show punish button for "Accepted" action in player reports */}
                    {ticketDetails.selectedAction === 'Accepted' && ticketDetails.category === 'Player Report' && ticketDetails.relatedPlayer && (
                      <div className="mb-3 p-3 border rounded-md bg-success/5">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Apply punishment to {ticketDetails.relatedPlayer}?</span>
                          <Button size="sm" variant="outline" onClick={() => setIsPunishWindowOpen(true)} className="bg-success/10 text-success hover:bg-success/20">
                            <Axe className="h-3.5 w-3.5 mr-1.5" /> Punish Player
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {/* Player Report actions */}
                      {ticketDetails.category === 'Player Report' && (
                        <>
                          <Button 
                            variant={!ticketDetails.selectedAction ? 'default' : 'outline'}
                            size="sm" 
                            onClick={() => setTicketDetails(prev => ({ ...prev, selectedAction: 'Comment' }))}
                          >
                            Comment
                          </Button>
                          <Button 
                            variant={ticketDetails.selectedAction === 'Accepted' ? 'default' : 'outline'}
                            size="sm" 
                            className={ticketDetails.selectedAction === 'Accepted' 
                              ? 'bg-success' 
                              : 'bg-success/10 hover:bg-success/20 text-success'}
                            onClick={() => handleTicketAction('Accepted')}
                          >
                            <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
                            Accepted
                          </Button>
                          <Button 
                            variant={ticketDetails.selectedAction === 'Rejected' ? 'default' : 'outline'}
                            size="sm" 
                            className={ticketDetails.selectedAction === 'Rejected'
                              ? 'bg-destructive'
                              : 'bg-destructive/10 hover:bg-destructive/20 text-destructive'}
                            onClick={() => handleTicketAction('Rejected')}
                          >
                            <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />
                            Rejected
                          </Button>
                          <Button 
                            variant={ticketDetails.selectedAction === 'Close' ? 'default' : 'outline'}
                            size="sm" 
                            className={ticketDetails.selectedAction === 'Close'
                              ? 'bg-muted'
                              : 'bg-muted/20 hover:bg-muted/30'}
                            onClick={() => handleTicketAction('Close')}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1.5" />
                            Close (other)
                          </Button>
                        </>
                      )}
                      
                      {/* Bug Report actions */}
                      {ticketDetails.category === 'Bug Report' && (
                        <>
                          <Button 
                            variant={!ticketDetails.selectedAction ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setTicketDetails(prev => ({ ...prev, selectedAction: 'Comment' }))}
                          >
                            Comment
                          </Button>
                          <Button 
                            variant={ticketDetails.selectedAction === 'Completed' ? 'default' : 'outline'}
                            size="sm" 
                            className={ticketDetails.selectedAction === 'Completed'
                              ? 'bg-success'
                              : 'bg-success/10 hover:bg-success/20 text-success'}
                            onClick={() => handleTicketAction('Completed')}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                            Completed
                          </Button>
                          <Button 
                            variant={ticketDetails.selectedAction === 'Stale' ? 'default' : 'outline'}
                            size="sm" 
                            className={ticketDetails.selectedAction === 'Stale'
                              ? 'bg-warning'
                              : 'bg-warning/10 hover:bg-warning/20 text-warning'}
                            onClick={() => handleTicketAction('Stale')}
                          >
                            <Clock className="h-3.5 w-3.5 mr-1.5" />
                            Stale
                          </Button>
                          <Button 
                            variant={ticketDetails.selectedAction === 'Duplicate' ? 'default' : 'outline'}
                            size="sm" 
                            className={ticketDetails.selectedAction === 'Duplicate'
                              ? 'bg-info'
                              : 'bg-info/10 hover:bg-info/20 text-info'}
                            onClick={() => handleTicketAction('Duplicate')}
                          >
                            <Bug className="h-3.5 w-3.5 mr-1.5" />
                            Duplicate
                          </Button>
                          <Button 
                            variant={ticketDetails.selectedAction === 'Close' ? 'default' : 'outline'}
                            size="sm" 
                            className={ticketDetails.selectedAction === 'Close'
                              ? 'bg-muted'
                              : 'bg-muted/20 hover:bg-muted/30'}
                            onClick={() => handleTicketAction('Close')}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1.5" />
                            Close (other)
                          </Button>
                        </>
                      )}
                      
                      {/* Punishment Appeal actions */}
                      {ticketDetails.category === 'Punishment Appeal' && (
                        <>
                          <Button 
                            variant={!ticketDetails.selectedAction ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setTicketDetails(prev => ({ ...prev, selectedAction: 'Comment' }))}
                          >
                            Comment
                          </Button>
                          <Button 
                            variant={ticketDetails.selectedAction === 'Pardon' ? 'default' : 'outline'}
                            size="sm" 
                            className={ticketDetails.selectedAction === 'Pardon'
                              ? 'bg-success'
                              : 'bg-success/10 hover:bg-success/20 text-success'}
                            onClick={() => handleTicketAction('Pardon')}
                          >
                            <Shield className="h-3.5 w-3.5 mr-1.5" />
                            Pardon
                          </Button>
                          <Button 
                            variant={ticketDetails.selectedAction === 'Reduce' ? 'default' : 'outline'}
                            size="sm" 
                            className={ticketDetails.selectedAction === 'Reduce'
                              ? 'bg-warning'
                              : 'bg-warning/10 hover:bg-warning/20 text-warning'}
                            onClick={() => handleTicketAction('Reduce')}
                          >
                            <Clock className="h-3.5 w-3.5 mr-1.5" />
                            Reduce
                          </Button>
                          <Button 
                            variant={ticketDetails.selectedAction === 'Reject' ? 'default' : 'outline'}
                            size="sm" 
                            className={ticketDetails.selectedAction === 'Reject'
                              ? 'bg-destructive'
                              : 'bg-destructive/10 hover:bg-destructive/20 text-destructive'}
                            onClick={() => handleTicketAction('Reject')}
                          >
                            <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />
                            Reject
                          </Button>
                          <Button 
                            variant={ticketDetails.selectedAction === 'Close' ? 'default' : 'outline'}
                            size="sm" 
                            className={ticketDetails.selectedAction === 'Close'
                              ? 'bg-muted'
                              : 'bg-muted/20 hover:bg-muted/30'}
                            onClick={() => handleTicketAction('Close')}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1.5" />
                            Close (other)
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Reply section */}
                  <div className="flex flex-col">
                    <textarea
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm h-16 resize-none"
                      placeholder="Type your reply here..."
                      value={ticketDetails.newReply || ''}
                      onChange={(e) => setTicketDetails(prev => ({ ...prev, newReply: e.target.value }))}
                    ></textarea>
                    
                    <div className="flex justify-between mt-2">
                      <Button variant="outline" size="sm" className="gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        Attach
                      </Button>
                      <Button 
                        onClick={handleSendReply}
                        disabled={!ticketDetails.newReply?.trim() && !ticketDetails.selectedAction}
                      >
                        <Send className="h-4 w-4 mr-1.5" />
                        Send
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'notes' && (
              <div className="h-80">
                <div className="bg-muted/30 p-3 rounded-lg">
                  <ul className="space-y-3">
                    {ticketDetails.notes.map((note, idx) => (
                      <li key={idx} className="text-sm bg-muted/10 p-3 rounded-md">
                        <div className="flex justify-between items-start mb-1">
                          <div className="font-medium flex items-center">
                            <StickyNote className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                            {note.author}
                          </div>
                          <span className="text-xs text-muted-foreground">{note.date}</span>
                        </div>
                        <p className="pl-5">{note.content}</p>
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
                            
                            const newNote: TicketNote = {
                              content: ticketDetails.newNote || '',
                              author: 'Admin',
                              date: formattedDate
                            };
                            
                            setTicketDetails(prev => ({
                              ...prev,
                              notes: [...prev.notes, newNote],
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
      {ticketDetails.relatedPlayerId && (
        <PlayerWindow
          playerId={ticketDetails.relatedPlayerId}
          isOpen={isPlayerWindowOpen}
          onClose={() => setIsPlayerWindowOpen(false)}
          initialPosition={{ x: 50, y: 50 }}
        />
      )}
    </ResizableWindow>
  );
};

export default TicketWindow;