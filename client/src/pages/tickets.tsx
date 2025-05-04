import { useState } from 'react';
import { useLocation } from 'wouter';
import { 
  Bug, 
  Users, 
  MessageSquare, 
  LockKeyhole, 
  Filter, 
  Eye,
  Loader2
} from 'lucide-react';

// Format date to MM/dd/yy HH:mm in browser's timezone
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (e) {
    return dateString; // Return original string if formatting fails
  }
};
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSidebar } from '@/hooks/use-sidebar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTickets } from '@/hooks/use-data';
import PageContainer from '@/components/layout/PageContainer';

// Define the Ticket interface to match the MongoDB schema
interface Ticket {
  _id?: string;
  id: string;
  type: 'bug' | 'player' | 'chat' | 'appeal' | 'staff' | 'support';
  subject: string;
  reportedBy: string;
  date: string;
  status: 'Unfinished' | 'Open' | 'Closed';
  locked?: boolean;
  description?: string;
  notes?: Array<{
    author: string;
    content: string;
    timestamp: string;
    isStaffOnly: boolean;
  }>;
}

// Generate a badge color and text based on ticket status
const getTicketStatusInfo = (ticket: Ticket) => {
  // Use simplified status system - only Open or Closed
  const isOpen = !ticket.locked;
                  
  const statusClass = isOpen
    ? 'bg-green-50 text-green-700 border-green-200'
    : 'bg-red-50 text-red-700 border-red-200';
    
  const statusText = isOpen ? 'Open' : 'Closed';
  
  return { statusClass, statusText, isOpen };
};

