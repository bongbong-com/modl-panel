import { useState } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSidebar } from '@/hooks/use-sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { auditLogs } from '@/data/mockData';
import PageContainer from '@/components/layout/PageContainer'

const AuditLog = () => {
  const { } = useSidebar(); // We're not using sidebar context in this component
  const [actionFilter, setActionFilter] = useState("all");
  
  // More generous left margin to prevent text overlap with sidebar
  const mainContentClass = "ml-[32px] pl-8";

  // Filter logs by action type
  const filteredLogs = auditLogs.filter(log => {
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
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredLogs.map((log, index) => (
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
                      <Button variant="link" size="sm" className="text-xs text-primary p-0 h-auto">
                        {log.viewText}
                      </Button>
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
