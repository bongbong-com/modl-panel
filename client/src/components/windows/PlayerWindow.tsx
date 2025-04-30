import { useState, useEffect } from 'react';
import { 
  Eye, TriangleAlert, Ban, RefreshCcw, Search, LockOpen, History, 
  Link2, StickyNote, Ticket, UserRound, Shield, FileText, Upload 
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

interface PlayerInfo {
  username: string;
  status: string;
  region: string;
  country: string;
  firstJoined: string;
  lastOnline: string;
  lastServer: string;
  playtime: string;
  social: string;
  gameplay: string;
  punished: boolean;
  previousNames: string[];
  warnings: Array<{ type: string; reason: string; date: string; by: string }>;
  linkedAccounts: string[];
  notes: string[];
  selectedPunishmentCategory?: string;
  selectedSeverity?: 'Lenient' | 'Regular' | 'Aggravated';
}

const PlayerWindow = ({ playerId, isOpen, onClose, initialPosition }: PlayerWindowProps) => {
  const [activeTab, setActiveTab] = useState('history');
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo>({
    username: 'DragonSlayer123',
    status: 'Online',
    region: 'Europe',
    country: 'Germany',
    firstJoined: '2023-01-15',
    lastOnline: '2 hours ago',
    lastServer: 'Survival (EU-3)',
    playtime: '342 hours',
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
                    {playerInfo.region}/{playerInfo.country}
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
                    <span className="text-muted-foreground">Region:</span>
                    <span className="ml-1">{playerInfo.region}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Country:</span>
                    <span className="ml-1">{playerInfo.country}</span>
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
                    <span className="text-muted-foreground">Last Server:</span>
                    <span className="ml-1">{playerInfo.lastServer}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <Tabs defaultValue="history" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-6 gap-1 px-1">
            <TabsTrigger value="history" className="text-xs py-2">
              <History className="h-3.5 w-3.5 mr-1.5" />
              History
            </TabsTrigger>
            <TabsTrigger value="linked" className="text-xs py-2">
              <Link2 className="h-3.5 w-3.5 mr-1.5" />
              Linked
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-xs py-2">
              <StickyNote className="h-3.5 w-3.5 mr-1.5" />
              Notes
            </TabsTrigger>
            <TabsTrigger value="tickets" className="text-xs py-2">
              <Ticket className="h-3.5 w-3.5 mr-1.5" />
              Tickets
            </TabsTrigger>
            <TabsTrigger value="names" className="text-xs py-2">
              <UserRound className="h-3.5 w-3.5 mr-1.5" />
              Names
            </TabsTrigger>
            <TabsTrigger value="punishment" className="text-xs py-2">
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              Punish
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="history" className="space-y-2 mx-1 mt-3">
            <h4 className="font-medium">Player History</h4>
            <div className="space-y-2">
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
                <div className="bg-muted/30 p-3 rounded-lg">
                  <p className="text-sm">No moderation history found for this player.</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="linked" className="space-y-2 mx-1 mt-3">
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
          
          <TabsContent value="notes" className="space-y-2 mx-1 mt-3">
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
          
          <TabsContent value="tickets" className="space-y-2 mx-1 mt-3">
            <h4 className="font-medium">Player Tickets</h4>
            <div className="bg-muted/30 p-3 rounded-lg">
              <p className="text-sm">No tickets found for this player.</p>
            </div>
          </TabsContent>
          
          <TabsContent value="names" className="space-y-2 mx-1 mt-3">
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
          
          <TabsContent value="punishment" className="space-y-3 mx-1 mt-3">
            <h4 className="font-medium">Create Punishment</h4>
            <div className="bg-muted/30 p-4 rounded-lg space-y-4">
              {!playerInfo.selectedPunishmentCategory ? (
                <>
                  {/* Stage 1: Category Selection */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Action Types</label>
                      <div className="grid grid-cols-6 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="py-1 text-xs" 
                          onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Kick'}))}
                        >
                          Kick
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="py-1 text-xs" 
                          onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Manual Mute'}))}
                        >
                          Manual Mute
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="py-1 text-xs" 
                          onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Manual Ban'}))}
                        >
                          Manual Ban
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="py-1 text-xs" 
                          onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Security Ban'}))}
                        >
                          Security Ban
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="py-1 text-xs" 
                          onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Linked Ban'}))}
                        >
                          Linked Ban
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="py-1 text-xs" 
                          onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Blacklist'}))}
                        >
                          Blacklist
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Chat & Social</label>
                      <div className="grid grid-cols-6 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="py-1 text-xs" 
                          onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Chat Abuse'}))}
                        >
                          Chat Abuse
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="py-1 text-xs" 
                          onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Anti Social'}))}
                        >
                          Anti Social
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="py-1 text-xs" 
                          onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Targeting'}))}
                        >
                          Targeting
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="py-1 text-xs" 
                          onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Bad Skin'}))}
                        >
                          Bad Skin
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="py-1 text-xs" 
                          onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Bad Name'}))}
                        >
                          Bad Name
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="py-1 text-xs" 
                          onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Bad Content'}))}
                        >
                          Bad Content
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Game & Account</label>
                      <div className="grid grid-cols-6 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="py-1 text-xs" 
                          onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Team Abuse'}))}
                        >
                          Team Abuse
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="py-1 text-xs" 
                          onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Game Abuse'}))}
                        >
                          Game Abuse
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="py-1 text-xs" 
                          onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Cheating'}))}
                        >
                          Cheating
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="py-1 text-xs" 
                          onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Game Trading'}))}
                        >
                          Game Trading
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="py-1 text-xs" 
                          onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Account Abuse'}))}
                        >
                          Account Abuse
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="py-1 text-xs" 
                          onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Scamming'}))}
                        >
                          Scamming
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                // Stage 2: Punishment Details
                <div className="space-y-4">
                  <div className="flex items-center">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="p-0 h-8 w-8 mr-2" 
                      onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: undefined, selectedSeverity: undefined}))}
                    >
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                        <path d="M6.85355 3.14645C7.04882 3.34171 7.04882 3.65829 6.85355 3.85355L3.70711 7H12.5C12.7761 7 13 7.22386 13 7.5C13 7.77614 12.7761 8 12.5 8H3.70711L6.85355 11.1464C7.04882 11.3417 7.04882 11.6583 6.85355 11.8536C6.65829 12.0488 6.34171 12.0488 6.14645 11.8536L2.14645 7.85355C1.95118 7.65829 1.95118 7.34171 2.14645 7.14645L6.14645 3.14645C6.34171 2.95118 6.65829 2.95118 6.85355 3.14645Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                      </svg>
                    </Button>
                    <h3 className="text-sm font-medium">{playerInfo.selectedPunishmentCategory}</h3>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Severity</label>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className={`flex-1 ${playerInfo.selectedSeverity === 'Lenient' ? 'bg-primary/20 border-primary/40' : ''}`}
                        onClick={() => setPlayerInfo(prev => ({...prev, selectedSeverity: 'Lenient'}))}
                      >
                        Lenient
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className={`flex-1 ${playerInfo.selectedSeverity === 'Regular' ? 'bg-primary/20 border-primary/40' : ''}`}
                        onClick={() => setPlayerInfo(prev => ({...prev, selectedSeverity: 'Regular'}))}
                      >
                        Regular
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className={`flex-1 ${playerInfo.selectedSeverity === 'Aggravated' ? 'bg-primary/20 border-primary/40' : ''}`}
                        onClick={() => setPlayerInfo(prev => ({...prev, selectedSeverity: 'Aggravated'}))}
                      >
                        Aggravated
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Reason</label>
                    <textarea 
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm h-16" 
                      placeholder="Enter a detailed reason for this punishment..."
                    ></textarea>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Evidence</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm" 
                        placeholder="URLs, screenshots, or text evidence" 
                      />
                      <Button variant="outline" size="sm" className="whitespace-nowrap">
                        <Upload className="h-3.5 w-3.5 mr-1" />
                        Upload
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Attach Ticket</label>
                    <div className="flex gap-2">
                      <select className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm">
                        <option value="">None</option>
                        <option value="ticket-123">Ticket #123 - Chat Report</option>
                        <option value="ticket-456">Ticket #456 - Player Report</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center">
                        <input type="checkbox" id="ban-linked" className="rounded mr-2" />
                        <label htmlFor="ban-linked" className="text-sm">Ban Linked Accounts</label>
                      </div>
                      
                      <div className="flex items-center">
                        <input type="checkbox" id="wipe-account" className="rounded mr-2" />
                        <label htmlFor="wipe-account" className="text-sm">Wipe Account After Expiry</label>
                      </div>
                      
                      <div className="flex items-center">
                        <input type="checkbox" id="silent" className="rounded mr-2" />
                        <label htmlFor="silent" className="text-sm">Silent (No Notification)</label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <Button className="w-full">
                      Apply Punishment
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ResizableWindow>
  );
};

export default PlayerWindow;