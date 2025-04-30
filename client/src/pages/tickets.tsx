import { useState } from 'react';
import { useLocation } from 'wouter';
import { 
  Bug, 
  Users, 
  MessageSquare, 
  LockKeyhole, 
  Filter, 
  Eye, 
  UserPlus, 
  Check,
  RefreshCcw,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSidebar } from '@/hooks/use-sidebar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { tickets } from '@/data/mockData';
import PageContainer from '@/components/layout/PageContainer';

const Tickets = () => {
  const { } = useSidebar(); // We're not using sidebar context in this component
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("bug");
  const [, setLocation] = useLocation();
  
  // More generous left margin to prevent text overlap with sidebar
  const mainContentClass = "ml-[32px] pl-8";

  // Filter tickets by type and status
  const filteredTickets = tickets.filter(ticket => {
    const typeMatch = ticket.type === activeTab;
    const statusMatch = statusFilter === "all" || ticket.status.toLowerCase() === statusFilter;
    return typeMatch && statusMatch;
  });
  
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

  return (
    <PageContainer>
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Tickets</h2>
          <div className="flex space-x-2">
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
                <SelectItem value="in progress">In Progress</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Card>
          <CardHeader className="p-0">
            <Tabs defaultValue="bug" className="w-full" onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start rounded-none bg-transparent border-b border-border overflow-x-auto">
                <TabsTrigger 
                  value="bug" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-3"
                >
                  <Bug className="h-4 w-4 mr-2" />
                  Bug Reports
                  <Badge className="ml-2 bg-primary text-white">{tickets.filter(t => t.type === 'bug').length}</Badge>
                </TabsTrigger>
                <TabsTrigger 
                  value="player" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-3"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Player Reports
                  <Badge className="ml-2 bg-destructive text-white">{tickets.filter(t => t.type === 'player').length}</Badge>
                </TabsTrigger>
                <TabsTrigger 
                  value="chat" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-3"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat Reports
                  <Badge className="ml-2 bg-warning text-white">{tickets.filter(t => t.type === 'chat').length}</Badge>
                </TabsTrigger>
                <TabsTrigger 
                  value="appeal" 
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-3"
                >
                  <LockKeyhole className="h-4 w-4 mr-2" />
                  Ban Appeals
                  <Badge className="ml-2 bg-info text-white">{tickets.filter(t => t.type === 'appeal').length}</Badge>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="bug" className="p-0 mt-0">
                <CardContent className="p-4">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="rounded-l-lg">ID</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Reported By</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="rounded-r-lg">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTickets.length > 0 ? (
                        filteredTickets.map((ticket, index) => (
                          <TableRow key={index} className="border-b border-border">
                            <TableCell>{ticket.id}</TableCell>
                            <TableCell className="font-medium">{ticket.subject}</TableCell>
                            <TableCell>{ticket.reportedBy}</TableCell>
                            <TableCell>{ticket.date}</TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={`
                                  ${ticket.priority === 'Critical' ? 'bg-destructive/10 text-destructive border-destructive/20' : 
                                    ticket.priority === 'Medium' ? 'bg-warning/10 text-warning border-warning/20' : 
                                    ticket.priority === 'Low' ? 'bg-info/10 text-info border-info/20' :
                                    'bg-success/10 text-success border-success/20'
                                  }
                                `}
                              >
                                {ticket.status === 'Fixed' ? ticket.status : ticket.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="View" onClick={() => handleNavigateToTicket(ticket.id)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {ticket.status !== 'Fixed' ? (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-info" title="Assign">
                                      <UserPlus className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-success" title="Mark Resolved">
                                      <Check className="h-4 w-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Re-open">
                                      <RefreshCcw className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Delete">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                            No tickets match your current filters.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  
                  <div className="flex justify-between items-center pt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {filteredTickets.length} of {tickets.filter(t => t.type === activeTab).length} entries
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
                </CardContent>
              </TabsContent>
              
              <TabsContent value="player" className="p-0 mt-0">
                <CardContent className="p-4">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="rounded-l-lg">ID</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Reported By</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="rounded-r-lg">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTickets.length > 0 ? (
                        filteredTickets.map((ticket, index) => (
                          <TableRow key={index} className="border-b border-border">
                            <TableCell>{ticket.id}</TableCell>
                            <TableCell className="font-medium">{ticket.subject}</TableCell>
                            <TableCell>{ticket.reportedBy}</TableCell>
                            <TableCell>{ticket.date}</TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={`
                                  ${ticket.priority === 'Critical' ? 'bg-destructive/10 text-destructive border-destructive/20' : 
                                    ticket.priority === 'Medium' ? 'bg-warning/10 text-warning border-warning/20' : 
                                    ticket.priority === 'Low' ? 'bg-info/10 text-info border-info/20' :
                                    'bg-success/10 text-success border-success/20'
                                  }
                                `}
                              >
                                {ticket.status === 'Fixed' ? ticket.status : ticket.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="View" onClick={() => handleNavigateToTicket(ticket.id)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {ticket.status !== 'Fixed' ? (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-info" title="Assign">
                                      <UserPlus className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-success" title="Mark Resolved">
                                      <Check className="h-4 w-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Re-open">
                                      <RefreshCcw className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Delete">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                            No tickets match your current filters.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </TabsContent>
              
              <TabsContent value="chat" className="p-0 mt-0">
                <CardContent className="p-4">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="rounded-l-lg">ID</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Reported By</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="rounded-r-lg">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTickets.length > 0 ? (
                        filteredTickets.map((ticket, index) => (
                          <TableRow key={index} className="border-b border-border">
                            <TableCell>{ticket.id}</TableCell>
                            <TableCell className="font-medium">{ticket.subject}</TableCell>
                            <TableCell>{ticket.reportedBy}</TableCell>
                            <TableCell>{ticket.date}</TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={`
                                  ${ticket.priority === 'Critical' ? 'bg-destructive/10 text-destructive border-destructive/20' : 
                                    ticket.priority === 'Medium' ? 'bg-warning/10 text-warning border-warning/20' : 
                                    ticket.priority === 'Low' ? 'bg-info/10 text-info border-info/20' :
                                    'bg-success/10 text-success border-success/20'
                                  }
                                `}
                              >
                                {ticket.status === 'Fixed' ? ticket.status : ticket.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="View" onClick={() => handleNavigateToTicket(ticket.id)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {ticket.status !== 'Fixed' ? (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-info" title="Assign">
                                      <UserPlus className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-success" title="Mark Resolved">
                                      <Check className="h-4 w-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Re-open">
                                      <RefreshCcw className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Delete">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                            No tickets match your current filters.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </TabsContent>
              
              <TabsContent value="appeal" className="p-0 mt-0">
                <CardContent className="p-4">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="rounded-l-lg">ID</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Reported By</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="rounded-r-lg">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTickets.length > 0 ? (
                        filteredTickets.map((ticket, index) => (
                          <TableRow key={index} className="border-b border-border">
                            <TableCell>{ticket.id}</TableCell>
                            <TableCell className="font-medium">{ticket.subject}</TableCell>
                            <TableCell>{ticket.reportedBy}</TableCell>
                            <TableCell>{ticket.date}</TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={`
                                  ${ticket.priority === 'Critical' ? 'bg-destructive/10 text-destructive border-destructive/20' : 
                                    ticket.priority === 'Medium' ? 'bg-warning/10 text-warning border-warning/20' : 
                                    ticket.priority === 'Low' ? 'bg-info/10 text-info border-info/20' :
                                    'bg-success/10 text-success border-success/20'
                                  }
                                `}
                              >
                                {ticket.status === 'Fixed' ? ticket.status : ticket.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="View" onClick={() => handleNavigateToTicket(ticket.id)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {ticket.status !== 'Fixed' ? (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-info" title="Assign">
                                      <UserPlus className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-success" title="Mark Resolved">
                                      <Check className="h-4 w-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Re-open">
                                      <RefreshCcw className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Delete">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                            No tickets match your current filters.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
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