const Tickets = () => {
  const { } = useSidebar(); // We're not using sidebar context in this component
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("bug");
  const [, setLocation] = useLocation();
  const { data: tickets, isLoading, error } = useTickets();
  
  // More generous left margin to prevent text overlap with sidebar
  const mainContentClass = "ml-[32px] pl-8";

  // Convert ticket status to simplified Open/Closed
  const getSimplifiedStatus = (ticket: Ticket): 'open' | 'closed' => {
    // Using simplified status system - if it's not Open or it's locked, it's closed
    if (ticket.status === 'Closed' || ticket.locked === true) {
      return 'closed';
    }
    return 'open';
  };
  
  // Filter tickets by type and simplified status
  const filteredTickets = tickets ? tickets.filter((ticket: Ticket) => {
    // Skip "Unfinished" tickets entirely - they should only appear in their creation flow
    if (ticket.status === 'Unfinished') {
      return false;
    }
    
    const typeMatch = ticket.type === activeTab;
    const simplifiedStatus = getSimplifiedStatus(ticket);
    const statusMatch = statusFilter === "all" || simplifiedStatus === statusFilter;
    return typeMatch && statusMatch;
  }) : [];
  
  const handleNavigateToTicket = (ticketId: string) => {
    // Navigate to the ticket detail page
    console.log('Navigating to ticket:', ticketId);
    
    // Remove any characters that might cause issues in the URL
    // Replace # with "ID-" to avoid hash confusion in the URL
    const safeTicketId = ticketId.replace('#', 'ID-');
    console.log('Safe ticket ID for URL:', safeTicketId);
    
    // Add a small delay to make sure the navigation occurs
    setTimeout(() => {
      setLocation(`/tickets/${safeTicketId}`);
    }, 50);
  };

  // Render a single ticket row
  const renderTicketRow = (ticket: Ticket, index: number) => (
    <TableRow key={index} className="border-b border-border">
      <TableCell>{ticket.id}</TableCell>
      <TableCell className="font-medium">
        {ticket.subject}
        <div className="flex flex-wrap gap-1.5 mt-1">
          <Badge 
            variant="outline" 
            className={`text-xs px-1.5 py-0 h-5 ${getTicketStatusInfo(ticket).statusClass}`}
          >
            {getTicketStatusInfo(ticket).statusText}
          </Badge>
        </div>
      </TableCell>
      <TableCell>{ticket.reportedBy}</TableCell>
      <TableCell>{formatDate(ticket.date)}</TableCell>
      <TableCell>Recent</TableCell>
      <TableCell>
        <div className="flex space-x-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="View" onClick={() => handleNavigateToTicket(ticket.id)}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  // Render a loading row
  const renderLoadingRow = () => (
    <TableRow>
      <TableCell colSpan={6} className="text-center py-6">
        <div className="flex justify-center items-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
          <span className="text-muted-foreground">Loading tickets...</span>
        </div>
      </TableCell>
    </TableRow>
  );

  // Render an empty table message
  const renderEmptyRow = () => (
    <TableRow>
      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
        No tickets match your current filters.
      </TableCell>
    </TableRow>
  );

  // Render ticket table content based on loading state and data
  const renderTicketTableContent = () => {
    if (isLoading) {
      return renderLoadingRow();
    }
    
    if (filteredTickets.length > 0) {
      return filteredTickets.map((ticket: Ticket, index: number) => renderTicketRow(ticket, index));
    }
    
    return renderEmptyRow();
  };

  // Render table with header and content
  const renderTicketTable = () => (
    <Table>
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="rounded-l-lg">ID</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Reported By</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Last Reply</TableHead>
          <TableHead className="rounded-r-lg">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {renderTicketTableContent()}
      </TableBody>
    </Table>
  );

  // Render pagination controls
  const renderPagination = () => (
    <div className="flex justify-between items-center pt-4">
      <div className="text-sm text-muted-foreground">
        Showing {filteredTickets.length} of {tickets ? tickets.filter((t: Ticket) => t.type === activeTab).length : 0} entries
      </div>
      <div className="flex space-x-1">
        <Button variant="outline" size="sm" className="px-3 py-1 text-muted-foreground">
          &lt;
        </Button>
        <Button variant="default" size="sm" className="px-3 py-1">
          1
        </Button>
        <Button variant="outline" size="sm" className="px-3 py-1 text-muted-foreground">
          2
        </Button>
        <Button variant="outline" size="sm" className="px-3 py-1 text-muted-foreground">
          3
        </Button>
        <Button variant="outline" size="sm" className="px-3 py-1 text-muted-foreground">
          &gt;
        </Button>
      </div>
    </div>
  );

  return (
    <PageContainer>
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Tickets</h2>
          <div className="flex space-x-2 items-center">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" /> Filter
            </Button>
            <Select defaultValue="all" onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-background border border-border text-sm">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Card>
          <CardHeader className="p-0">
            <Tabs defaultValue="bug" className="w-full" onValueChange={setActiveTab}>
              <div className="overflow-x-auto pb-1 border-b border-border">
                <TabsList className="w-max flex rounded-none bg-transparent">
                <TabsTrigger 
                  value="bug" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-2 py-0.5 flex-shrink-0 text-sm"
                >
                  <Bug className="h-4 w-4 mr-2" />
                  Bug Reports
                  <Badge className="ml-2 bg-primary text-white">{tickets ? tickets.filter((t: Ticket) => t.type === 'bug').length : 0}</Badge>
                </TabsTrigger>
                <TabsTrigger 
                  value="player" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-3 py-0.5 flex-shrink-0 text-sm"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Player Reports
                  <Badge className="ml-2 bg-destructive text-white">{tickets ? tickets.filter((t: Ticket) => t.type === 'player').length : 0}</Badge>
                </TabsTrigger>
                <TabsTrigger 
                  value="chat" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-3 py-0.5 flex-shrink-0 text-sm"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat Reports
                  <Badge className="ml-2 bg-warning text-white">{tickets ? tickets.filter((t: Ticket) => t.type === 'chat').length : 0}</Badge>
                </TabsTrigger>
                <TabsTrigger 
                  value="appeal" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-3 py-0.5 flex-shrink-0 text-sm"
                >
                  <LockKeyhole className="h-4 w-4 mr-2" />
                  Ban Appeals
                  <Badge className="ml-2 bg-info text-white">{tickets ? tickets.filter((t: Ticket) => t.type === 'appeal').length : 0}</Badge>
                </TabsTrigger>
                <TabsTrigger 
                  value="staff" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-3 py-0.5 flex-shrink-0 text-sm"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Staff Applications
                  <Badge className="ml-2 bg-primary text-white">{tickets ? tickets.filter((t: Ticket) => t.type === 'staff').length : 0}</Badge>
                </TabsTrigger>
                <TabsTrigger 
                  value="support" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-3 py-0.5 flex-shrink-0 text-sm"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Support
                  <Badge className="ml-2 bg-info text-white">{tickets ? tickets.filter((t: Ticket) => t.type === 'support').length : 0}</Badge>
                </TabsTrigger>
              </TabsList>
              </div>
              
              <TabsContent value="bug" className="p-0 mt-0">
                <CardContent className="p-4">
                  {renderTicketTable()}
                  {renderPagination()}
                </CardContent>
              </TabsContent>
              
              <TabsContent value="player" className="p-0 mt-0">
                <CardContent className="p-4">
                  {renderTicketTable()}
                </CardContent>
              </TabsContent>
              
              <TabsContent value="chat" className="p-0 mt-0">
                <CardContent className="p-4">
                  {renderTicketTable()}
                </CardContent>
              </TabsContent>
              
              <TabsContent value="appeal" className="p-0 mt-0">
                <CardContent className="p-4">
                  {renderTicketTable()}
                </CardContent>
              </TabsContent>
              
              <TabsContent value="staff" className="p-0 mt-0">
                <CardContent className="p-4">
                  {renderTicketTable()}
                </CardContent>
              </TabsContent>
              
              <TabsContent value="support" className="p-0 mt-0">
                <CardContent className="p-4">
                  {renderTicketTable()}
                </CardContent>
              </TabsContent>
            </Tabs>
          </CardHeader>
        </Card>
      </div>
    </PageContainer>
  );
};

export default Tickets;