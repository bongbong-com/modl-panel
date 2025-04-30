import { useState, useEffect } from 'react';
import { 
  Eye, TriangleAlert, Ban, RefreshCcw, Search, LockOpen, History, 
  Link2, StickyNote, Ticket, UserRound, Shield, FileText 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ResizableWindow from '@/components/layout/ResizableWindow';
import { recentLookups } from '@/data/mockData';

import { WindowPosition } from '@/lib/types';

interface PlayerWindowProps {
  playerId: string;
  isOpen: boolean;
  onClose: () => void;
  initialPosition?: WindowPosition;
}

const PlayerWindow = ({ playerId, isOpen, onClose, initialPosition }: PlayerWindowProps) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [playerInfo, setPlayerInfo] = useState({
    username: 'DragonSlayer123',
    status: 'Online',
    uuid: '12a3b456-7c89...',
    firstJoined: '2023-01-15',
    lastOnline: '2 hours ago',
    lastServer: 'Survival (EU-3)',
    playtime: '342 hours',
    ip: '192.168.x.x',
    social: 'HIGH',
    gameplay: 'MED',
    punished: false,
    previousNames: ['Dragon55', 'SlayerXD'],
    warnings: [
      { type: 'Warning', reason: 'Excessive caps in chat', date: '2023-04-12', by: 'Moderator2' },
      { type: 'Mute', reason: 'Inappropriate language in global chat', date: '2023-03-28', by: 'ServerAI (30 minutes)' },
    ],
    linkedAccounts: ['Dragon55#1234 (Discord)', 'dragonslayer123 (Website)'],
    notes: ['Player has been consistently helpful to new players', 'Frequently reports bugs and exploits']
  });

  useEffect(() => {
    if (playerId && isOpen) {
      // In a real app, fetch player data using the playerId
      console.log('Fetching data for player:', playerId);
      
      // Find the player in our mock data
      const player = recentLookups.find(p => p.uuid === playerId);
      if (player) {
        setPlayerInfo(prev => ({
          ...prev,
          username: player.username,
          uuid: player.uuid,
          lastOnline: player.lastOnline,
          status: player.status === 'Active' ? 'Online' : player.status
        }));
      }
    }
  }, [playerId, isOpen]);

  return (
    <ResizableWindow
      id={`player-${playerId}`}
      title={playerInfo.username}
      isOpen={isOpen}
      onClose={onClose}
      initialPosition={initialPosition}
      initialSize={{ width: 650, height: 550 }}
    >
      <div className="space-y-4">
        <div className="pt-2">
          <div className="bg-background-lighter p-4 rounded-lg">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">{playerInfo.username.substring(0, 2)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="text-lg font-medium">{playerInfo.username}</h5>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    Real IP
                  </Badge>
                  <Badge variant="outline" className={`
                    ${playerInfo.social === 'LOW' ? 'bg-muted text-muted-foreground' : 
                      playerInfo.social === 'MED' ? 'bg-warning/10 text-warning border-warning/20' : 
                      'bg-destructive/10 text-destructive border-destructive/20'}
                  `}>
                    Social: {playerInfo.social}
                  </Badge>
                  <Badge variant="outline" className={`
                    ${playerInfo.gameplay === 'LOW' ? 'bg-muted text-muted-foreground' : 
                      playerInfo.gameplay === 'MED' ? 'bg-warning/10 text-warning border-warning/20' : 
                      'bg-destructive/10 text-destructive border-destructive/20'}
                  `}>
                    Gameplay: {playerInfo.gameplay}
                  </Badge>
                  {playerInfo.punished && (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                      Currently Punished
                    </Badge>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">UUID:</span>
                    <span className="ml-1">{playerInfo.uuid}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">First Join:</span>
                    <span className="ml-1">{playerInfo.firstJoined}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Join:</span>
                    <span className="ml-1">{playerInfo.lastOnline}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Playtime:</span>
                    <span className="ml-1">{playerInfo.playtime}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Real IP:</span>
                    <span className="ml-1">{playerInfo.ip}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Server:</span>
                    <span className="ml-1">{playerInfo.lastServer}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <Tabs defaultValue="overview" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-7 gap-1 px-1">
            <TabsTrigger value="overview" className="text-xs py-1">Overview</TabsTrigger>
            <TabsTrigger value="history" className="text-xs py-1">
              <History className="h-3 w-3 mr-1" />
              History
            </TabsTrigger>
            <TabsTrigger value="linked" className="text-xs py-1">
              <Link2 className="h-3 w-3 mr-1" />
              Linked
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-xs py-1">
              <StickyNote className="h-3 w-3 mr-1" />
              Notes
            </TabsTrigger>
            <TabsTrigger value="tickets" className="text-xs py-1">
              <Ticket className="h-3 w-3 mr-1" />
              Tickets
            </TabsTrigger>
            <TabsTrigger value="names" className="text-xs py-1">
              <UserRound className="h-3 w-3 mr-1" />
              Names
            </TabsTrigger>
            <TabsTrigger value="punishment" className="text-xs py-1">
              <Shield className="h-3 w-3 mr-1" />
              Punish
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-2 mt-2">
            <h4 className="font-medium">Recent Moderation Actions</h4>
            {playerInfo.warnings.length > 0 ? playerInfo.warnings.map((warning, index) => (
              <div 
                key={index} 
                className="bg-warning/10 border-l-4 border-warning p-3 rounded-r-lg"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                      {warning.type}
                    </Badge>
                    <p className="text-sm mt-1">{warning.reason}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{warning.date}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">By: {warning.by}</p>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground py-2">No recent moderation actions.</p>
            )}
          </TabsContent>
          
          <TabsContent value="history" className="space-y-2 mt-2">
            <h4 className="font-medium">Player History</h4>
            <div className="bg-muted/30 p-3 rounded-lg">
              <p className="text-sm">Detailed moderation history will be displayed here.</p>
            </div>
          </TabsContent>
          
          <TabsContent value="linked" className="space-y-2 mt-2">
            <h4 className="font-medium">Linked Accounts</h4>
            <div className="bg-muted/30 p-3 rounded-lg">
              <ul className="space-y-2">
                {playerInfo.linkedAccounts.map((account, idx) => (
                  <li key={idx} className="text-sm flex items-center">
                    <Link2 className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                    {account}
                  </li>
                ))}
              </ul>
            </div>
          </TabsContent>
          
          <TabsContent value="notes" className="space-y-2 mt-2">
            <h4 className="font-medium">Staff Notes</h4>
            <div className="bg-muted/30 p-3 rounded-lg">
              <ul className="space-y-2">
                {playerInfo.notes.map((note, idx) => (
                  <li key={idx} className="text-sm flex items-start">
                    <StickyNote className="h-3.5 w-3.5 mr-2 mt-0.5 text-muted-foreground" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Button size="sm" variant="outline" className="mt-2">
              <StickyNote className="h-3.5 w-3.5 mr-1" /> Add Note
            </Button>
          </TabsContent>
          
          <TabsContent value="tickets" className="space-y-2 mt-2">
            <h4 className="font-medium">Player Tickets</h4>
            <div className="bg-muted/30 p-3 rounded-lg">
              <p className="text-sm">No tickets found for this player.</p>
            </div>
          </TabsContent>
          
          <TabsContent value="names" className="space-y-2 mt-2">
            <h4 className="font-medium">Previous Names</h4>
            <div className="bg-muted/30 p-3 rounded-lg">
              <ul className="space-y-2">
                {playerInfo.previousNames.map((name, idx) => (
                  <li key={idx} className="text-sm flex items-center">
                    <UserRound className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          </TabsContent>
          
          <TabsContent value="punishment" className="space-y-3 mt-2">
            <h4 className="font-medium">Create Punishment</h4>
            <div className="bg-muted/30 p-4 rounded-lg space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Punishment Type</label>
                  <select className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm">
                    <option>Warning</option>
                    <option>Mute</option>
                    <option>Kick</option>
                    <option>Temporary Ban</option>
                    <option>Permanent Ban</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Duration</label>
                  <div className="flex gap-2">
                    <input type="number" placeholder="Duration" className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm" />
                    <select className="w-24 rounded-md border border-border bg-background px-3 py-1.5 text-sm">
                      <option>Hours</option>
                      <option>Days</option>
                      <option>Weeks</option>
                      <option>Months</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Reason</label>
                <textarea className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm h-20" placeholder="Enter a detailed reason for this punishment..."></textarea>
              </div>
              
              <div className="flex justify-end pt-2 gap-2">
                <Button variant="default" size="sm" className="bg-warning text-white hover:bg-warning/90">
                  <TriangleAlert className="h-4 w-4 mr-1" /> Warn
                </Button>
                <Button variant="default" size="sm" className="bg-info text-white hover:bg-info/90">
                  <RefreshCcw className="h-4 w-4 mr-1" /> Mute
                </Button>
                <Button variant="destructive" size="sm">
                  <Ban className="h-4 w-4 mr-1" /> Ban Player
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ResizableWindow>
  );
};

export default PlayerWindow;