import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { 
  ArrowLeft, 
  History, 
  Link2, 
  StickyNote, 
  Ticket, 
  UserRound, 
  Shield,
  Upload, 
  Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlayer, useApplyPunishment } from '@/hooks/use-data';
import { toast } from '@/hooks/use-toast';

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

const PlayerDetailPage = () => {
  const [_, params] = useRoute('/player/:uuid');
  const [location, navigate] = useLocation();
  const playerId = params?.uuid || '';
  
  const [activeTab, setActiveTab] = useState('history');
  const [isApplyingPunishment, setIsApplyingPunishment] = useState(false);
  const [banSearchResults, setBanSearchResults] = useState<{id: string; player: string}[]>([]);
  const [showBanSearchResults, setShowBanSearchResults] = useState(false);

  // Initialize the applyPunishment mutation hook
  const applyPunishment = useApplyPunishment();
  
  // Handler for applying punishment
  const handleApplyPunishment = async () => {
    // Validate required fields
    if (!playerInfo.selectedPunishmentCategory) {
      toast({
        title: "Missing information",
        description: "Please select a punishment category",
        variant: "destructive"
      });
      return;
    }
    
    if (!playerInfo.reason) {
      toast({
        title: "Missing information",
        description: "Please provide a reason for the punishment",
        variant: "destructive"
      });
      return;
    }
    
    if (!playerInfo.isPermanent && (!playerInfo.duration?.value || !playerInfo.duration?.unit)) {
      toast({
        title: "Invalid duration",
        description: "Please specify a valid duration or select 'Permanent'",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsApplyingPunishment(true);
      
      // Prepare punishment data
      const punishmentData = {
        type: playerInfo.selectedPunishmentCategory,
        severity: playerInfo.selectedSeverity || 'Regular',
        reason: playerInfo.reason,
        evidence: playerInfo.evidence || '',
        notes: playerInfo.staffNotes || '',
        permanent: playerInfo.isPermanent || false,
        duration: playerInfo.isPermanent ? null : playerInfo.duration,
        silent: playerInfo.silentPunishment || false,
        banLinkedAccounts: playerInfo.banLinkedAccounts || false,
        wipeAccountAfterExpiry: playerInfo.wipeAccountAfterExpiry || false,
        kickSameIP: playerInfo.kickSameIP || false,
        relatedBan: playerInfo.banToLink || null,
        attachedReports: playerInfo.attachedReports || []
      };
      
      // Call the API
      await applyPunishment.mutateAsync({
        uuid: playerId,
        punishmentData
      });
      
      // Refetch player data
      refetch();
      
      // Show success message
      toast({
        title: "Punishment applied",
        description: `Successfully applied ${playerInfo.selectedPunishmentCategory} to ${playerInfo.username}`
      });
      
      // Reset the punishment form
      setPlayerInfo(prev => ({
        ...prev,
        selectedPunishmentCategory: undefined,
        selectedSeverity: undefined,
        duration: undefined,
        isPermanent: false,
        reason: '',
        evidence: '',
        attachedReports: [],
        banLinkedAccounts: false,
        wipeAccountAfterExpiry: false,
        kickSameIP: false,
        banToLink: '',
        staffNotes: '',
        silentPunishment: false
      }));
      
    } catch (error) {
      console.error('Error applying punishment:', error);
      toast({
        title: "Failed to apply punishment",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsApplyingPunishment(false);
    }
  };
  
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo>({
    username: 'Loading...',
    status: 'Unknown',
    region: 'Unknown',
    country: 'Unknown',
    firstJoined: 'Unknown',
    lastOnline: 'Unknown',
    lastServer: 'Unknown',
    playtime: 'Unknown',
    social: 'Medium',
    gameplay: 'Medium',
    punished: false,
    previousNames: [],
    warnings: [],
    linkedAccounts: [],
    notes: []
  });

  // Use React Query hook to fetch player data with refetch capability
  const { data: player, isLoading, error, refetch } = usePlayer(playerId);
  
  // Load player data into state when it changes
  useEffect(() => {
    if (player) {
      console.log('Player data received:', player);
      
      // Check if we're dealing with MongoDB data or the API response format
      if (player.usernames) {
        // This is MongoDB raw data that needs formatting
        const currentUsername = player.usernames && player.usernames.length > 0 
          ? player.usernames[player.usernames.length - 1].username 
          : 'Unknown';
        
        const firstJoined = player.usernames && player.usernames.length > 0 
          ? new Date(player.usernames[0].date).toLocaleDateString() 
          : 'Unknown';
        
        // Get previous usernames
        const previousNames = player.usernames && player.usernames.length > 1
          ? player.usernames
              .slice(0, -1) // All except the most recent
              .map((u: any) => u.username)
          : [];
        
        // Determine player status
        const status = player.punishments && player.punishments.some((p: any) => p.active && !p.expires) 
          ? 'Banned' 
          : player.punishments && player.punishments.some((p: any) => p.active) 
          ? 'Restricted' 
          : 'Active';
        
        // Format warnings from notes
        const warnings = player.notes ? player.notes.map((note: any) => ({
          type: 'Warning',
          reason: note.text,
          date: new Date(note.date).toLocaleDateString(),
          by: note.issuerName
        })) : [];
        
        // Add punishments to warnings
        if (player.punishments) {
          player.punishments.forEach((punishment: any) => {
            warnings.push({
              type: punishment.type,
              reason: punishment.reason,
              date: new Date(punishment.date).toLocaleDateString(),
              by: punishment.issuerName + (punishment.expires ? ` (until ${new Date(punishment.expires).toLocaleDateString()})` : '')
            });
          });
        }
        
        // Extract notes
        const notes = player.notes 
          ? player.notes.map((note: any) => `${note.text} (Added by ${note.issuerName} on ${new Date(note.date).toLocaleDateString()})`) 
          : [];
        
        // Extract linked accounts
        const linkedAccounts: string[] = [];
        if (player.discord) linkedAccounts.push(`${player.discord} (Discord)`);
        if (player.email) linkedAccounts.push(`${player.email} (Email)`);
        
        setPlayerInfo(prev => ({
          ...prev,
          username: currentUsername,
          status: status === 'Active' ? 'Online' : status,
          region: player.region || 'Unknown',
          country: player.country || 'Unknown',
          firstJoined: firstJoined,
          lastOnline: 'Recent', // This data isn't available in our current schema
          lastServer: player.lastServer || 'Unknown',
          playtime: player.playtime ? `${player.playtime} hours` : 'Not tracked',
          social: player.social || 'Medium',
          gameplay: player.gameplay || 'Medium',
          punished: status !== 'Active',
          previousNames: previousNames,
          warnings: warnings,
          linkedAccounts: linkedAccounts,
          notes: notes
        }));
      } else if (player.username) {
        // Handle API response format if different
        setPlayerInfo(prev => ({
          ...prev,
          username: player.username,
          lastOnline: player.lastOnline || 'Unknown',
          status: player.status === 'Active' ? 'Online' : player.status
        }));
      }
    }
  }, [player]);

  if (isLoading) {
    return (
      <div className="container py-8 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading player data...</p>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="container py-8 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">Could not find player data.</p>
          <Button onClick={() => navigate("/lookup")}>Return to Lookup</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-4 pb-20">
      <div className="flex items-center mb-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/lookup')}
          className="mr-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Player Details</h1>
      </div>

      <div className="space-y-4">
        <div className="bg-background-lighter p-4 rounded-lg border border-border">
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
              
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm">
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
                {playerInfo.linkedAccounts.length > 0 ? (
                  playerInfo.linkedAccounts.map((account, idx) => (
                    <li key={idx} className="text-sm flex items-center">
                      <Link2 className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                      {account}
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-muted-foreground">No linked accounts found.</li>
                )}
              </ul>
            </div>
          </TabsContent>
          
          <TabsContent value="notes" className="space-y-2 mx-1 mt-3">
            <h4 className="font-medium">Staff Notes</h4>
            <div className="bg-muted/30 p-3 rounded-lg">
              <ul className="space-y-2">
                {playerInfo.notes.length > 0 ? (
                  playerInfo.notes.map((note, idx) => (
                    <li key={idx} className="text-sm flex items-start">
                      <StickyNote className="h-3.5 w-3.5 mr-2 mt-0.5 text-muted-foreground" />
                      <span>{note}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-muted-foreground">No staff notes found.</li>
                )}
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
                      onClick={() => {
                        // Add the note
                        setPlayerInfo(prev => ({
                          ...prev,
                          notes: [...prev.notes, `${prev.newNote} (Added by Staff on ${new Date().toLocaleDateString()})`],
                          isAddingNote: false,
                          newNote: ''
                        }));
                      }}
                    >
                      Add Note
                    </Button>
                  </div>
                </div>
              )}
              
              {!playerInfo.isAddingNote && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-3"
                  onClick={() => setPlayerInfo(prev => ({...prev, isAddingNote: true}))}
                >
                  <StickyNote className="h-3.5 w-3.5 mr-1.5" />
                  Add Note
                </Button>
              )}
            </div>
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
                {playerInfo.previousNames.length > 0 ? (
                  playerInfo.previousNames.map((name, idx) => (
                    <li key={idx} className="text-sm flex items-center">
                      <UserRound className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                      {name}
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-muted-foreground">No previous names found.</li>
                )}
              </ul>
            </div>
          </TabsContent>
          
          <TabsContent value="punishment" className="space-y-3 mx-1 mt-3">
            <h4 className="font-medium">Create Punishment</h4>
            <div className="bg-muted/30 p-4 rounded-lg space-y-4">
              {!playerInfo.selectedPunishmentCategory ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Action Types</label>
                    <div className="grid grid-cols-3 gap-2 mb-2">
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
                    </div>
                    <div className="grid grid-cols-3 gap-2">
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
                    <div className="grid grid-cols-3 gap-2 mb-2">
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
                        onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Harassment'}))}
                      >
                        Harassment
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="py-1 text-xs" 
                        onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Hate Speech'}))}
                      >
                        Hate Speech
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="py-1 text-xs" 
                        onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Impersonation'}))}
                      >
                        Impersonation
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="py-1 text-xs" 
                        onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Advertising'}))}
                      >
                        Advertising
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="py-1 text-xs" 
                        onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Offensive Name'}))}
                      >
                        Offensive Name
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Gameplay</label>
                    <div className="grid grid-cols-3 gap-2 mb-2">
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
                        onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Griefing'}))}
                      >
                        Griefing
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="py-1 text-xs" 
                        onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Exploiting'}))}
                      >
                        Exploiting
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="py-1 text-xs" 
                        onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Bug Abuse'}))}
                      >
                        Bug Abuse
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="py-1 text-xs" 
                        onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'Team Griefing'}))}
                      >
                        Team Griefing
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="py-1 text-xs" 
                        onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: 'AFK Abuse'}))}
                      >
                        AFK Abuse
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center">
                    <h5 className="font-medium">{playerInfo.selectedPunishmentCategory}</h5>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setPlayerInfo(prev => ({...prev, selectedPunishmentCategory: undefined}))}
                    >
                      Change
                    </Button>
                  </div>
                  
                  <div className="space-y-2 mt-3">
                    <label className="text-sm font-medium">Severity</label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button 
                        variant={playerInfo.selectedSeverity === 'Lenient' ? 'default' : 'outline'} 
                        size="sm" 
                        className="py-1" 
                        onClick={() => setPlayerInfo(prev => ({...prev, selectedSeverity: 'Lenient'}))}
                      >
                        Lenient
                      </Button>
                      <Button 
                        variant={playerInfo.selectedSeverity === 'Regular' ? 'default' : 'outline'} 
                        size="sm" 
                        className="py-1" 
                        onClick={() => setPlayerInfo(prev => ({...prev, selectedSeverity: 'Regular'}))}
                      >
                        Regular
                      </Button>
                      <Button 
                        variant={playerInfo.selectedSeverity === 'Aggravated' ? 'default' : 'outline'} 
                        size="sm" 
                        className="py-1" 
                        onClick={() => setPlayerInfo(prev => ({...prev, selectedSeverity: 'Aggravated'}))}
                      >
                        Aggravated
                      </Button>
                    </div>
                  </div>
                  
                  {playerInfo.selectedPunishmentCategory === 'Kick' ? (
                    <div>
                      <div className="space-y-2 mt-3">
                        <label className="text-sm font-medium">Reason (shown to player)</label>
                        <textarea 
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm h-16"
                          placeholder="Enter reason for kick"
                          value={playerInfo.reason || ''}
                          onChange={(e) => setPlayerInfo(prev => ({...prev, reason: e.target.value}))}
                        />
                      </div>
                      
                      <div className="space-y-2 mt-3">
                        <div className="flex items-center">
                          <input 
                            type="checkbox" 
                            id="kick-same-ip" 
                            className="rounded mr-2"
                            checked={!!playerInfo.kickSameIP}
                            onChange={(e) => setPlayerInfo(prev => ({...prev, kickSameIP: e.target.checked}))}
                            disabled={playerInfo.status !== 'Online'}
                          />
                          <label htmlFor="kick-same-ip" className={`text-sm ${playerInfo.status !== 'Online' ? 'opacity-50' : ''}`}>
                            Kick Same IP
                          </label>
                        </div>
                      </div>

                      {playerInfo.status !== 'Online' && (
                        <div className="bg-warning/10 p-3 rounded-lg text-sm text-warning mt-3">
                          Player is not currently online. Kick action is only available for online players.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="space-y-2 mt-3">
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
                      
                      <div className="space-y-2 mt-3">
                        <label className="text-sm font-medium">Reason (shown to player)</label>
                        <textarea 
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm h-16"
                          placeholder="Enter reason for punishment"
                          value={playerInfo.reason || ''}
                          onChange={(e) => setPlayerInfo(prev => ({...prev, reason: e.target.value}))}
                        />
                      </div>
                      
                      <div className="space-y-2 mt-3">
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
                    </div>
                  )}

                  <div className="space-y-2 mt-3">
                    <label className="text-sm font-medium">Notes (staff use only)</label>
                    <textarea 
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm h-16"
                      placeholder="Internal notes visible only to staff"
                      value={playerInfo.staffNotes || ''}
                      onChange={(e) => setPlayerInfo(prev => ({...prev, staffNotes: e.target.value}))}
                    />
                  </div>
                  
                  <div className="space-y-2 mt-3">
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
                  
                  <div className="pt-4">
                    <Button 
                      className="w-full" 
                      onClick={handleApplyPunishment}
                      disabled={isApplyingPunishment}
                    >
                      {isApplyingPunishment ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        <>Apply Punishment</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PlayerDetailPage;