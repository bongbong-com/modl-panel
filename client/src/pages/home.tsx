import { useState } from 'react';
import { 
  Bell, 
  RefreshCw, 
  ArrowUp, 
  ArrowDown, 
  Ticket, 
  Shield, 
  CircleAlert, 
  Bot 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useSidebar } from '@/hooks/use-sidebar';
import { recentActivity } from '@/data/mockData';

type Activity = typeof recentActivity[0];

const ActivityItem = ({ activity }: { activity: Activity }) => {
  return (
    <div className="p-4 hover:bg-muted/50 flex items-start">
      <div className={`h-10 w-10 rounded-full bg-${activity.color}-500/20 flex items-center justify-center mr-4 flex-shrink-0`}>
        {activity.type === 'ticket' && <Ticket className={`h-5 w-5 text-${activity.color}-500`} />}
        {activity.type === 'moderation' && <Shield className={`h-5 w-5 text-${activity.color}-500`} />}
        {activity.type === 'report' && <CircleAlert className={`h-5 w-5 text-${activity.color}-500`} />}
        {activity.type === 'ai' && <Bot className={`h-5 w-5 text-${activity.color}-500`} />}
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

const StatCard = ({ title, value, change, changeText, color }: { 
  title: string, 
  value: number, 
  change: number,
  changeText: string,
  color: "primary" | "warning" | "info"
}) => (
  <Card>
    <CardContent className="p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">{title}</h3>
        <span className={`text-${color} text-lg`}>{value}</span>
      </div>
      <div className="flex items-center text-sm text-muted-foreground">
        <span className={`text-${change >= 0 ? 'success' : 'destructive'} mr-1 flex items-center`}>
          {change >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />} {Math.abs(change)}%
        </span>
        <span>{changeText}</span>
      </div>
    </CardContent>
  </Card>
);

const Home = () => {
  const { } = useSidebar(); // We're not using sidebar context in this component
  const [activityFilter, setActivityFilter] = useState("all");
  
  // Fixed left margin to accommodate the always-collapsed sidebar
  const mainContentClass = "ml-[28px] pl-6";

  return (
    <section className={`min-h-screen p-6 md:p-8 transition-all duration-300 ${mainContentClass}`}>
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Home</h2>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            title="Active Players" 
            value={153} 
            change={12} 
            changeText="from last hour" 
            color="primary" 
          />
          <StatCard 
            title="Open Tickets" 
            value={28} 
            change={-5} 
            changeText="from yesterday" 
            color="warning" 
          />
          <StatCard 
            title="Mod Actions Today" 
            value={47} 
            change={-8} 
            changeText="from yesterday" 
            color="info" 
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
            {recentActivity
              .filter(a => activityFilter === 'all' || a.type === activityFilter)
              .map((activity, index) => (
                <ActivityItem key={index} activity={activity} />
              ))}
          </div>
          
          <Separator />
          
          <div className="p-3 text-center">
            <Button variant="link" className="text-sm text-primary hover:text-primary/80">
              View All Activity →
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
};

export default Home;
