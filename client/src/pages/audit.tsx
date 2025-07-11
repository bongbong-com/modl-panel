import { useState, useMemo, useCallback } from 'react';
import { 
  Filter, 
  Search, 
  Download, 
  Calendar,
  ChevronDown,
  ChevronUp,
  Shield,
  AlertCircle,
  Info,
  AlertTriangle,
  Activity,
  User,
  Bot,
  Settings,
  FileText,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Eye,
  BarChart3,
  Users,
  Clock,
  Undo2,
  Database,
  Gavel
} from 'lucide-react';
import { Button } from 'modl-shared-web/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'modl-shared-web/components/ui/card';
import { Badge } from 'modl-shared-web/components/ui/badge';
import { Input } from 'modl-shared-web/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'modl-shared-web/components/ui/select';
import { Separator } from 'modl-shared-web/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from 'modl-shared-web/components/ui/popover';
import { Calendar as CalendarComponent } from 'modl-shared-web/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from 'modl-shared-web/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'modl-shared-web/components/ui/tabs';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useLogs } from '@/hooks/use-data';
import { useQuery } from '@tanstack/react-query';
import PageContainer from '@/components/layout/PageContainer';
import { useToast } from 'modl-shared-web/hooks/use-toast';
import { cn } from 'modl-shared-web/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts';

interface DatabaseLog {
  _id: string;
  created: string;
  description: string;
  level: 'info' | 'warning' | 'error' | 'moderation';
  source: string;
  metadata?: Record<string, any>;
}

interface TransformedLog extends DatabaseLog {
  actionType: string;
  color: string;
  userType: string;
  icon: React.ReactNode;
  formattedTime: string;
  relativeTime: string;
}

interface StaffMember {
  id: string;
  username: string;
  role: string;
  totalActions: number;
  ticketResponses: number;
  punishmentsIssued: number;
  avgResponseTime: number;
  lastActive: string;
  recentActions: TransformedLog[];
}

interface PunishmentAction {
  id: string;
  type: 'ban' | 'mute' | 'kick' | 'warn';
  playerId: string;
  playerName: string;
  staffId: string;
  staffName: string;
  reason: string;
  duration?: number;
  timestamp: string;
  canRollback: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// Enhanced action type mapping with icons
const getActionDetails = (level: string, source: string, description: string) => {
  const descLower = description.toLowerCase();
  
  if (descLower.includes('ban') || descLower.includes('mute') || descLower.includes('kick') || descLower.includes('punishment')) {
    return { 
      actionType: 'moderation', 
      color: 'destructive', 
      userType: 'Moderation',
      icon: <Shield className="h-4 w-4" />
    };
  }
  
  if (descLower.includes('ticket')) {
    return { 
      actionType: 'ticket', 
      color: 'primary', 
      userType: 'Support',
      icon: <FileText className="h-4 w-4" />
    };
  }
  
  if (descLower.includes('setting') || descLower.includes('config')) {
    return { 
      actionType: 'settings', 
      color: 'secondary', 
      userType: 'Configuration',
      icon: <Settings className="h-4 w-4" />
    };
  }
  
  switch (level) {
    case 'moderation':
      return { 
        actionType: 'moderation', 
        color: 'warning', 
        userType: 'Staff',
        icon: <Shield className="h-4 w-4" />
      };
    case 'error':
      return { 
        actionType: 'error', 
        color: 'destructive', 
        userType: 'System',
        icon: <AlertCircle className="h-4 w-4" />
      };
    case 'warning':
      return { 
        actionType: 'warning', 
        color: 'warning', 
        userType: 'System',
        icon: <AlertTriangle className="h-4 w-4" />
      };
    case 'info':
    default:
      if (source !== 'system' && source !== 'System') {
        return { 
          actionType: 'user', 
          color: 'primary', 
          userType: 'User',
          icon: <User className="h-4 w-4" />
        };
      }
      return { 
        actionType: 'system', 
        color: 'secondary', 
        userType: 'System',
        icon: <Bot className="h-4 w-4" />
      };
  }
};

const formatRelativeTime = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return format(date, 'MMM d, yyyy');
};

// API functions
const fetchStaffPerformance = async (period = '30d'): Promise<StaffMember[]> => {
  const response = await fetch(`/api/panel/audit/staff-performance?period=${period}`);
  if (!response.ok) throw new Error('Failed to fetch staff performance');
  return response.json();
};

