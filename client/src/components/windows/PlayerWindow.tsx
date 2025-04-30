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
  newNote?: string;
  isAddingNote?: boolean;
  selectedPunishmentCategory?: string;
  selectedSeverity?: 'Lenient' | 'Regular' | 'Aggravated';
  duration?: {
    value: number;
    unit: 'hours' | 'days' | 'weeks' | 'months';
  };
  isPermanent?: boolean;
  reason?: string;
  evidence?: string;
  attachedReports?: string[];
  banLinkedAccounts?: boolean;
  wipeAccountAfterExpiry?: boolean;
  kickSameIP?: boolean;
  banToLink?: string;
  staffNotes?: string;
  silentPunishment?: boolean;
}

const PlayerWindow = ({ playerId, isOpen, onClose, initialPosition }: PlayerWindowProps) => {
  const [activeTab, setActiveTab] = useState('history');
  const [banSearchResults, setBanSearchResults] = useState<{id: string; player: string}[]>([]);
  const [showBanSearchResults, setShowBanSearchResults] = useState(false);
  
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo>({
    username: 'DragonSlayer123',
    status: 'Online',
    region: 'Europe',
    country: 'Germany',
    firstJoined: '2023-01-15',
    lastOnline: '2 hours ago',
    lastServer: 'Survival (EU-3)',
    playtime: '342 hours',
    social: 'Low',
    gameplay: 'Medium',
    punished: false,
    previousNames: ['Dragon55', 'SlayerXD'],
    warnings: [
      { type: 'Warning', reason: 'Excessive caps in chat', date: '2023-04-12', by: 'Moderator2' },
      { type: 'Mute', reason: 'Inappropriate language in global chat', date: '2023-03-28', by: 'ServerAI (30 minutes)' },
    ],
    linkedAccounts: ['Dragon55#1234 (Discord)', 'dragonslayer123 (Website)'],
    notes: ['Player has been consistently helpful to new players', 'Frequently reports bugs and exploits']
  });

  // Mock function to simulate ban search results
  const searchBans = (query: string) => {
    if (!query || query.length < 2) {
      setBanSearchResults([]);
      return;
    }
    
    // Simulate API call delay
    setTimeout(() => {
      // Mock data for demonstration
      const results = [
        { id: 'ban-123', player: 'MineKnight45' },
        { id: 'ban-456', player: 'DiamondMiner99' },
        { id: 'ban-789', player: 'CraftMaster21' },
        { id: 'ban-012', player: 'StoneBlazer76' }
      ].filter(item => 
        item.id.toLowerCase().includes(query.toLowerCase()) || 
        item.player.toLowerCase().includes(query.toLowerCase())
      );
      
      setBanSearchResults(results);
      setShowBanSearchResults(results.length > 0);
    }, 300);
  };
  
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
                  <Badge variant="outline" className={playerInfo.status === 'Online' ? 
                    "bg-success/10 text-success border-success/20" : 
                    "bg-muted/50 text-muted-foreground border-muted/30"
                  }>
                    {playerInfo.status === 'Online' ? 
                      "Online" : 
                      "Offline"
                    }
                  </Badge>
                  <Badge variant="outline" className={
                    playerInfo.social.toLowerCase() === 'low' ? 
                      "bg-success/10 text-success border-success/20" : 
                    playerInfo.social.toLowerCase() === 'medium' ? 
                      "bg-warning/10 text-warning border-warning/20" : 
                      "bg-destructive/10 text-destructive border-destructive/20"
                  }>
                    Social: {playerInfo.social}
                  </Badge>
                  <Badge variant="outline" className={
                    playerInfo.gameplay.toLowerCase() === 'low' ? 
                      "bg-success/10 text-success border-success/20" : 
                    playerInfo.gameplay.toLowerCase() === 'medium' ? 
                      "bg-warning/10 text-warning border-warning/20" : 
                      "bg-destructive/10 text-destructive border-destructive/20"
                  }>
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
              
              {playerInfo.isAddingNote && (
                <div className="mt-3 border-t border-border pt-3">
                  <textarea 
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm h-20"
                    placeholder="Enter your note here..."
                    value={playerInfo.newNote || ''}
                    onChange={(e) => setPlayerInfo(prev => ({...prev, newNote: e.target.value}))}
                  ></textarea>
                  <div className="flex justify-end mt-2 gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setPlayerInfo(prev => ({
                        ...prev, 
                        isAddingNote: false,
                        newNote: ''
                      }))}
                    >
                      Cancel
                    </Button>
                    <Button 
                      size="sm"
                      disabled={!playerInfo.newNote?.trim()}
                      onClick={() => {
                        const currentDate = new Date();
                        const formattedDate = `${currentDate.toLocaleDateString()} at ${currentDate.toLocaleTimeString()}`;
                        const newNoteWithMetadata = `${playerInfo.newNote} (Added by Admin on ${formattedDate})`;
                        
                        setPlayerInfo(prev => ({
                          ...prev,
                          notes: [...prev.notes, newNoteWithMetadata],
                          isAddingNote: false,
                          newNote: ''
                        }));
                      }}
                    >
                      Save Note
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {!playerInfo.isAddingNote && (
              <Button 
                size="sm" 
                variant="outline" 
                className="mt-2"
                onClick={() => setPlayerInfo(prev => ({...prev, isAddingNote: true}))}
              >
                <StickyNote className="h-3.5 w-3.5 mr-1" /> Add Note
              </Button>
            )}
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
                          className={`py-1 text-xs ${playerInfo.status !== 'Online' ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={() => {
                            if (playerInfo.status === 'Online') {
                              setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Kick'}));
                            }
                          }}
                          title={playerInfo.status !== 'Online' ? 'Player must be online to kick' : ''}
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
                      onClick={() => setPlayerInfo(prev => ({
                        ...prev, 
                        selectedPunishmentCategory: undefined, 
                        selectedSeverity: undefined,
                        duration: undefined,
                        reason: undefined,
                        evidence: undefined,
                        attachedReports: undefined,
                        banLinkedAccounts: undefined,
                        wipeAccountAfterExpiry: undefined,
                        kickSameIP: undefined,
                        banToLink: undefined,
                        staffNotes: undefined,
                        silentPunishment: undefined
                      }))}
                    >
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                        <path d="M6.85355 3.14645C7.04882 3.34171 7.04882 3.65829 6.85355 3.85355L3.70711 7H12.5C12.7761 7 13 7.22386 13 7.5C13 7.77614 12.7761 8 12.5 8H3.70711L6.85355 11.1464C7.04882 11.3417 7.04882 11.6583 6.85355 11.8536C6.65829 12.0488 6.34171 12.0488 6.14645 11.8536L2.14645 7.85355C1.95118 7.65829 1.95118 7.34171 2.14645 7.14645L6.14645 3.14645C6.34171 2.95118 6.65829 2.95118 6.85355 3.14645Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                      </svg>
                    </Button>
                    <h3 className="text-sm font-medium">{playerInfo.selectedPunishmentCategory}</h3>
                  </div>
                  
                  {/* Kick */}
                  {playerInfo.selectedPunishmentCategory === 'Kick' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Reason (shown to player)</label>
                        <textarea 
                          className={`w-full rounded-md border border-border bg-background px-3 py-2 text-sm h-16 ${playerInfo.status !== 'Online' ? 'opacity-50' : ''}`}
                          placeholder="Enter reason for kick"
                          disabled={playerInfo.status !== 'Online'}
                          value={playerInfo.reason || ''}
                          onChange={(e) => setPlayerInfo(prev => ({...prev, reason: e.target.value}))}
                        ></textarea>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <input 
                            type="checkbox" 
                            id="kick-same-ip" 
                            className="rounded mr-2"
                            disabled={playerInfo.status !== 'Online'} 
                            checked={!!playerInfo.kickSameIP}
                            onChange={(e) => setPlayerInfo(prev => ({...prev, kickSameIP: e.target.checked}))}
                          />
                          <label htmlFor="kick-same-ip" className={`text-sm ${playerInfo.status !== 'Online' ? 'opacity-50' : ''}`}>
                            Kick Same IP
                          </label>
                        </div>
                      </div>

                      {playerInfo.status !== 'Online' && (
                        <div className="bg-warning/10 p-3 rounded-lg text-sm text-warning">
                          Player is not currently online. Kick action is only available for online players.
                        </div>
                      )}
                    </>
                  )}

                  {/* Manual Mute */}
                  {playerInfo.selectedPunishmentCategory === 'Manual Mute' && (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">Duration</label>
                          <div className="flex items-center">
                            <input 
                              type="checkbox" 
                              id="permanent-mute" 
                              className="rounded mr-2"
                              checked={!!playerInfo.isPermanent}
                              onChange={(e) => {
                                const isPermanent = e.target.checked;
                                setPlayerInfo(prev => ({
                                  ...prev, 
                                  isPermanent,
                                  duration: !isPermanent ? {
                                    value: prev.duration?.value || 24,
                                    unit: prev.duration?.unit || 'hours'
                                  } : undefined
                                }));
                              }}
                            />
                            <label htmlFor="permanent-mute" className="text-sm">Permanent</label>
                          </div>
                        </div>
                        
                        {!playerInfo.isPermanent && (
                          <div className="flex gap-2">
                            <input 
                              type="number" 
                              placeholder="Duration" 
                              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                              value={playerInfo.duration?.value || ''}
                              onChange={(e) => setPlayerInfo(prev => ({
                                ...prev, 
                                duration: {
                                  value: parseInt(e.target.value) || 0,
                                  unit: prev.duration?.unit || 'hours'
                                }
                              }))}
                              min={1}
                            />
                            <select 
                              className="w-24 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                              value={playerInfo.duration?.unit || 'hours'}
                              onChange={(e) => setPlayerInfo(prev => ({
                                ...prev, 
                                duration: {
                                  value: prev.duration?.value || 1,
                                  unit: e.target.value as 'hours' | 'days' | 'weeks' | 'months'
                                }
                              }))}
                            >
                              <option value="hours">Hours</option>
                              <option value="days">Days</option>
                              <option value="weeks">Weeks</option>
                              <option value="months">Months</option>
                            </select>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Reason (shown to player)</label>
                        <textarea 
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm h-16"
                          placeholder="Enter reason for mute"
                          value={playerInfo.reason || ''}
                          onChange={(e) => setPlayerInfo(prev => ({...prev, reason: e.target.value}))}
                        ></textarea>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Evidence</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm" 
                            placeholder="URLs, screenshots, or text evidence"
                            value={playerInfo.evidence || ''}
                            onChange={(e) => setPlayerInfo(prev => ({...prev, evidence: e.target.value}))}
                          />
                          <Button variant="outline" size="sm" className="whitespace-nowrap">
                            <Upload className="h-3.5 w-3.5 mr-1" />
                            Upload
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">Attach Reports</label>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setPlayerInfo(prev => ({
                              ...prev, 
                              attachedReports: [...(prev.attachedReports || []), 'ticket-new']
                            }))}
                            className="text-xs h-7 px-2"
                          >
                            + Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {(playerInfo.attachedReports || []).map((report, index) => (
                            <div key={index} className="flex gap-2 items-center">
                              <select 
                                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                                value={report}
                                onChange={(e) => {
                                  const newReports = [...(playerInfo.attachedReports || [])];
                                  newReports[index] = e.target.value;
                                  setPlayerInfo(prev => ({...prev, attachedReports: newReports}));
                                }}
                              >
                                <option value="">Select a report</option>
                                <option value="ticket-123">Ticket #123 - Chat Report</option>
                                <option value="ticket-456">Ticket #456 - Chat Report</option>
                              </select>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="p-0 h-8 w-8 text-destructive"
                                onClick={() => {
                                  const newReports = [...(playerInfo.attachedReports || [])];
                                  newReports.splice(index, 1);
                                  setPlayerInfo(prev => ({...prev, attachedReports: newReports}));
                                }}
                              >
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                                  <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                                </svg>
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Manual Ban */}
                  {playerInfo.selectedPunishmentCategory === 'Manual Ban' && (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">Duration</label>
                          <div className="flex items-center">
                            <input 
                              type="checkbox" 
                              id="permanent-ban" 
                              className="rounded mr-2"
                              checked={!!playerInfo.isPermanent}
                              onChange={(e) => {
                                const isPermanent = e.target.checked;
                                setPlayerInfo(prev => ({
                                  ...prev, 
                                  isPermanent,
                                  duration: !isPermanent ? {
                                    value: prev.duration?.value || 24,
                                    unit: prev.duration?.unit || 'hours'
                                  } : undefined
                                }));
                              }}
                            />
                            <label htmlFor="permanent-ban" className="text-sm">Permanent</label>
                          </div>
                        </div>
                        
                        {!playerInfo.isPermanent && (
                          <div className="flex gap-2">
                            <input 
                              type="number" 
                              placeholder="Duration" 
                              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                              value={playerInfo.duration?.value || ''}
                              onChange={(e) => setPlayerInfo(prev => ({
                                ...prev, 
                                duration: {
                                  value: parseInt(e.target.value) || 0,
                                  unit: prev.duration?.unit || 'hours'
                                }
                              }))}
                              min={1}
                            />
                            <select 
                              className="w-24 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                              value={playerInfo.duration?.unit || 'hours'}
                              onChange={(e) => setPlayerInfo(prev => ({
                                ...prev, 
                                duration: {
                                  value: prev.duration?.value || 1,
                                  unit: e.target.value as 'hours' | 'days' | 'weeks' | 'months'
                                }
                              }))}
                            >
                              <option value="hours">Hours</option>
                              <option value="days">Days</option>
                              <option value="weeks">Weeks</option>
                              <option value="months">Months</option>
                            </select>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Reason (shown to player)</label>
                        <textarea 
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm h-16"
                          placeholder="Enter reason for ban"
                          value={playerInfo.reason || ''}
                          onChange={(e) => setPlayerInfo(prev => ({...prev, reason: e.target.value}))}
                        ></textarea>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Evidence</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm" 
                            placeholder="URLs, screenshots, or text evidence"
                            value={playerInfo.evidence || ''}
                            onChange={(e) => setPlayerInfo(prev => ({...prev, evidence: e.target.value}))}
                          />
                          <Button variant="outline" size="sm" className="whitespace-nowrap">
                            <Upload className="h-3.5 w-3.5 mr-1" />
                            Upload
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">Attach Reports</label>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setPlayerInfo(prev => ({
                              ...prev, 
                              attachedReports: [...(prev.attachedReports || []), 'ticket-new']
                            }))}
                            className="text-xs h-7 px-2"
                          >
                            + Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {(playerInfo.attachedReports || []).map((report, index) => (
                            <div key={index} className="flex gap-2 items-center">
                              <select 
                                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                                value={report}
                                onChange={(e) => {
                                  const newReports = [...(playerInfo.attachedReports || [])];
                                  newReports[index] = e.target.value;
                                  setPlayerInfo(prev => ({...prev, attachedReports: newReports}));
                                }}
                              >
                                <option value="">Select a report</option>
                                <option value="ticket-123">Ticket #123 - Chat Report</option>
                                <option value="ticket-456">Ticket #456 - Player Report</option>
                                <option value="ticket-789">Ticket #789 - Player Report</option>
                              </select>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="p-0 h-8 w-8 text-destructive"
                                onClick={() => {
                                  const newReports = [...(playerInfo.attachedReports || [])];
                                  newReports.splice(index, 1);
                                  setPlayerInfo(prev => ({...prev, attachedReports: newReports}));
                                }}
                              >
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                                  <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                                </svg>
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center">
                          <input 
                            type="checkbox" 
                            id="ban-linked" 
                            className="rounded mr-2"
                            checked={!!playerInfo.banLinkedAccounts}
                            onChange={(e) => setPlayerInfo(prev => ({...prev, banLinkedAccounts: e.target.checked}))}
                          />
                          <label htmlFor="ban-linked" className="text-sm">Ban Linked Accounts</label>
                        </div>
                        
                        <div className="flex items-center">
                          <input 
                            type="checkbox" 
                            id="wipe-account" 
                            className="rounded mr-2"
                            checked={!!playerInfo.wipeAccountAfterExpiry}
                            onChange={(e) => setPlayerInfo(prev => ({...prev, wipeAccountAfterExpiry: e.target.checked}))}
                          />
                          <label htmlFor="wipe-account" className="text-sm">Wipe Account After Expiry</label>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Security Ban, Bad Skin, Bad Name */}
                  {(playerInfo.selectedPunishmentCategory === 'Security Ban' || 
                    playerInfo.selectedPunishmentCategory === 'Bad Skin' || 
                    playerInfo.selectedPunishmentCategory === 'Bad Name') && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Evidence</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm" 
                            placeholder="URLs, screenshots, or text evidence"
                            value={playerInfo.evidence || ''}
                            onChange={(e) => setPlayerInfo(prev => ({...prev, evidence: e.target.value}))}
                          />
                          <Button variant="outline" size="sm" className="whitespace-nowrap">
                            <Upload className="h-3.5 w-3.5 mr-1" />
                            Upload
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">Attach Reports</label>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setPlayerInfo(prev => ({
                              ...prev, 
                              attachedReports: [...(prev.attachedReports || []), 'ticket-new']
                            }))}
                            className="text-xs h-7 px-2"
                          >
                            + Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {(playerInfo.attachedReports || []).map((report, index) => (
                            <div key={index} className="flex gap-2 items-center">
                              <select 
                                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                                value={report}
                                onChange={(e) => {
                                  const newReports = [...(playerInfo.attachedReports || [])];
                                  newReports[index] = e.target.value;
                                  setPlayerInfo(prev => ({...prev, attachedReports: newReports}));
                                }}
                              >
                                <option value="">Select a report</option>
                                <option value="ticket-123">Ticket #123 - Chat Report</option>
                                <option value="ticket-456">Ticket #456 - Player Report</option>
                              </select>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="p-0 h-8 w-8 text-destructive"
                                onClick={() => {
                                  const newReports = [...(playerInfo.attachedReports || [])];
                                  newReports.splice(index, 1);
                                  setPlayerInfo(prev => ({...prev, attachedReports: newReports}));
                                }}
                              >
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                                  <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                                </svg>
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Linked Ban */}
                  {playerInfo.selectedPunishmentCategory === 'Linked Ban' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Ban to Link</label>
                        <div className="relative">
                          <input 
                            type="text" 
                            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm" 
                            placeholder="Search by username or ban-id"
                            value={playerInfo.banToLink || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              setPlayerInfo(prev => ({...prev, banToLink: value}));
                              searchBans(value);
                            }}
                            onFocus={() => {
                              if (playerInfo.banToLink) {
                                searchBans(playerInfo.banToLink);
                              }
                            }}
                            onBlur={() => {
                              // Delay hiding to allow for click on the dropdown items
                              setTimeout(() => setShowBanSearchResults(false), 200);
                            }}
                          />
                          
                          {showBanSearchResults && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-background rounded-md border border-border shadow-md max-h-40 overflow-y-auto">
                              {banSearchResults.map((result) => (
                                <div 
                                  key={result.id}
                                  className="px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                                  onClick={() => {
                                    setPlayerInfo(prev => ({...prev, banToLink: `${result.id} (${result.player})`}));
                                    setShowBanSearchResults(false);
                                  }}
                                >
                                  <div className="font-medium">{result.id}</div>
                                  <div className="text-xs text-muted-foreground">{result.player}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Evidence</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm" 
                            placeholder="URLs, screenshots, or text evidence"
                            value={playerInfo.evidence || ''}
                            onChange={(e) => setPlayerInfo(prev => ({...prev, evidence: e.target.value}))}
                          />
                          <Button variant="outline" size="sm" className="whitespace-nowrap">
                            <Upload className="h-3.5 w-3.5 mr-1" />
                            Upload
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">Attach Reports</label>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setPlayerInfo(prev => ({
                              ...prev, 
                              attachedReports: [...(prev.attachedReports || []), 'ticket-new']
                            }))}
                            className="text-xs h-7 px-2"
                          >
                            + Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {(playerInfo.attachedReports || []).map((report, index) => (
                            <div key={index} className="flex gap-2 items-center">
                              <select 
                                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                                value={report}
                                onChange={(e) => {
                                  const newReports = [...(playerInfo.attachedReports || [])];
                                  newReports[index] = e.target.value;
                                  setPlayerInfo(prev => ({...prev, attachedReports: newReports}));
                                }}
                              >
                                <option value="">Select a report</option>
                                <option value="ticket-123">Ticket #123 - Chat Report</option>
                                <option value="ticket-456">Ticket #456 - Player Report</option>
                              </select>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="p-0 h-8 w-8 text-destructive"
                                onClick={() => {
                                  const newReports = [...(playerInfo.attachedReports || [])];
                                  newReports.splice(index, 1);
                                  setPlayerInfo(prev => ({...prev, attachedReports: newReports}));
                                }}
                              >
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                                  <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                                </svg>
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Blacklist */}
                  {playerInfo.selectedPunishmentCategory === 'Blacklist' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Reason (shown to player)</label>
                        <textarea 
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm h-16"
                          placeholder="Enter reason for blacklist"
                          value={playerInfo.reason || ''}
                          onChange={(e) => setPlayerInfo(prev => ({...prev, reason: e.target.value}))}
                        ></textarea>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Evidence</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm" 
                            placeholder="URLs, screenshots, or text evidence"
                            value={playerInfo.evidence || ''}
                            onChange={(e) => setPlayerInfo(prev => ({...prev, evidence: e.target.value}))}
                          />
                          <Button variant="outline" size="sm" className="whitespace-nowrap">
                            <Upload className="h-3.5 w-3.5 mr-1" />
                            Upload
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">Attach Reports</label>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setPlayerInfo(prev => ({
                              ...prev, 
                              attachedReports: [...(prev.attachedReports || []), 'ticket-new']
                            }))}
                            className="text-xs h-7 px-2"
                          >
                            + Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {(playerInfo.attachedReports || []).map((report, index) => (
                            <div key={index} className="flex gap-2 items-center">
                              <select 
                                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                                value={report}
                                onChange={(e) => {
                                  const newReports = [...(playerInfo.attachedReports || [])];
                                  newReports[index] = e.target.value;
                                  setPlayerInfo(prev => ({...prev, attachedReports: newReports}));
                                }}
                              >
                                <option value="">Select a report</option>
                                <option value="ticket-123">Ticket #123 - Chat Report</option>
                                <option value="ticket-456">Ticket #456 - Player Report</option>
                              </select>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="p-0 h-8 w-8 text-destructive"
                                onClick={() => {
                                  const newReports = [...(playerInfo.attachedReports || [])];
                                  newReports.splice(index, 1);
                                  setPlayerInfo(prev => ({...prev, attachedReports: newReports}));
                                }}
                              >
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                                  <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                                </svg>
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center">
                          <input 
                            type="checkbox" 
                            id="ban-linked" 
                            className="rounded mr-2"
                            checked={!!playerInfo.banLinkedAccounts}
                            onChange={(e) => setPlayerInfo(prev => ({...prev, banLinkedAccounts: e.target.checked}))}
                          />
                          <label htmlFor="ban-linked" className="text-sm">Ban Linked Accounts</label>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Chat Abuse, Anti Social */}
                  {(playerInfo.selectedPunishmentCategory === 'Chat Abuse' || 
                    playerInfo.selectedPunishmentCategory === 'Anti Social') && (
                    <>
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
                        <label className="text-sm font-medium">Evidence</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm" 
                            placeholder="URLs, screenshots, or text evidence"
                            value={playerInfo.evidence || ''}
                            onChange={(e) => setPlayerInfo(prev => ({...prev, evidence: e.target.value}))}
                          />
                          <Button variant="outline" size="sm" className="whitespace-nowrap">
                            <Upload className="h-3.5 w-3.5 mr-1" />
                            Upload
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">Attach Reports</label>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setPlayerInfo(prev => ({
                              ...prev, 
                              attachedReports: [...(prev.attachedReports || []), 'ticket-new']
                            }))}
                            className="text-xs h-7 px-2"
                          >
                            + Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {(playerInfo.attachedReports || []).map((report, index) => (
                            <div key={index} className="flex gap-2 items-center">
                              <select 
                                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                                value={report}
                                onChange={(e) => {
                                  const newReports = [...(playerInfo.attachedReports || [])];
                                  newReports[index] = e.target.value;
                                  setPlayerInfo(prev => ({...prev, attachedReports: newReports}));
                                }}
                              >
                                <option value="">Select a report</option>
                                <option value="ticket-123">Ticket #123 - Chat Report</option>
                                <option value="ticket-456">Ticket #456 - Chat Report</option>
                              </select>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="p-0 h-8 w-8 text-destructive"
                                onClick={() => {
                                  const newReports = [...(playerInfo.attachedReports || [])];
                                  newReports.splice(index, 1);
                                  setPlayerInfo(prev => ({...prev, attachedReports: newReports}));
                                }}
                              >
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                                  <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                                </svg>
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Targeting, Bad Content */}
                  {(playerInfo.selectedPunishmentCategory === 'Targeting' || 
                    playerInfo.selectedPunishmentCategory === 'Bad Content') && (
                    <>
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
                        <label className="text-sm font-medium">Evidence</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm" 
                            placeholder="URLs, screenshots, or text evidence"
                            value={playerInfo.evidence || ''}
                            onChange={(e) => setPlayerInfo(prev => ({...prev, evidence: e.target.value}))}
                          />
                          <Button variant="outline" size="sm" className="whitespace-nowrap">
                            <Upload className="h-3.5 w-3.5 mr-1" />
                            Upload
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">Attach Reports</label>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setPlayerInfo(prev => ({
                              ...prev, 
                              attachedReports: [...(prev.attachedReports || []), 'ticket-new']
                            }))}
                            className="text-xs h-7 px-2"
                          >
                            + Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {(playerInfo.attachedReports || []).map((report, index) => (
                            <div key={index} className="flex gap-2 items-center">
                              <select 
                                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                                value={report}
                                onChange={(e) => {
                                  const newReports = [...(playerInfo.attachedReports || [])];
                                  newReports[index] = e.target.value;
                                  setPlayerInfo(prev => ({...prev, attachedReports: newReports}));
                                }}
                              >
                                <option value="">Select a report</option>
                                <option value="ticket-123">Ticket #123 - Chat Report</option>
                                <option value="ticket-456">Ticket #456 - Chat Report</option>
                              </select>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="p-0 h-8 w-8 text-destructive"
                                onClick={() => {
                                  const newReports = [...(playerInfo.attachedReports || [])];
                                  newReports.splice(index, 1);
                                  setPlayerInfo(prev => ({...prev, attachedReports: newReports}));
                                }}
                              >
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                                  <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                                </svg>
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <input 
                            type="checkbox" 
                            id="ban-linked" 
                            className="rounded mr-2"
                            checked={!!playerInfo.banLinkedAccounts}
                            onChange={(e) => setPlayerInfo(prev => ({...prev, banLinkedAccounts: e.target.checked}))}
                          />
                          <label htmlFor="ban-linked" className="text-sm">Ban Linked Accounts</label>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Team Abuse, Game Abuse, Cheating, Game Trading, Account Abuse, Scamming */}
                  {(playerInfo.selectedPunishmentCategory === 'Team Abuse' || 
                    playerInfo.selectedPunishmentCategory === 'Game Abuse' || 
                    playerInfo.selectedPunishmentCategory === 'Cheating' ||
                    playerInfo.selectedPunishmentCategory === 'Game Trading' ||
                    playerInfo.selectedPunishmentCategory === 'Account Abuse' ||
                    playerInfo.selectedPunishmentCategory === 'Scamming') && (
                    <>
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
                        <label className="text-sm font-medium">Evidence</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm" 
                            placeholder="URLs, screenshots, or text evidence"
                            value={playerInfo.evidence || ''}
                            onChange={(e) => setPlayerInfo(prev => ({...prev, evidence: e.target.value}))}
                          />
                          <Button variant="outline" size="sm" className="whitespace-nowrap">
                            <Upload className="h-3.5 w-3.5 mr-1" />
                            Upload
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">Attach Reports</label>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setPlayerInfo(prev => ({
                              ...prev, 
                              attachedReports: [...(prev.attachedReports || []), 'ticket-new']
                            }))}
                            className="text-xs h-7 px-2"
                          >
                            + Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {(playerInfo.attachedReports || []).map((report, index) => (
                            <div key={index} className="flex gap-2 items-center">
                              <select 
                                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                                value={report}
                                onChange={(e) => {
                                  const newReports = [...(playerInfo.attachedReports || [])];
                                  newReports[index] = e.target.value;
                                  setPlayerInfo(prev => ({...prev, attachedReports: newReports}));
                                }}
                              >
                                <option value="">Select a report</option>
                                <option value="ticket-123">Ticket #123 - Chat Report</option>
                                <option value="ticket-456">Ticket #456 - Player Report</option>
                              </select>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="p-0 h-8 w-8 text-destructive"
                                onClick={() => {
                                  const newReports = [...(playerInfo.attachedReports || [])];
                                  newReports.splice(index, 1);
                                  setPlayerInfo(prev => ({...prev, attachedReports: newReports}));
                                }}
                              >
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                                  <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                                </svg>
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <input 
                            type="checkbox" 
                            id="ban-linked" 
                            className="rounded mr-2"
                            checked={!!playerInfo.banLinkedAccounts}
                            onChange={(e) => setPlayerInfo(prev => ({...prev, banLinkedAccounts: e.target.checked}))}
                          />
                          <label htmlFor="ban-linked" className="text-sm">Ban Linked Accounts</label>
                        </div>
                        
                        <div className="flex items-center">
                          <input 
                            type="checkbox" 
                            id="wipe-account" 
                            className="rounded mr-2"
                            checked={!!playerInfo.wipeAccountAfterExpiry}
                            onChange={(e) => setPlayerInfo(prev => ({...prev, wipeAccountAfterExpiry: e.target.checked}))}
                          />
                          <label htmlFor="wipe-account" className="text-sm">Wipe Account After Expiry</label>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Common fields for all punishment types */}
                  {playerInfo.selectedPunishmentCategory && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Notes (staff use only)</label>
                        <textarea 
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm h-16"
                          placeholder="Internal notes visible only to staff"
                          value={playerInfo.staffNotes || ''}
                          onChange={(e) => setPlayerInfo(prev => ({...prev, staffNotes: e.target.value}))}
                        ></textarea>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <input 
                            type="checkbox" 
                            id="silent" 
                            className="rounded mr-2"
                            checked={!!playerInfo.silentPunishment}
                            onChange={(e) => setPlayerInfo(prev => ({...prev, silentPunishment: e.target.checked}))}
                          />
                          <label htmlFor="silent" className="text-sm">Silent (No Notification)</label>
                        </div>
                      </div>
                      
                      <div className="pt-2">
                        <Button className="w-full">
                          Apply Punishment
                        </Button>
                      </div>
                    </>
                  )}
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