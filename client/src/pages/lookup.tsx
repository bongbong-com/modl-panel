import { useState } from 'react';
import { Eye, TriangleAlert, Ban, RefreshCcw, Search, LockOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSidebar } from '@/hooks/use-sidebar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ResizableWindow from '@/components/layout/ResizableWindow';
import { Input } from '@/components/ui/input';
import { useDashboard } from '@/contexts/DashboardContext';
import { recentLookups } from '@/data/mockData';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';

const PlayerLookupWindow = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [lookupMethod, setLookupMethod] = useState('username');
  const [playerInfo, setPlayerInfo] = useState({
    username: 'DragonSlayer123',
    status: 'Online',
    vip: true,
    level: 42,
    uuid: '12a3b456-7c89...',
    firstJoined: '2023-01-15',
    lastOnline: '2 hours ago',
    playtime: '342 hours',
    ip: '192.168.x.x',
    previousNames: 'Dragon55, SlayerXD',
    warnings: [
      { type: 'Warning', reason: 'Excessive caps in chat', date: '2023-04-12', by: 'Moderator2' },
      { type: 'Mute', reason: 'Inappropriate language in global chat', date: '2023-03-28', by: 'ServerAI (30 minutes)' },
    ]
  });

  const handleLookup = () => {
    // In a real app, this would fetch player data from the server
    console.log('Looking up player...');
  };

  return (
    <ResizableWindow
      id="player-lookup"
      title="Player Lookup"
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Lookup Method</label>
          <div className="grid grid-cols-5 gap-2">
            {['Username', 'UUID', 'IP', 'Ban ID', 'Previous Name'].map((method, index) => (
              <Button
                key={index}
                variant={lookupMethod === method.toLowerCase() ? 'default' : 'outline'}
                className="text-sm"
                onClick={() => setLookupMethod(method.toLowerCase())}
              >
                {method}
              </Button>
            ))}
          </div>
        </div>
        
        <div>
          <label htmlFor="player-search" className="block text-sm font-medium mb-1">
            {lookupMethod === 'username' ? 'Player Username' : 
             lookupMethod === 'uuid' ? 'Player UUID' : 
             lookupMethod === 'ip' ? 'Player IP Address' : 
             lookupMethod === 'ban id' ? 'Ban ID' : 
             'Previous Username'}
          </label>
          <div className="relative">
            <Input 
              id="player-search" 
              placeholder={`Enter ${lookupMethod}...`}
              className="pr-12"
            />
            <Button 
              className="absolute right-0 top-0 h-full rounded-l-none"
              onClick={handleLookup}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {playerInfo && (
          <>
            <div className="pt-4 border-t border-border">
              <h4 className="font-medium mb-3">Player Information</h4>
              <div className="bg-background-lighter p-4 rounded-lg">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">{playerInfo.username.substring(0, 2)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-lg font-medium">{playerInfo.username}</h5>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                        {playerInfo.status}
                      </Badge>
                      {playerInfo.vip && (
                        <Badge variant="outline" className="bg-info/10 text-info border-info/20">
                          VIP
                        </Badge>
                      )}
                      <Badge variant="outline" className="bg-muted text-muted-foreground">
                        Level {playerInfo.level}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">UUID:</span>
                        <span className="ml-1">{playerInfo.uuid}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">First Joined:</span>
                        <span className="ml-1">{playerInfo.firstJoined}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Last Online:</span>
                        <span className="ml-1">{playerInfo.lastOnline}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Playtime:</span>
                        <span className="ml-1">{playerInfo.playtime}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">IP (masked):</span>
                        <span className="ml-1">{playerInfo.ip}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Previous Names:</span>
                        <span className="ml-1">{playerInfo.previousNames}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Moderation History</h4>
              {playerInfo.warnings.map((warning, index) => (
                <div 
                  key={index} 
                  className={`bg-${warning.type === 'Warning' ? 'warning' : 'info'}/10 border-l-4 border-${warning.type === 'Warning' ? 'warning' : 'info'} p-3 rounded-r-lg`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <Badge variant="outline" className={`bg-${warning.type === 'Warning' ? 'warning' : 'info'}/10 text-${warning.type === 'Warning' ? 'warning' : 'info'} border-${warning.type === 'Warning' ? 'warning' : 'info'}/20`}>
                        {warning.type}
                      </Badge>
                      <p className="text-sm mt-1">{warning.reason}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{warning.date}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">By: {warning.by}</p>
                </div>
              ))}
            </div>
            
            <div className="pt-4 flex justify-end space-x-2">
              <Button variant="destructive" size="sm">
                <Ban className="h-4 w-4 mr-1" /> Ban Player
              </Button>
              <Button variant="default" size="sm" className="bg-warning text-white hover:bg-warning/90">
                <TriangleAlert className="h-4 w-4 mr-1" /> Warn
              </Button>
              <Button variant="default" size="sm" className="bg-info text-white hover:bg-info/90">
                <RefreshCcw className="h-4 w-4 mr-1" /> Mute
              </Button>
            </div>
          </>
        )}
      </div>
    </ResizableWindow>
  );
};

const Lookup = () => {
  const { expanded } = useSidebar();
  const { openLookupWindow } = useDashboard();
  const [isLookupWindowOpen, setIsLookupWindowOpen] = useState(false);
  
  // Calculate the left margin based on sidebar state
  const mainContentClass = expanded ? "ml-[240px]" : "ml-[72px]";

  return (
    <section className={`min-h-screen p-6 md:p-8 transition-all duration-300 ${mainContentClass}`}>
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Player Lookup</h2>
          <Button onClick={() => setIsLookupWindowOpen(true)}>
            <Search className="h-4 w-4 mr-2" />
            <span>New Lookup</span>
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-md font-medium">Recent Lookups</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="rounded-l-lg">Player</TableHead>
                  <TableHead>UUID</TableHead>
                  <TableHead>Last Online</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="rounded-r-lg">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLookups.map((player, index) => (
                  <TableRow key={index} className="border-b border-border">
                    <TableCell className="font-medium">{player.username}</TableCell>
                    <TableCell className="text-muted-foreground">{player.uuid}</TableCell>
                    <TableCell>{player.lastOnline}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={`
                          ${player.status === 'Active' ? 'bg-success/10 text-success border-success/20' : 
                            player.status === 'Warned' ? 'bg-warning/10 text-warning border-warning/20' : 
                            'bg-destructive/10 text-destructive border-destructive/20'
                          }
                        `}
                      >
                        {player.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="View Details">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-warning" title="View Warnings">
                          <TriangleAlert className="h-4 w-4" />
                        </Button>
                        {player.status === 'Banned' ? (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-success" title="Unban">
                            <LockOpen className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Ban">
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <PlayerLookupWindow 
        isOpen={isLookupWindowOpen} 
        onClose={() => setIsLookupWindowOpen(false)} 
      />
    </section>
  );
};

export default Lookup;