const fetchPunishments = async (limit = 50, canRollback = true): Promise<PunishmentAction[]> => {
  const response = await fetch(`/api/panel/audit/punishments?limit=${limit}&canRollback=${canRollback}`);
  if (!response.ok) throw new Error('Failed to fetch punishments');
  return response.json();
};

const fetchDatabaseData = async (table: string, limit = 100, skip = 0) => {
  const response = await fetch(`/api/panel/audit/database/${table}?limit=${limit}&skip=${skip}`);
  if (!response.ok) throw new Error('Failed to fetch database data');
  return response.json();
};

const fetchAnalytics = async (period = '7d') => {
  const response = await fetch(`/api/panel/audit/analytics?period=${period}`);
  if (!response.ok) throw new Error('Failed to fetch analytics');
  return response.json();
};

const rollbackPunishment = async (id: string, reason?: string) => {
  const response = await fetch(`/api/panel/audit/punishments/${id}/rollback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  });
  if (!response.ok) throw new Error('Failed to rollback punishment');
  return response.json();
};

// Database exploration modal component
const DatabaseExplorerModal = () => {
  const [selectedTable, setSelectedTable] = useState('players');
  const [page, setPage] = useState(1);
  const limit = 20;
  
  const { data: databaseData, isLoading } = useQuery({
    queryKey: ['database', selectedTable, page],
    queryFn: () => fetchDatabaseData(selectedTable, limit, (page - 1) * limit),
    staleTime: 5 * 60 * 1000
  });

  const tables = ['players', 'tickets', 'staff', 'punishments', 'logs', 'settings'];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Database className="h-4 w-4 mr-2" />
          Database Explorer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Database Explorer</DialogTitle>
        </DialogHeader>
        <div className="flex gap-4 h-[60vh]">
          <div className="w-48 border-r pr-4">
            <div className="space-y-1">
              {tables.map((table) => (
                <Button
                  key={table}
                  variant={selectedTable === table ? "default" : "ghost"}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    setSelectedTable(table);
                    setPage(1);
                  }}
                >
                  {table}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <div className="bg-muted p-4 rounded-md">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium capitalize">{selectedTable} Table</h4>
                {databaseData?.total && (
                  <span className="text-sm text-muted-foreground">
                    {databaseData.total} total records
                  </span>
                )}
              </div>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {databaseData?.data?.map((row: any, index: number) => (
                      <div key={index} className="bg-background p-3 rounded border">
                        <pre className="text-xs overflow-x-auto">
                          {JSON.stringify(row, null, 2)}
                        </pre>
                      </div>
                    )) || (
                      <div className="text-center py-4 text-muted-foreground">
                        No data available
                      </div>
                    )}
                  </div>
                  
                  {databaseData?.hasMore && (
                    <div className="flex justify-between items-center mt-4 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {page}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={!databaseData?.hasMore}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Staff performance modal
const StaffPerformanceModal = () => {
  const [period, setPeriod] = useState('30d');
  
  const { data: staffData = [], isLoading } = useQuery({
    queryKey: ['staff-performance', period],
    queryFn: () => fetchStaffPerformance(period),
    staleTime: 5 * 60 * 1000
  });
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="h-4 w-4 mr-2" />
          Staff Performance
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Staff Performance Analytics
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="90d">90 days</SelectItem>
              </SelectContent>
            </Select>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 overflow-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions by Staff Member</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={staffData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="username" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="totalActions" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Response Times</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={staffData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="username" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgResponseTime" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Staff Activity Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Username</th>
                      <th className="text-left p-2">Role</th>
                      <th className="text-left p-2">Total Actions</th>
                      <th className="text-left p-2">Ticket Responses</th>
                      <th className="text-left p-2">Punishments</th>
                      <th className="text-left p-2">Avg Response</th>
                      <th className="text-left p-2">Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map((staff) => (
                      <tr key={staff.id} className="border-b">
                        <td className="p-2 font-medium">{staff.username}</td>
                        <td className="p-2">
                          <Badge variant="outline">{staff.role}</Badge>
                        </td>
                        <td className="p-2">{staff.totalActions}</td>
                        <td className="p-2">{staff.ticketResponses}</td>
                        <td className="p-2">{staff.punishmentsIssued}</td>
                        <td className="p-2">{staff.avgResponseTime}m</td>
                        <td className="p-2">{formatRelativeTime(new Date(staff.lastActive))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Punishment rollback modal
const PunishmentRollbackModal = () => {
  const { toast } = useToast();
  
  const { data: punishments = [], isLoading, refetch } = useQuery({
    queryKey: ['punishments-rollback'],
    queryFn: () => fetchPunishments(50, true),
    staleTime: 5 * 60 * 1000
  });
  
  const handleRollback = async (punishment: PunishmentAction) => {
    try {
      await rollbackPunishment(punishment.id, `Rolled back by admin`);
      toast({
        title: "Punishment Rolled Back",
        description: `${punishment.type} for ${punishment.playerName} has been reversed.`
      });
      refetch();
    } catch (error) {
      toast({
        title: "Rollback Failed",
        description: "Failed to rollback punishment. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Undo2 className="h-4 w-4 mr-2" />
          Rollback Punishments
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Punishment Rollback Center</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : punishments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No punishments available for rollback
            </div>
          ) : (
            punishments.filter(p => p.canRollback).map((punishment) => (
            <Card key={punishment.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      punishment.type === 'ban' && "bg-red-100 text-red-600",
                      punishment.type === 'mute' && "bg-orange-100 text-orange-600",
                      punishment.type === 'kick' && "bg-yellow-100 text-yellow-600",
                      punishment.type === 'warn' && "bg-blue-100 text-blue-600"
                    )}>
                      <Gavel className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={punishment.type === 'ban' ? 'destructive' : 'secondary'}>
                          {punishment.type.toUpperCase()}
                        </Badge>
                        <span className="font-medium">{punishment.playerName}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {punishment.reason} • by {punishment.staffName} • {formatRelativeTime(new Date(punishment.timestamp))}
                      </p>
                      {punishment.duration && (
                        <p className="text-xs text-muted-foreground">
                          Duration: {Math.floor(punishment.duration / 86400)}d {Math.floor((punishment.duration % 86400) / 3600)}h
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRollback(punishment)}
                  >
                    <Undo2 className="h-4 w-4 mr-2" />
                    Rollback
                  </Button>
                </div>
              </CardContent>
            </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AuditLog = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [dateRange, setDateRange] = useState<{from: Date | undefined, to: Date | undefined}>({
    from: undefined,
    to: undefined
  });
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  
  const itemsPerPage = 20;
  
  const { data: logsData, isLoading, error, refetch, isRefetching } = useLogs();
  
  const transformedLogs = useMemo(() => {
    return (logsData as DatabaseLog[] || []).map((log): TransformedLog => {
      const details = getActionDetails(log.level, log.source, log.description);
      const logDate = new Date(log.created);
      
      return {
        ...log,
        ...details,
        formattedTime: format(logDate, 'MMM d, yyyy HH:mm:ss'),
        relativeTime: formatRelativeTime(logDate)
      };
    });
  }, [logsData]);
  
  const filteredLogs = useMemo(() => {
    return transformedLogs.filter(log => {
      if (searchQuery && !log.description.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !log.source.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      if (actionFilter !== "all" && log.actionType !== actionFilter) {
        return false;
      }
      
      if (severityFilter !== "all" && log.level !== severityFilter) {
        return false;
      }
      
      if (dateRange.from || dateRange.to) {
        const logDate = new Date(log.created);
        if (dateRange.from && logDate < startOfDay(dateRange.from)) return false;
        if (dateRange.to && logDate > endOfDay(dateRange.to)) return false;
      }
      
      return true;
    });
  }, [transformedLogs, searchQuery, actionFilter, severityFilter, dateRange]);
  
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, currentPage]);
  
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  
  // Analytics data
  const analyticsData = useMemo(() => {
    const last24h = subDays(new Date(), 1);
    const last7d = subDays(new Date(), 7);
    
    const logs24h = transformedLogs.filter(log => new Date(log.created) >= last24h);
    const logs7d = transformedLogs.filter(log => new Date(log.created) >= last7d);
    
    // Activity trends for the past 7 days
    const dailyActivity = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayLogs = transformedLogs.filter(log => {
        const logDate = new Date(log.created);
        return logDate >= startOfDay(date) && logDate <= endOfDay(date);
      });
      
      return {
        date: format(date, 'MMM dd'),
        total: dayLogs.length,
        moderation: dayLogs.filter(log => log.actionType === 'moderation').length,
        tickets: dayLogs.filter(log => log.actionType === 'ticket').length,
        errors: dayLogs.filter(log => log.level === 'error').length
      };
    });
    
    // Action type distribution
    const actionDistribution = [
      { name: 'Moderation', value: transformedLogs.filter(log => log.actionType === 'moderation').length, color: '#ff6b6b' },
      { name: 'Tickets', value: transformedLogs.filter(log => log.actionType === 'ticket').length, color: '#4ecdc4' },
      { name: 'System', value: transformedLogs.filter(log => log.actionType === 'system').length, color: '#45b7d1' },
      { name: 'User Actions', value: transformedLogs.filter(log => log.actionType === 'user').length, color: '#96ceb4' },
      { name: 'Settings', value: transformedLogs.filter(log => log.actionType === 'settings').length, color: '#ffeaa7' },
      { name: 'Errors', value: transformedLogs.filter(log => log.actionType === 'error').length, color: '#fd79a8' }
    ].filter(item => item.value > 0);
    
    return {
      total24h: logs24h.length,
      total7d: logs7d.length,
      errors: logs24h.filter(log => log.level === 'error').length,
      warnings: logs24h.filter(log => log.level === 'warning').length,
      moderations: logs24h.filter(log => log.actionType === 'moderation').length,
      tickets: logs24h.filter(log => log.actionType === 'ticket').length,
      dailyActivity,
      actionDistribution
    };
  }, [transformedLogs]);
  
  // Fetch analytics data
  const { data: analyticsApiData } = useQuery({
    queryKey: ['audit-analytics', '7d'],
    queryFn: () => fetchAnalytics('7d'),
    staleTime: 5 * 60 * 1000
  });
  
  // Fetch staff data for the active staff count
  const { data: staffApiData = [] } = useQuery({
    queryKey: ['staff-performance-overview'],
    queryFn: () => fetchStaffPerformance('7d'),
    staleTime: 5 * 60 * 1000
  });
  
  const toggleLogExpansion = useCallback((logId: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  }, []);
  
  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    setIsExporting(true);
    try {
      let content: string;
      let filename: string;
      let mimeType: string;
      
      if (format === 'csv') {
        const headers = ['Time', 'Level', 'Source', 'Description', 'Type'];
        const rows = filteredLogs.map(log => [
          log.formattedTime,
          log.level,
          log.source,
          log.description.replace(/"/g, '""'),
          log.actionType
        ]);
        
        content = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        filename = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        mimeType = 'text/csv';
      } else {
        content = JSON.stringify(filteredLogs.map(log => ({
          time: log.created,
          level: log.level,
          source: log.source,
          description: log.description,
          type: log.actionType,
          metadata: log.metadata
        })), null, 2);
        
        filename = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.json`;
        mimeType = 'application/json';
      }
      
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export successful",
        description: `Audit logs exported as ${format.toUpperCase()}`
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export audit logs",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  }, [filteredLogs, toast]);
  
  const setPresetDateRange = useCallback((preset: string) => {
    const now = new Date();
    switch (preset) {
      case 'today':
        setDateRange({ from: startOfDay(now), to: endOfDay(now) });
        break;
      case 'yesterday':
        const yesterday = subDays(now, 1);
        setDateRange({ from: startOfDay(yesterday), to: endOfDay(yesterday) });
        break;
      case 'last7days':
        setDateRange({ from: subDays(now, 7), to: now });
        break;
      case 'last30days':
        setDateRange({ from: subDays(now, 30), to: now });
        break;
      case 'all':
        setDateRange({ from: undefined, to: undefined });
        break;
    }
  }, []);

  return (
    <PageContainer>
      <div className="flex flex-col space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Advanced Audit Dashboard</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Comprehensive system monitoring, staff analytics, and administrative controls
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StaffPerformanceModal />
            <PunishmentRollbackModal />
            <DatabaseExplorerModal />
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isRefetching && "animate-spin")} />
              Refresh
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" disabled={isExporting}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-2">
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    onClick={() => handleExport('csv')}
                  >
                    Export as CSV
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    onClick={() => handleExport('json')}
                  >
                    Export as JSON
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        
        {/* Enhanced Statistics Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total (24h)</p>
                  <p className="text-2xl font-bold">{analyticsData.total24h}</p>
                </div>
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Errors</p>
                  <p className="text-2xl font-bold text-destructive">{analyticsData.errors}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Warnings</p>
                  <p className="text-2xl font-bold text-warning">{analyticsData.warnings}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Mod Actions</p>
                  <p className="text-2xl font-bold">{analyticsData.moderations}</p>
                </div>
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tickets</p>
                  <p className="text-2xl font-bold">{analyticsData.tickets}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Staff Active</p>
                  <p className="text-2xl font-bold">{staffApiData.filter(s => new Date(s.lastActive) > subDays(new Date(), 1)).length}</p>
                </div>
                <Users className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center">
                <BarChart3 className="h-4 w-4 mr-2" />
                7-Day Activity Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={analyticsApiData?.dailyActivity || analyticsData.dailyActivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="total" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="moderation" stackId="2" stroke="#ff6b6b" fill="#ff6b6b" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="tickets" stackId="3" stroke="#4ecdc4" fill="#4ecdc4" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Action Type Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={analyticsApiData?.actionDistribution ? 
                      Object.entries(analyticsApiData.actionDistribution).map(([key, value]) => ({
                        name: key.charAt(0).toUpperCase() + key.slice(1),
                        value: value as number,
                        color: COLORS[Object.keys(analyticsApiData.actionDistribution).indexOf(key) % COLORS.length]
                      })) : 
                      analyticsData.actionDistribution
                    }
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {(analyticsApiData?.actionDistribution ? 
                      Object.entries(analyticsApiData.actionDistribution).map(([key, value], index) => ({
                        name: key,
                        value,
                        color: COLORS[index % COLORS.length]
                      })) : 
                      analyticsData.actionDistribution
                    ).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        
        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center">
              <Filter className="h-4 w-4 mr-2" />
              Advanced Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="moderation">Moderation</SelectItem>
                  <SelectItem value="user">User Actions</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="error">Errors</SelectItem>
                  <SelectItem value="ticket">Tickets</SelectItem>
                  <SelectItem value="settings">Settings</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="moderation">Moderation</SelectItem>
                </SelectContent>
              </Select>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}
                        </>
                      ) : (
                        format(dateRange.from, "MMM d, yyyy")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3 space-y-2">
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={() => setPresetDateRange('today')}
                      >
                        Today
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={() => setPresetDateRange('yesterday')}
                      >
                        Yesterday
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={() => setPresetDateRange('last7days')}
                      >
                        Last 7 days
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={() => setPresetDateRange('last30days')}
                      >
                        Last 30 days
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={() => setPresetDateRange('all')}
                      >
                        All time
                      </Button>
                    </div>
                    <Separator />
                    <CalendarComponent
                      mode="range"
                      selected={{
                        from: dateRange.from,
                        to: dateRange.to
                      }}
                      onSelect={(range: any) => setDateRange(range || { from: undefined, to: undefined })}
                      numberOfMonths={2}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>
        
        {/* Enhanced Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Activity Log
              {filteredLogs.length > 0 && (
                <span className="ml-2 text-sm text-muted-foreground">
                  ({filteredLogs.length} entries)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading && (
              <div className="p-8 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Loading audit logs...</p>
              </div>
            )}
            
            {error && (
              <div className="p-8 text-center">
                <AlertCircle className="h-8 w-8 mx-auto mb-4 text-destructive" />
                <p className="text-destructive">Error loading logs: {error.message}</p>
              </div>
            )}
            
            {!isLoading && !error && filteredLogs.length === 0 && (
              <div className="p-8 text-center">
                <Info className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No audit logs found matching your filters.</p>
              </div>
            )}
            
            {!isLoading && !error && paginatedLogs.length > 0 && (
              <div className="divide-y">
                {paginatedLogs.map((log) => (
                  <div
                    key={log._id}
                    className={cn(
                      "p-4 hover:bg-muted/50 transition-colors",
                      expandedLogs.has(log._id) && "bg-muted/30"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={cn(
                          "p-2 rounded-full flex-shrink-0",
                          log.level === 'error' && "bg-destructive/10 text-destructive",
                          log.level === 'warning' && "bg-warning/10 text-warning",
                          log.level === 'moderation' && "bg-primary/10 text-primary",
                          log.level === 'info' && "bg-secondary/10 text-secondary"
                        )}>
                          {log.icon}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{log.source}</span>
                            <Badge 
                              variant={log.level === 'error' ? 'destructive' : 
                                      log.level === 'warning' ? 'secondary' : 
                                      'outline'}
                              className="text-xs"
                            >
                              {log.userType}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {log.level}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-muted-foreground mt-1 break-words">
                            {log.description}
                          </p>
                          
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => toggleLogExpansion(log._id)}
                            >
                              {expandedLogs.has(log._id) ? (
                                <>
                                  <ChevronUp className="h-3 w-3 mr-1" />
                                  Hide details
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3 mr-1" />
                                  Show details
                                </>
                              )}
                            </Button>
                          )}
                          
                          {expandedLogs.has(log._id) && log.metadata && (
                            <div className="mt-3 p-3 bg-muted rounded-md">
                              <pre className="text-xs overflow-x-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-muted-foreground">{log.relativeTime}</p>
                        <p className="text-xs text-muted-foreground mt-1">{log.formattedTime}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} entries
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
};

export default AuditLog;