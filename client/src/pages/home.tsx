import { useState } from 'react';
import { 
  Bell, 
  RefreshCw, 
  ArrowUp, 
  ArrowDown, 
  Ticket, 
  Shield, 
  CircleAlert, 
  Bot,
  Sun,
  Moon
} from 'lucide-react';
import { Button } from 'modl-shared-web/components/ui/button';
import { Badge } from 'modl-shared-web/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from 'modl-shared-web/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'modl-shared-web/components/ui/select';
import { Separator } from 'modl-shared-web/components/ui/separator';
import { useTheme } from 'next-themes';
import { useRecentActivity, useStats, ClientActivity } from '@/hooks/use-data';
import { useToast } from 'modl-shared-web/hooks/use-toast';
import PageContainer from '@/components/layout/PageContainer';

type Activity = ClientActivity;

const ActivityItem = ({ activity }: { activity: Activity }) => {
  return (
    <div className="p-4 hover:bg-muted/50 flex items-start ease-in duration-200">
      <div className={`h-10 w-10 rounded-full bg-${activity.color}-500/20 flex items-center justify-center mr-4 flex-shrink-0`}>
        {activity.type === 'new_ticket' && <Ticket className={`h-5 w-5 text-${activity.color}-500`} />}
        {activity.type === 'mod_action' && <Shield className={`h-5 w-5 text-${activity.color}-500`} />}
        {activity.type === 'new_punishment' && <CircleAlert className={`h-5 w-5 text-${activity.color}-500`} />}
        {activity.type === 'system_log' && <Bot className={`h-5 w-5 text-${activity.color}-500`} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <p className="font-medium">{activity.title}</p>
          <span className="text-xs text-muted-foreground">{activity.time}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
        <div className="flex mt-2 space-x-2">
          {activity.actions.map((action, i) => (
            <Button
              key={i}
              variant={action.primary ? "default" : "outline"}
              size="sm"
              className={action.primary ? 
                `bg-${activity.color}-500/20 hover:bg-${activity.color}-500/30 text-${activity.color}-500 border-0` : 
                "bg-muted/50 text-muted-foreground hover:bg-muted"
              }
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, change, changeText, color, isLoading }: { 
  title: string, 
  value: number, 
  change: number,
  changeText: string,
  color: "primary" | "warning" | "info",
  isLoading?: boolean
}) => (
  <Card>
    <CardContent className="p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">{title}</h3>
        {isLoading ? (
          <div className="h-6 w-12 bg-muted animate-pulse rounded"></div>
        ) : (
          <span className={`text-${color} text-lg font-bold`}>{value.toLocaleString()}</span>
        )}
      </div>
      <div className="flex items-center text-sm text-muted-foreground">
        {isLoading ? (
          <div className="h-4 w-24 bg-muted animate-pulse rounded"></div>
        ) : (
          <>
            <span className={`text-${change >= 0 ? 'success' : 'destructive'} mr-1 flex items-center font-medium`}>
              {change >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />} {Math.abs(change)}%
            </span>
            <span>{changeText}</span>
          </>
        )}
      </div>
    </CardContent>
  </Card>
);

const Home = () => {
  const [activityFilter, setActivityFilter] = useState("all");
  const [isSpinning, setIsSpinning] = useState(false);
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  
  // Fetch recent activity from the database
  const { 
    data: recentActivityData, 
    isLoading: isLoadingActivity, 
    error: activityError,
    refetch: refetchActivity,
    isRefetching: isRefetchingActivity
  } = useRecentActivity(20, 7);
  
  // Fetch stats data from the database
  const { data: statsData, isLoading: isLoadingStats, refetch: refetchStats, isRefetching: isRefetchingStats, error: statsError } = useStats();
  
  // Filter activities by type
  const filteredActivities = (recentActivityData || []).filter(activity => {
    if (activityFilter === "all") return true;
    if (activityFilter === "moderation") return activity.type === "mod_action" || activity.type === "new_punishment";
    if (activityFilter === "ticket") return activity.type === "new_ticket";
    if (activityFilter === "ban") return activity.type === "new_punishment";
    return true;
  });

  const handleRefreshData = async () => {
    setIsSpinning(true);
    
    try {
      // Ensure minimum spin duration of 800ms and refresh both stats and activity
      await Promise.all([
        refetchActivity(),
        refetchStats(),
        new Promise(resolve => setTimeout(resolve, 800))
      ]);
      
      toast({
        title: "Dashboard Refreshed",
        description: "Stats and recent activity have been updated.",
      });
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      toast({
        title: "Error",
        description: "Failed to refresh dashboard. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSpinning(false);
    }
  };

  return (
    <PageContainer>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Home</h2>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Bell className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground"
            onClick={handleRefreshData}
            disabled={isSpinning || isRefetchingStats || isRefetchingActivity}
          >
            <RefreshCw className={`h-5 w-5 ${(isSpinning || isRefetchingStats || isRefetchingActivity) ? 'animate-spin' : ''}`} />
          </Button>
          {/* Theme Toggle */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatCard 
          title="Online Players" 
          value={statsData?.counts?.onlinePlayers || 0} 
          change={statsData?.changes?.onlinePlayers || 0} 
          changeText="from last hour" 
          color="primary" 
          isLoading={isLoadingStats}
        />
        <StatCard 
          title="Unique Logins" 
          value={statsData?.counts?.uniqueLogins || 0} 
          change={statsData?.changes?.uniqueLogins || 0} 
          changeText="from yesterday" 
          color="info" 
          isLoading={isLoadingStats}
        />
        <StatCard 
          title="Open Tickets" 
          value={statsData?.counts?.openTickets || 0} 
          change={statsData?.changes?.openTickets || 0} 
          changeText="from yesterday" 
          color="warning" 
          isLoading={isLoadingStats}
        />
      </div>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-md font-medium">Recent Activity</CardTitle>
          <Select defaultValue="all" onValueChange={setActivityFilter}>
            <SelectTrigger className="w-[180px] bg-background border border-border text-sm">
              <SelectValue placeholder="All Activities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Activities</SelectItem>
              <SelectItem value="moderation">Mod Actions</SelectItem>
              <SelectItem value="ticket">Tickets</SelectItem>
              <SelectItem value="ban">Bans</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
          <div className="divide-y divide-border">
          {isLoadingActivity && <p className="p-4 text-center">Loading recent activity...</p>}
          {activityError && <p className="p-4 text-center text-destructive">Error loading activity: {activityError.message}</p>}
          {!isLoadingActivity && !activityError && filteredActivities.length === 0 && (
            <p className="p-4 text-center text-muted-foreground">No recent activity to display.</p>
          )}
          {!isLoadingActivity && !activityError && filteredActivities.map((activity) => (
              <ActivityItem key={String(activity.id)} activity={activity} />
            ))}
        </div>
        
        <Separator />
        
        <div className="p-3 text-center">
          <Button variant="link" className="text-sm text-primary hover:text-primary/80">
            View All Activity →
          </Button>
        </div>
      </Card>
    </PageContainer>
  );
};

export default Home;
