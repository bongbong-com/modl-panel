import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
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
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  Bug,
  Shield,
  Axe,
  Tag,
  Plus,
  X,
  Lock as LockIcon,
  Unlock as UnlockIcon,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { useTicket, usePanelTicket, useUpdateTicket } from '@/hooks/use-data';
import PageContainer from '@/components/layout/PageContainer';
import PlayerWindow from '@/components/windows/PlayerWindow';

export interface TicketMessage {
  id: string;
  sender: string;
  senderType: 'user' | 'staff' | 'system';
  content: string;
  timestamp: string;
  staff?: boolean; // Indicates if the sender is a staff member
  attachments?: string[];
  closedAs?: string; // Optional field to track if this message closed the ticket
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
export const defaultReplies: Record<TicketCategory, Record<string, string>> = {
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
  status: 'Open' | 'Closed'; // Simplified to just Open/Closed
  reportedBy: string;
  date: string;
  category: TicketCategory;
  relatedPlayer?: string;
  relatedPlayerId?: string;
  messages: TicketMessage[];
  notes: TicketNote[];
  locked?: boolean; // Tracks if the ticket is locked
  newNote?: string;
  isAddingNote?: boolean;
  newReply?: string;
  selectedAction?: string;
  newDuration?: string; // For backward compatibility
  duration?: {
    value?: number;
    unit?: 'hours' | 'days' | 'weeks' | 'months';
  };
  isPermanent?: boolean;
  tags?: string[];
  newTag?: string;
}

const TicketDetail = () => {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('conversation');
  const [isPlayerWindowOpen, setIsPlayerWindowOpen] = useState(false);
  const [isPunishWindowOpen, setIsPunishWindowOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
    // Format date to MM/dd/yy HH:mm in browser's timezone
  const formatDate = (dateString: string): string => {
    try {
      // Handle various date formats and edge cases
      if (!dateString) {
        return 'Unknown';
      }
      
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString);
        return 'Invalid Date';
      }
      
      return date.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (e) {
      console.error('Error formatting date:', e, 'Original string:', dateString);
      return 'Unknown'; // Return a more user-friendly fallback
    }
  };
    // More robust parsing of ticket ID from URL
  const path = location[0];
  const pathParts = path.split('/');
  
  // Get the last part of the URL which should be the ticket ID
  let ticketId = pathParts[pathParts.length - 1];
  
  // Reverse the transformation done in navigation (ID- back to #)
  if (ticketId.startsWith('ID-')) {
    ticketId = ticketId.replace('ID-', '#');
  }
  
  // Debug
  console.log('Current URL path:', path);
  console.log('Path parts:', pathParts);
  console.log('Raw URL ticket ID:', pathParts[pathParts.length - 1]);
  console.log('Processed ticket ID for API:', ticketId);

  // Sample default tags based on category
  const getDefaultTagsForCategory = (category: TicketCategory): string[] => {
    switch(category) {
      case 'Bug Report':
        return ['Bug Report'];
      case 'Player Report':
        return ['Player Report'];
      case 'Punishment Appeal':
        return ['Ban Appeal'];
      default:
        return [];
    }
  };

  const [ticketDetails, setTicketDetails] = useState<TicketDetails>({
    id: "",
    subject: "",
    status: "Open",
    reportedBy: "",
    date: "",
    category: "Player Report",
    relatedPlayer: "",
    relatedPlayerId: "",
    tags: [],
    messages: [],
    notes: [],
    locked: false
  });

  // Simplified status colors - just Open and Closed
  const statusColors = {
    'Open': 'bg-green-50 text-green-700 border-green-200',
    'Closed': 'bg-red-50 text-red-700 border-red-200'
  };

  const priorityColors = {
    'Critical': 'bg-destructive/10 text-destructive border-destructive/20',
    'Medium': 'bg-warning/10 text-warning border-warning/20',
    'Low': 'bg-info/10 text-info border-info/20',
    'Fixed': 'bg-success/10 text-success border-success/20'
  };  // Use React Query to fetch ticket data from panel API
  const { data: ticketData, isLoading, isError, error } = usePanelTicket(ticketId);
  
  // Enhanced debugging for remote environment
  console.log('=== TICKET DETAIL DEBUG (Remote Environment) ===');
  console.log('Current environment:', {
    location: window.location.href,
    origin: window.location.origin,
    pathname: window.location.pathname
  });
  console.log('Ticket ID:', ticketId);
  console.log('User auth status:', user ? 'authenticated' : 'not authenticated');
  console.log('User details:', user);
  console.log('Query state:', { isLoading, isError, hasData: !!ticketData });
  console.log('Error details:', error);
  console.log('Raw ticket data:', ticketData);
  console.log('================================================');
  
  // Mutation hook for updating tickets
  const updateTicketMutation = useUpdateTicket();
  useEffect(() => {
    console.log('useEffect triggered. ticketData:', ticketData);
    console.log('isLoading:', isLoading, 'isError:', isError);
    console.log('ticketId:', ticketId);
    
    if (ticketData) {
      console.log('Received ticket data from MongoDB:', ticketData);
      console.log('Ticket data keys:', Object.keys(ticketData));
        // Convert ticket type to category
      if (!ticketData.type) {
        // Try to infer type from ID if not present
        if (ticketData.id?.startsWith("BUG")) {
          ticketData.type = 'bug';
        } else if (ticketData.id?.startsWith("PLAYER")) {
          ticketData.type = 'player';
        } else if (ticketData.id?.startsWith("APPEAL")) {
          ticketData.type = 'appeal';
        } else {
          ticketData.type = 'support'; // default fallback
        }
      }
      
      const category = (ticketData.type === 'bug' ? 'Bug Report' : 
                      ticketData.type === 'player' ? 'Player Report' : 
                      ticketData.type === 'appeal' ? 'Punishment Appeal' : 'Other') as TicketCategory;
        // Get default tags for this category if no tags are provided
      const tags = ticketData.tags || getDefaultTagsForCategory(category);
      
      // Ensure we have a valid date
      let validDate = new Date().toISOString(); // fallback to current time
      if (ticketData.date) {
        const dateFromField = new Date(ticketData.date);
        if (!isNaN(dateFromField.getTime())) {
          validDate = dateFromField.toISOString();
        }
      } else if (ticketData.created) {
        const createdDate = new Date(ticketData.created);
        if (!isNaN(createdDate.getTime())) {
          validDate = createdDate.toISOString();
        }
      }
      
      // Map MongoDB data to our TicketDetails interface
      setTicketDetails({
        id: ticketData.id || ticketData._id,
        subject: ticketData.subject || 'No Subject',
        // Simplify status to Open/Closed - anything but Closed is Open
        status: (ticketData.locked === true || ticketData.status === 'Closed') ? 'Closed' : 'Open',
        reportedBy: ticketData.reportedBy || 'Unknown',
        date: validDate,
        category,
        relatedPlayer: ticketData.relatedPlayer?.username || ticketData.relatedPlayerName,
        relatedPlayerId: ticketData.relatedPlayer?.uuid || ticketData.relatedPlayerId,
        messages: (ticketData.messages || (ticketData.replies && ticketData.replies.map((reply: any) => ({
          id: reply._id || reply.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          sender: reply.name,
          senderType: reply.type === 'staff' ? 'staff' : 
                     reply.type === 'system' ? 'system' : 'user',
          content: reply.content,
          timestamp: reply.created ? (new Date(reply.created).toISOString() || new Date().toISOString()) : new Date().toISOString(),
          staff: reply.staff,
          closedAs: (reply.action === "Comment" || reply.action === "Reopen") ? undefined : reply.action
        }))) || []),
        notes: ticketData.notes || [],
        tags,
        locked: ticketData.locked === true,
        // Set default action to "Comment" to highlight the Comment button
        selectedAction: 'Comment' 
      });
    }
  }, [ticketData]);

  // Define updated handlers that save changes to MongoDB
  const handleAddNote = () => {
    if (!ticketDetails.newNote?.trim()) return;
    
    const now = new Date();
    // Store ISO string for the server
    const timestamp = now.toISOString();
    
    // Create the new note with proper structure
    const newNote: TicketNote = {
      content: ticketDetails.newNote.trim(),
      author: user?.username || 'Staff',
      date: timestamp
    };
    
    // First update local state for immediate UI feedback
    setTicketDetails(prev => ({
      ...prev,
      notes: [...prev.notes, newNote],
      newNote: '',
      isAddingNote: false
    }));
    
    // Then send update to server
    updateTicketMutation.mutate({
      id: ticketDetails.id,
      data: {
        newNote: newNote
      }
    });
  };

  // Get placeholder text based on selected action
  const getPlaceholderText = () => {
    if (ticketDetails.selectedAction && ticketDetails.selectedAction !== 'Comment' && 
        defaultReplies[ticketDetails.category] && 
        defaultReplies[ticketDetails.category][ticketDetails.selectedAction]) {
      // Replace any placeholders in the default text
      let text = defaultReplies[ticketDetails.category][ticketDetails.selectedAction];
      if (ticketDetails.relatedPlayer && text.includes('{reported-player}')) {
        text = text.replace('{reported-player}', ticketDetails.relatedPlayer);
      }
      return text;
    }
    return "Type your reply here...";
  };

  const handleSendReply = () => {
    const now = new Date();
    // Use ISO format for consistent timestamps
    const timestamp = now.toISOString();
    
    // Determine the content and subject based on selected action
    let messageContent = ticketDetails.newReply?.trim() || '';
    // Simplified status: only Open or Closed
    let status: 'Open' | 'Closed' = ticketDetails.status;
    
    // If no message content but default text is available, use that
    if (!messageContent && ticketDetails.selectedAction && ticketDetails.selectedAction !== 'Comment') {
      messageContent = getPlaceholderText();
    }
    
    // If an action is selected and it's not "Comment", format accordingly
    if (ticketDetails.selectedAction && ticketDetails.selectedAction !== 'Comment') {
      // Create action description
      let actionDesc = '';
      switch(ticketDetails.selectedAction) {
        case 'Accepted':
          actionDesc = "accepted this report";
          // Map all resolved statuses to Closed in simplified system
          status = 'Closed';
          break;
        case 'Rejected':
          actionDesc = "rejected this report";
          status = 'Closed';
          break;
        case 'Completed':
          actionDesc = "marked this bug as completed";
          // Map all resolved statuses to Closed in simplified system
          status = 'Closed';
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
          // Map all resolved statuses to Closed in simplified system
          status = 'Closed';
          break;
        case 'Reduce':
          actionDesc = ticketDetails.isPermanent 
            ? 'changed the punishment to permanent' 
            : `reduced the punishment to ${ticketDetails.duration?.value || 0} ${ticketDetails.duration?.unit || 'days'}`;
          // Map all resolved statuses to Closed in simplified system
          status = 'Closed';
          break;
        case 'Reject':
          actionDesc = "rejected this appeal";
          status = 'Closed';
          break;
        case 'Close':
          actionDesc = "closed this ticket";
          status = 'Closed';
          break;
        case 'Reopen':
          actionDesc = "reopened this ticket";
          status = 'Open';
          break;
      }
    }
    
    // Only send if there's content or an action selected
    if (messageContent) {
      // Determine if this is a closing message
      const isClosing = ticketDetails.selectedAction && 
                       ticketDetails.selectedAction !== 'Comment' && 
                       ticketDetails.selectedAction !== 'Reopen';
      
      // Create the new message with proper structure
      const newMessage = {
        id: `msg-${Date.now()}`,
        // These map to the server-side schema fields
        name: user?.username || "Admin", // Use Admin as fallback instead of Unknown
        type: "staff",
        content: messageContent,
        created: new Date(),
        staff: true,
        // Add action field to track closing/reopening status
        action: ticketDetails.selectedAction
      };
      
      // Create client-side message for rendering
      const clientMessage: TicketMessage = {
        id: newMessage.id,
        sender: newMessage.name,
        senderType: newMessage.type === 'staff' ? 'staff' : 
                    newMessage.type === 'system' ? 'system' : 'user',
        content: newMessage.content,
        timestamp: timestamp,
        staff: newMessage.staff,
        closedAs: isClosing ? ticketDetails.selectedAction : undefined
      };
      
      // Local state update
      setTicketDetails(prev => ({
        ...prev,
        messages: [...prev.messages, clientMessage],
        newReply: '',
        selectedAction: undefined,
        newDuration: undefined,
        isPermanent: undefined,
        duration: undefined,
        // Only update status if a closing action is sent (not just when clicking an action button)
        status: isClosing ? status : prev.status,
        // Make sure to lock the ticket if it's closed
        locked: isClosing || status === 'Closed' ? true : prev.locked
      }));
      
      // Server update
      updateTicketMutation.mutate({
        id: ticketDetails.id,
        data: {
          status,
          newReply: newMessage,
          locked: isClosing || status === 'Closed' ? true : ticketDetails.locked
        }
      });
    }
  };
  
  const handleUpdateTagsWithPersistence = (tags: string[]) => {
    // Update local state for immediate UI feedback
    setTicketDetails(prev => ({
      ...prev,
      tags,
      newTag: ''
    }));
    
    // Update in database
    updateTicketMutation.mutate({
      id: ticketDetails.id,
      data: { tags }
    });
  };
  
  const handleAddTag = (tag: string) => {
    if (tag.trim() && (!ticketDetails.tags || !ticketDetails.tags.includes(tag.trim()))) {
      const newTags = [...(ticketDetails.tags || []), tag.trim()];
      handleUpdateTagsWithPersistence(newTags);
    }
  };
  
  const handleRemoveTag = (tag: string) => {
    const newTags = (ticketDetails.tags || []).filter(t => t !== tag);
    handleUpdateTagsWithPersistence(newTags);
  };
  
  const handleStatusChange = (newStatus: 'Open' | 'Closed', lockTicket = false) => {
    // First update local state for immediate UI feedback
    setTicketDetails(prev => ({
      ...prev,
      status: newStatus,
      // Auto-lock the ticket when it's closed or explicitly requested
      locked: lockTicket || newStatus === 'Closed' ? true : prev.locked
    }));
    
    // Then update in database
    updateTicketMutation.mutate({
      id: ticketDetails.id,
      data: {
        status: newStatus,
        locked: lockTicket || newStatus === 'Closed' ? true : ticketDetails.locked
      }
    });
  };
  
  const handleTicketAction = (action: string) => {
    // Set selected action
    setTicketDetails(prev => ({
      ...prev,
      selectedAction: action
    }));
    
    // Update status based on action
    let newStatus: 'Open' | 'Closed' = ticketDetails.status;
    
    switch(action) {
      case 'Accepted':
      case 'Completed':
      case 'Pardon':
      case 'Reduce':
      case 'Rejected':
      case 'Stale': 
      case 'Duplicate':
      case 'Reject':
      case 'Close':
        // All resolution actions map to Closed in simplified system
        newStatus = 'Closed';
        break;
      case 'Reopen':
        newStatus = 'Open';
        break;
      case 'Comment':
        // No status change for simple comments
        break;
    }
  
      // Set a default reply based on the action
    if (action === 'Comment') {
      // Clear the text box when switching to Comment action
      setTicketDetails(prev => ({
        ...prev,
        newReply: ''
      }));
    } else if (action) {
      let text = '';
      
      if (action === 'Accepted') {
        text = `This report has been accepted and the player will be dealt with. Thank you for your report.`;
      } else if (action === 'Rejected') {
        text = `After reviewing this report, we have determined that no action is necessary at this time. Thank you for your report.`;
      } else if (action === 'Completed') {
        text = `This bug has been fixed and will be included in the next update. Thank you for your report.`;
      } else if (action === 'Stale') {
        text = `We haven't been able to reproduce this issue. Please provide more details if this persists.`;
      } else if (action === 'Duplicate') {
        text = `This is a duplicate of an existing bug report. We'll keep you updated on the progress.`;
      } else if (action === 'Pardon') {
        text = `After reviewing your appeal, we have decided to pardon your punishment. Thank you for your patience.`;
      } else if (action === 'Reduce') {
        const duration = ticketDetails.isPermanent 
          ? 'permanent' 
          : `${ticketDetails.duration?.value || 14} ${ticketDetails.duration?.unit || 'days'}`;
        text = `After reviewing your appeal, we have decided to reduce your punishment to ${duration}. Thank you for your patience.`;
      } else if (action === 'Reject') {
        text = `After reviewing your appeal, we have decided to uphold the original punishment. Thank you for your understanding.`;
      } else if (action === 'Close') {
        text = `This ticket has been closed. Please create a new ticket if you need further assistance.`;
      } else if (action === 'Reopen') {
        text = `This ticket has been reopened.`;
      }
      
      if (ticketDetails.relatedPlayer && text.includes('{reported-player}')) {
        text = text.replace('{reported-player}', ticketDetails.relatedPlayer);
      }
      
      if (text) {
        setTicketDetails(prev => ({
          ...prev,
          newReply: text
        }));
      }
    }
  };

  return (
    <PageContainer>
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between w-full">
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-1" 
            onClick={() => setLocation('/panel/tickets')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Tickets
          </Button>
          
          {ticketDetails.id && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Share with player:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center">
                    <Link2 className="w-4 h-4 mr-2" />
                    Share Link
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-3 w-auto">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Player can use this link to view and reply to the ticket:</p>
                    <div className="flex items-center">
                      <input 
                        type="text" 
                        readOnly 
                        value={`${window.location.origin}/player-ticket/${ticketDetails.id}`}
                        className="text-xs p-2 bg-muted rounded border border-border flex-1 mr-2"
                      />
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/player-ticket/${ticketDetails.id}`);
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
        
        {isLoading && (
          <div className="flex justify-center items-center py-20">
            <div className="flex flex-col items-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-sm text-muted-foreground">Loading ticket details...</p>
            </div>
          </div>
        )}
        
        {isError && (
          <div className="flex justify-center items-center py-20">
            <div className="flex flex-col items-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <h3 className="mt-2 text-lg font-medium">Failed to load ticket</h3>
              <p className="text-sm text-muted-foreground">
                We couldn't load the ticket details. Please try again later.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                Try Again
              </Button>
            </div>
          </div>
        )}
        
        {!isLoading && !isError && !ticketData && (
          <div className="flex justify-center items-center py-20">
            <div className="flex flex-col items-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
              <h3 className="mt-2 text-lg font-medium">Ticket not found</h3>
              <p className="text-sm text-muted-foreground">
                The ticket with ID "{ticketId}" could not be found.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={() => setLocation('/panel/tickets')}
              >
                Back to Tickets
              </Button>
            </div>
          </div>
        )}
        
        {!isLoading && !isError && ticketData && (
          <>
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

            <div className="bg-background-lighter p-6 rounded-lg">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-medium">{ticketDetails.subject}</h2>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {/* Ticket Category Badge with distinct styling based on type */}
                      <Badge variant="outline" className={
                        ticketDetails.category === 'Bug Report' ? 'bg-red-50 text-red-700 border-red-200' : 
                        ticketDetails.category === 'Player Report' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                        ticketDetails.category === 'Punishment Appeal' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        'bg-blue-50 text-blue-700 border-blue-200'
                      }>
                        {ticketDetails.category}
                      </Badge>
                      
                      {/* Simple Status Badge - Only Open or Closed */}
                      <Badge variant="outline" className={
                        ticketDetails.status === 'Open' ? 
                          'bg-green-50 text-green-700 border-green-200' : 
                          'bg-gray-50 text-gray-700 border-gray-200'
                      }>
                        {ticketDetails.status === 'Open' ? 'Open' : 'Closed'}
                      </Badge>
                      
                      {/* Display the tags */}
                      {ticketDetails.tags && ticketDetails.tags.map((tag, index) => (
                        <Badge key={index} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 py-1">
                          {tag}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-4 w-4 rounded-full hover:bg-blue-100 ml-1 p-0" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveTag(tag);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                      
                      {/* Tag add button */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-6 px-2 py-1 text-xs rounded-full gap-1 bg-background">
                            <Tag className="h-3 w-3" />
                            <Plus className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3" align="start">
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Add Tag</h4>
                            <div className="flex items-center space-x-2">
                              <input
                                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="New tag"
                                value={ticketDetails.newTag || ''}
                                onChange={(e) => 
                                  setTicketDetails(prev => ({
                                    ...prev,
                                    newTag: e.target.value
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && ticketDetails.newTag?.trim()) {
                                    handleAddTag(ticketDetails.newTag);
                                  }
                                }}
                              />
                              <Button 
                                size="sm"
                                onClick={() => {
                                  if (ticketDetails.newTag?.trim()) {
                                    handleAddTag(ticketDetails.newTag);
                                  }
                                }}
                                disabled={!ticketDetails.newTag?.trim()}
                              >
                                Add
                              </Button>
                            </div>
                            <div className="mt-2">
                              <h5 className="text-xs text-muted-foreground mb-1">Suggested tags:</h5>
                              <div className="flex flex-wrap gap-1">
                                {getDefaultTagsForCategory(ticketDetails.category).map((tag, idx) => (
                                  <Badge 
                                    key={idx} 
                                    variant="outline" 
                                    className="cursor-pointer bg-muted/20 hover:bg-muted/40"
                                    onClick={() => {
                                      if (!ticketDetails.tags?.includes(tag)) {
                                        handleAddTag(tag);
                                      }
                                    }}
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 mt-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Reported By:</span>
                    <span className="ml-1">{ticketDetails.reportedBy}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date:</span>
                    <span className="ml-1">{formatDate(ticketDetails.date)}</span>
                  </div>
                  {/* Removed assignedTo field as part of simplified ticket system */}
                  {ticketDetails.relatedPlayer && (
                    <div className="flex items-center">
                      <span className="text-muted-foreground">Related Player:</span>
                      <span 
                        className="ml-1 cursor-pointer hover:underline"
                        onClick={() => setIsPlayerWindowOpen(true)}
                      >
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

            <div className="bg-background-lighter p-4 rounded-lg">
              <div className="flex gap-2 mb-4">
                <Button 
                  variant={activeTab === 'conversation' ? 'default' : 'outline'} 
                  onClick={() => setActiveTab('conversation')}
                  className="rounded-md"
                  size="sm"
                >
                  <MessageSquare className="h-4 w-4 mr-1.5" />
                  Conversation
                </Button>
                <Button 
                  variant={activeTab === 'notes' ? 'default' : 'outline'} 
                  onClick={() => setActiveTab('notes')}
                  className="rounded-md"
                  size="sm"
                >
                  <StickyNote className="h-4 w-4 mr-1.5" />
                  Staff Notes
                </Button>
              </div>
              
              {activeTab === 'conversation' && (
                <div className="space-y-4">
                  <div className="space-y-4 mb-5 max-h-[480px] overflow-y-auto p-2">
                    {ticketDetails.messages.map((message) => (
                      <div 
                        key={message.id} 
                        className={`flex gap-3 ${message.senderType === 'user' ? '' : 'bg-muted/20 p-3 rounded-md'}`}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className={
                            message.senderType === 'user' 
                              ? 'bg-primary/10 text-primary' 
                              : message.senderType === 'staff' || message.staff
                                ? 'bg-success/10 text-success' 
                                : 'bg-muted text-muted-foreground'
                          }>
                            {message.senderType === 'system' ? 'SYS' : 
                              message.sender && typeof message.sender === 'string' && message.sender !== 'user' 
                                ? message.sender.substring(0, 2).toUpperCase() 
                                : message.senderType === 'staff' || message.staff 
                                  ? 'ST' 
                                  : 'US'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between">
                            <div className="font-medium text-sm flex items-center">
                              <>{message.sender && message.sender !== 'user' ? message.sender : (message.senderType === 'staff' ? 'Staff' : message.senderType === 'system' ? 'System' : 'User')}</>
                              {(message.senderType === 'staff' || message.staff) && (
                                <Badge variant="outline" className="ml-2 text-xs bg-success/10 text-success border-success/20">
                                  Staff
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">{formatDate(message.timestamp) || formatDate(new Date().toISOString())}</span>
                          </div>
                          {/* If this message has a closedAs status, show the ticket closing info */}
                          {(message.closedAs && message.closedAs !== "Comment" && message.closedAs !== "Reopen") ? (
                            <>
                              <div className="text-sm mt-1 flex items-center">
                                <span className="font-medium text-muted-foreground">Ticket closed as {message.closedAs}</span>
                                
                              </div>
                              <p className="text-sm mt-1 whitespace-pre-wrap">
                                {message.content}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm mt-1 whitespace-pre-wrap">
                              {message.content}
                            </p>
                          )}

                          {/* Show attachments if any */}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {message.attachments.map((attachment, idx) => (
                                <div key={idx} className="border rounded-md p-1 flex items-center gap-1.5 text-xs bg-muted/30">
                                  <Link2 className="h-3 w-3" />
                                  <span className="text-blue-600">{attachment}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Reply section - only shown if ticket is not locked */}
                  {!ticketDetails.locked ? (
                    <div className="border rounded-md p-3">
                      <div className="flex justify-between mb-3">
                        <div className="flex gap-2">
                          <Button 
                            variant={ticketDetails.selectedAction === 'Comment' ? 'default' : 'outline'} 
                            size="sm"
                            onClick={() => handleTicketAction('Comment')}
                            className="rounded-md"
                          >
                            Comment
                          </Button>
                          
                          {/* Actions based on ticket category */}
                          {ticketDetails.category === 'Player Report' && (
                            <>
                              <Button 
                                variant={ticketDetails.selectedAction === 'Accepted' ? 'default' : 'outline'} 
                                size="sm"
                                onClick={() => handleTicketAction('Accepted')}
                                className="rounded-md"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                Accept
                              </Button>
                              <Button 
                                variant={ticketDetails.selectedAction === 'Rejected' ? 'default' : 'outline'} 
                                size="sm"
                                onClick={() => handleTicketAction('Rejected')}
                                className="rounded-md"
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                                Reject
                              </Button>
                            </>
                          )}
                          
                          {ticketDetails.category === 'Bug Report' && (
                            <>
                              <Button 
                                variant={ticketDetails.selectedAction === 'Completed' ? 'default' : 'outline'} 
                                size="sm"
                                onClick={() => handleTicketAction('Completed')}
                                className="rounded-md"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                Completed
                              </Button>
                              <Button 
                                variant={ticketDetails.selectedAction === 'Stale' ? 'default' : 'outline'} 
                                size="sm"
                                onClick={() => handleTicketAction('Stale')}
                                className="rounded-md"
                              >
                                <Clock className="h-3.5 w-3.5 mr-1.5" />
                                Stale
                              </Button>
                              <Button 
                                variant={ticketDetails.selectedAction === 'Duplicate' ? 'default' : 'outline'} 
                                size="sm"
                                onClick={() => handleTicketAction('Duplicate')}
                                className="rounded-md"
                              >
                                <FileText className="h-3.5 w-3.5 mr-1.5" />
                                Duplicate
                              </Button>
                            </>
                          )}
                          
                          {ticketDetails.category === 'Punishment Appeal' && (
                            <>
                              <Button 
                                variant={ticketDetails.selectedAction === 'Pardon' ? 'default' : 'outline'} 
                                size="sm"
                                onClick={() => handleTicketAction('Pardon')}
                                className="rounded-md"
                              >
                                <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
                                Pardon
                              </Button>
                              <Button 
                                variant={ticketDetails.selectedAction === 'Reduce' ? 'default' : 'outline'} 
                                size="sm"
                                onClick={() => handleTicketAction('Reduce')}
                                className="rounded-md"
                              >
                                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                                Reduce
                              </Button>
                              <Button 
                                variant={ticketDetails.selectedAction === 'Reject' ? 'default' : 'outline'} 
                                size="sm"
                                onClick={() => handleTicketAction('Reject')}
                                className="rounded-md"
                              >
                                <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />
                                Reject
                              </Button>
                            </>
                          )}
                          
                          {/* Close button for all types */}
                          <Button 
                            variant={ticketDetails.selectedAction === 'Close' ? 'default' : 'outline'} 
                            size="sm"
                            onClick={() => handleTicketAction('Close')}
                            className="rounded-md"
                          >
                            <LockIcon className="h-3.5 w-3.5 mr-1.5" />
                            Close
                          </Button>
                        </div>
                      </div>
                      
                      {/* Additional options for Reduce action */}
                      {ticketDetails.selectedAction === 'Reduce' && (
                        <div className="mb-3 p-3 border rounded-md bg-muted/10">
                          <div className="flex items-center mb-2">
                            <Checkbox 
                              id="permanent"
                              checked={ticketDetails.isPermanent}
                              onCheckedChange={(checked) => {
                                setTicketDetails(prev => ({
                                  ...prev,
                                  isPermanent: checked === true
                                }));
                              }}
                            />
                            <label htmlFor="permanent" className="ml-2 text-sm font-medium">
                              Permanent Ban
                            </label>
                          </div>
                          
                          {!ticketDetails.isPermanent && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-muted-foreground">Duration</label>
                                <input 
                                  type="number" 
                                  className="w-full mt-1 h-8 rounded-md border border-input bg-background px-3 py-1 text-sm"
                                  value={ticketDetails.duration?.value || ''}
                                  onChange={(e) => {                                    const value = parseInt(e.target.value) || 0;
                                    setTicketDetails(prev => ({
                                      ...prev,
                                      duration: {
                                        ...prev.duration,
                                        value
                                      }
                                    }));
                                  }}
                                  min={1}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Unit</label>
                                <select 
                                  className="w-full mt-1 h-8 rounded-md border border-input bg-background px-3 py-1 text-sm"
                                  value={ticketDetails.duration?.unit || 'days'}
                                  onChange={(e) => {
                                    setTicketDetails(prev => ({
                                      ...prev,
                                      duration: {
                                        ...prev.duration,
                                        unit: e.target.value as 'hours' | 'days' | 'weeks' | 'months'
                                      }
                                    }));
                                  }}
                                >
                                  <option value="hours">Hours</option>
                                  <option value="days">Days</option>
                                  <option value="weeks">Weeks</option>
                                  <option value="months">Months</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="relative">
                        <textarea
                          className="min-h-[120px] w-full resize-none rounded-lg border border-input bg-background p-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          placeholder={getPlaceholderText()}
                          value={ticketDetails.newReply || ''}
                          onChange={(e) => {
                            setTicketDetails(prev => ({
                              ...prev,
                              newReply: e.target.value
                            }));
                          }}
                        />
                        <Button 
                          size="sm" 
                          className="absolute bottom-3 right-3" 
                          onClick={handleSendReply}
                          disabled={!ticketDetails.newReply?.trim() && !ticketDetails.selectedAction}
                        >
                          <Send className="h-4 w-4 mr-1.5" />
                          Send
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="border rounded-md p-4 bg-muted/10 space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <LockIcon className="h-4 w-4 text-muted-foreground mr-2" />
                          <span className="text-sm text-muted-foreground">This ticket is locked and cannot be replied to.</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Reopening message:</label>
                        <textarea
                          className="min-h-[80px] w-full resize-none rounded-lg border border-input bg-background p-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          placeholder="Type your reply/reason for reopening this ticket..."
                          value={ticketDetails.newReply}
                          onChange={(e) => {
                            setTicketDetails(prev => ({
                              ...prev,
                              newReply: e.target.value
                            }));
                          }}
                        />
                        
                        <div className="flex justify-end">
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => {
                              // Set action to Reopen
                              if (!ticketDetails.newReply) {
                                setTicketDetails(prev => ({
                                  ...prev,
                                  newReply: 'This ticket has been reopened for further review.'
                                }));
                              }
                              
                              // Create the server-side reopen message
                              const newMessage = {
                                id: `msg-${Date.now()}`,
                                name: user?.username || 'Staff', // Use the current staff member's name
                                type: 'staff',
                                content: ticketDetails.newReply || 'This ticket has been reopened for further review.',
                                created: new Date(),
                                staff: true,
                                action: 'Reopen' // Add action field to track reopening
                              };
                              
                              // Create the client-side message for immediate display
                              const clientMessage: TicketMessage = {
                                id: newMessage.id,
                                sender: newMessage.name,
                                senderType: 'staff',
                                content: newMessage.content,
                                timestamp: new Date().toISOString(),
                                staff: true
                              };
                              
                              // Update local state
                              setTicketDetails(prev => ({
                                ...prev,
                                locked: false,
                                status: 'Open',
                                messages: [...prev.messages, clientMessage],
                                newReply: ''
                              }));
                              
                              // Update in database
                              updateTicketMutation.mutate({
                                id: ticketDetails.id,
                                data: {
                                  locked: false,
                                  status: 'Open',
                                  newReply: newMessage
                                }
                              }, {
                                onSuccess: () => {
                                  // Force refresh of the ticket list
                                  queryClient.invalidateQueries({ queryKey: ['/api/panel/tickets'] });
                                }
                              });
                            }}
                          >
                            <UnlockIcon className="h-4 w-4 mr-2" />
                            Reopen & Reply
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'notes' && (
                <div className="space-y-4">
                  <div className="space-y-4 mb-5 max-h-[480px] overflow-y-auto p-2">
                    {ticketDetails.notes.map((note, idx) => (
                      <div key={idx} className="bg-muted/20 p-3 rounded-md">
                        <div className="flex justify-between">
                          <span className="font-medium text-sm">{note.author}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(note.date)}</span>
                        </div>
                        <p className="text-sm mt-1.5">{note.content}</p>
                      </div>
                    ))}

                    {ticketDetails.notes.length === 0 && (
                      <div className="text-center py-8">
                        <StickyNote className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
                        <p className="mt-2 text-sm text-muted-foreground">No staff notes yet</p>
                      </div>
                    )}
                  </div>
                  
                  {ticketDetails.isAddingNote ? (
                    <div className="border rounded-md p-3">
                      <textarea
                        className="min-h-[120px] w-full resize-none rounded-lg border border-input bg-background p-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mb-3"
                        placeholder="Add a private staff note here..."
                        value={ticketDetails.newNote || ''}
                        onChange={(e) => {
                          setTicketDetails(prev => ({
                            ...prev,
                            newNote: e.target.value
                          }));
                        }}
                      />
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setTicketDetails(prev => ({
                              ...prev,
                              isAddingNote: false,
                              newNote: ''
                            }));
                          }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={handleAddNote}
                          disabled={!ticketDetails.newNote?.trim()}
                        >
                          <StickyNote className="h-4 w-4 mr-1.5" />
                          Add Note
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setTicketDetails(prev => ({
                          ...prev,
                          isAddingNote: true
                        }));
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add Staff Note
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
};

export default TicketDetail;