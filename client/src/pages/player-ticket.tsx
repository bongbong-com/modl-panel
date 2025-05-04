import { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import {
  MessageSquare,
  User,
  Calendar,
  Clock,
  Send,
  ArrowLeft,
  Loader2,
  Tag,
  Link2,
  Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTicket, useUpdateTicket } from '@/hooks/use-data';
import { queryClient } from '@/lib/queryClient';

export interface TicketMessage {
  id: string;
  sender: string;
  senderType: 'user' | 'staff' | 'system';
  content: string;
  timestamp: string;
  staff?: boolean;
  attachments?: string[];
  closedAs?: string;
}

interface TicketDetails {
  id: string;
  subject: string;
  status: 'Open' | 'Closed';
  reportedBy: string;
  date: string;
  category: string;
  messages: TicketMessage[];
  locked?: boolean;
}

const PlayerTicket = () => {
  const { id } = useParams();
  const [playerName, setPlayerName] = useState('');
  const [newReply, setNewReply] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Use React Query to fetch ticket data
  const { data: ticketData, isLoading, isError } = useTicket(id || '');
  
  // Mutation hook for updating tickets
  const updateTicketMutation = useUpdateTicket();
  
  const [ticketDetails, setTicketDetails] = useState<TicketDetails>({
    id: "",
    subject: "",
    status: "Open",
    reportedBy: "",
    date: "",
    category: "Player Report",
    messages: []
  });

  const statusColors = {
    'Open': 'bg-green-50 text-green-700 border-green-200', 
    'Closed': 'bg-gray-50 text-gray-700 border-gray-200'
  };

  // Initialize player name from localStorage if available
  useEffect(() => {
    const savedName = localStorage.getItem('playerName');
    if (savedName) {
      setPlayerName(savedName);
    }
  }, []);

  // Update ticket details when data is fetched
  useEffect(() => {
    if (ticketData) {
      console.log('Received ticket data:', ticketData);
      
      // Map API data to our TicketDetails interface with simplified status
      const status = ticketData.status || 'Open';
      // Convert status to either Open or Closed
      const simplifiedStatus = 
        (status === 'Open' || status === 'In Progress') 
          ? 'Open' 
          : 'Closed';
          
      setTicketDetails({
        id: ticketData.id || ticketData._id,
        subject: ticketData.subject || 'No Subject',
        status: simplifiedStatus,
        reportedBy: ticketData.reportedBy || 'Unknown',
        date: ticketData.date || new Date().toLocaleDateString(),
        category: ticketData.category || 'Other',
        messages: (ticketData.messages || []),
        locked: ticketData.locked === true
      });
      
      // If reportedBy is set, use it as the default playerName
      if (ticketData.reportedBy && !playerName) {
        setPlayerName(ticketData.reportedBy);
        localStorage.setItem('playerName', ticketData.reportedBy);
      }
    }
  }, [ticketData, playerName]);

  const handleSendReply = async () => {
    if (!newReply.trim() || !playerName.trim()) return;
    
    setIsSubmitting(true);
    
    // Generate a temporary ID for optimistic UI
    const tempId = Date.now().toString();
    const timestamp = new Date().toISOString();
    
    // Create new message for immediate display
    const newMessage: TicketMessage = {
      id: tempId,
      sender: playerName,
      senderType: 'user',
      content: newReply.trim(),
      timestamp: new Date().toLocaleString(),
      staff: false
    };
    
    // Update UI immediately with the new message
    setTicketDetails(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage]
    }));
    
    // Format the new reply for the API
    const reply = {
      name: playerName,
      type: 'user',
      content: newReply.trim(),
      created: timestamp,
      staff: false
    };
    
    // Clear the reply field
    setNewReply('');
    
    // Save player name to localStorage for future use
    localStorage.setItem('playerName', playerName);
    
    try {
      // Send the update to the API
      await updateTicketMutation.mutateAsync({
        id: ticketDetails.id,
        data: {
          newReply: reply
        }
      });
      
      // Manually invalidate the cache for background refresh
      queryClient.invalidateQueries({ queryKey: ['/api/tickets', ticketDetails.id] });
    } catch (error) {
      console.error('Error sending reply:', error);
      // If there was an error, we could show a toast message here
      // and potentially remove the optimistic update
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading ticket information...</p>
      </div>
    );
  }

  if (isError || !ticketData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-destructive/10 text-destructive rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-semibold mb-2">Ticket Not Found</h2>
          <p className="mb-4">Sorry, we couldn't find the ticket you're looking for. It may have been deleted or you may not have permission to view it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden mb-6">
          <div className="p-4 bg-muted/30">
            <div className="flex justify-between items-start">
              <h1 className="text-xl font-semibold">{ticketDetails.subject}</h1>
              <div className="flex gap-2">
                <Badge variant="outline" className="border-border bg-background flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {ticketDetails.category}
                </Badge>
                <Badge className={`text-xs px-2 py-1 font-medium border ${statusColors[ticketDetails.status]}`}>
                  {ticketDetails.status}
                </Badge>
              </div>
            </div>
            <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                <span>Created by {ticketDetails.reportedBy}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>{new Date(ticketDetails.date).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{ticketDetails.messages.length} messages</span>
              </div>
            </div>
          </div>

          {/* Messages section */}
          <div className="p-4 max-h-[600px] overflow-y-auto">
            {ticketDetails.messages.length > 0 ? (
              <div className="flex flex-col gap-4">
                {ticketDetails.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.senderType === 'staff' || message.staff
                        ? 'bg-primary/5 p-3 rounded-lg'
                        : message.senderType === 'system'
                        ? 'bg-muted/20 p-3 rounded-lg italic text-muted-foreground'
                        : ''
                    }`}
                  >
                    <Avatar className={message.senderType === 'system' ? 'bg-muted border-muted-foreground/20' : message.senderType === 'staff' || message.staff ? 'bg-primary/20 border-primary' : 'bg-muted border-muted-foreground/50'}>
                      <AvatarFallback>
                        {message.senderType === 'system' 
                          ? 'SYS' 
                          : message.sender 
                            ? message.sender.substring(0, 2).toUpperCase() 
                            : 'UN'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <div className="font-medium flex items-center gap-2">
                          {message.sender}
                          {(message.senderType === 'staff' || message.staff) && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] py-0 h-4">
                              Staff
                            </Badge>
                          )}
                          {message.closedAs && (
                            <Badge variant="outline" className="bg-muted text-muted-foreground border-muted/50 text-[10px] py-0 h-4">
                              {message.closedAs}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {message.timestamp}
                        </div>
                      </div>
                      <div className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No messages yet.
              </div>
            )}
          </div>
        </div>

        {/* Reply section */}
        {!ticketDetails.locked ? (
          <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
            <div className="p-4">
              <div className="mb-4">
                <Textarea
                  placeholder="Type your reply here..."
                  className="min-h-[120px]"
                  value={newReply}
                  onChange={(e) => setNewReply(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex justify-end">
                <Button 
                  onClick={handleSendReply} 
                  disabled={!newReply.trim() || !playerName.trim() || isSubmitting}
                  className="flex items-center"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Reply
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-muted/30 rounded-lg p-4 text-center text-muted-foreground border border-border">
            <p>This ticket is locked and no further replies can be sent.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerTicket;