import { useState } from 'react';
import { Filter } from 'lucide-react';
import { Button } from 'modl-shared-web/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'modl-shared-web/components/ui/card';
import { Badge } from 'modl-shared-web/components/ui/badge';
import { useSidebar } from '@/hooks/use-sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'modl-shared-web/components/ui/select';
import { Separator } from 'modl-shared-web/components/ui/separator';
import { useLogs } from '@/hooks/use-data';
import PageContainer from '@/components/layout/PageContainer';

interface DatabaseLog {
  _id: string;
  created: string;
  description: string;
  level: 'info' | 'warning' | 'error' | 'moderation';
  source: string;
}

const AuditLog = () => {
  const { } = useSidebar(); // We're not using sidebar context in this component
  const [actionFilter, setActionFilter] = useState("all");
  
  // Fetch logs from the database
  const { data: logsData, isLoading: isLoadingLogs, error: logsError } = useLogs();
  
  // Transform database logs to the format expected by the UI
  const transformedLogs = (logsData as DatabaseLog[] || []).map((log) => {
    // Map log levels to action types and colors
    const getActionTypeAndColor = (level: string, source: string) => {
      switch (level) {
        case 'moderation':
          return { actionType: 'staff', color: 'orange', userType: 'Staff' };
        case 'error':
          return { actionType: 'system', color: 'red', userType: 'System' };  
        case 'warning':
          return { actionType: 'system', color: 'yellow', userType: 'System' };
        case 'info':
        default:
          // If source is not 'system', it might be from a staff member
          if (source !== 'system') {
            return { actionType: 'staff', color: 'blue', userType: 'Staff' };
          }
          return { actionType: 'system', color: 'blue', userType: 'System' };
      }
    };
    
    const { actionType, color, userType } = getActionTypeAndColor(log.level, log.source);
    
    return {
      user: log.source,
      userType,
      actionType,
      action: log.description,
      detail: `Level: ${log.level}`,
      viewText: '',
      viewLink: '',
      time: new Date(log.created).toLocaleString(),
      color
    };
  });
  
  // Filter logs by action type
  const filteredLogs = transformedLogs.filter(log => {
    return actionFilter === "all" || log.actionType === actionFilter;
  });

  return (
    <PageContainer>
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Audit Log</h2>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" /> Filter
            </Button>
            <Select defaultValue="all" onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px] bg-background border border-border text-sm">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="staff">Mod Actions</SelectItem>
                <SelectItem value="ai">AI Actions</SelectItem>
                <SelectItem value="system">System Actions</SelectItem>
                <SelectItem value="admin">Admin Actions</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-md font-medium">Activity Log</CardTitle>
          </CardHeader>          <CardContent className="space-y-4">
            {isLoadingLogs && <p className="p-4 text-center">Loading audit logs...</p>}
            {logsError && <p className="p-4 text-center text-destructive">Error loading logs: {logsError.message}</p>}
            {!isLoadingLogs && !logsError && filteredLogs.length === 0 && (
              <p className="p-4 text-center text-muted-foreground">No audit logs to display.</p>
            )}
            {!isLoadingLogs && !logsError && filteredLogs.map((log, index) => (
              <div key={index} className="flex justify-between">
                <div className="flex items-center">
                  <div className="mr-4 w-4 h-full flex items-center justify-center">
                    <div className={`w-1 h-full bg-${log.color}`}></div>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{log.user}</span>
                      <Badge 
                        variant="outline" 
                        className={`bg-${log.color}/20 text-${log.color} border-${log.color}/20`}
                      >
                        {log.userType}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{log.action}</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className="text-xs text-muted-foreground">{log.detail}</span>
                      {log.viewText && log.viewLink && (
                        <Button
                          variant="link"
                          size="sm"
                          className="text-xs text-primary p-0 h-auto"
                          onClick={() => { /* TODO: Implement navigation if using a router */ console.log("Navigate to:", log.viewLink); }}
                        >
                          {log.viewText}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{log.time}</span>
              </div>
            ))}
            
            <Separator className="my-2" />
            
            <div className="mt-6 flex justify-center">
              <Button variant="outline" className="px-4 py-2 text-sm text-muted-foreground">
                Load More
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
};

export default AuditLog;
