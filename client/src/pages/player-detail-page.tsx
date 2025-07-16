import { useState, useEffect, useCallback } from 'react';
import { useRoute, useLocation } from 'wouter';
import { 
  ArrowLeft, TriangleAlert, Ban, RefreshCcw, Search, LockOpen, History, 
  Link2, StickyNote, Ticket, UserRound, Shield, FileText, Upload, Loader2,
  ChevronDown, ChevronRight, Settings, Plus
} from 'lucide-react';
import { Button } from 'modl-shared-web/components/ui/button';
import { Badge } from 'modl-shared-web/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'modl-shared-web/components/ui/tabs';
import { usePlayer, useApplyPunishment, useSettings, usePlayerTickets, usePlayerAllTickets, useModifyPunishment, useAddPunishmentNote, useLinkedAccounts, useFindLinkedAccounts } from '@/hooks/use-data';
import { ClickablePlayer } from '@/components/ui/clickable-player';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import PlayerPunishment, { PlayerPunishmentData } from '@/components/ui/player-punishment';
import MediaUpload from '@/components/MediaUpload';

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
  warnings: Array<{ 
    type: string; 
    reason: string; 
    date: string; 
    by: string;
    id?: string;
    severity?: string;
    status?: string;
    evidence?: (string | {text: string; issuerName: string; date: string})[];
    notes?: Array<{text: string; issuerName: string; date: string}>;
    attachedTicketIds?: string[];
    active?: boolean;
    expires?: string;
    started?: string | Date;
    data?: any;
    altBlocking?: boolean;
  }>;
  linkedAccounts: string[];
  notes: string[];
  newNote?: string;
  isAddingNote?: boolean;
  // Punishment note/modification fields
  isAddingPunishmentNote?: boolean;
  punishmentNoteTarget?: string | null;
  newPunishmentNote?: string;
  isAddingPunishmentEvidence?: boolean;
  punishmentEvidenceTarget?: string | null;
  newPunishmentEvidence?: string;
  uploadedEvidenceFile?: {
    url: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  } | null;
  isModifyingPunishment?: boolean;
  modifyPunishmentTarget?: string | null;
  modifyPunishmentAction?: 'modify' | null;
  modifyPunishmentReason?: string;
  selectedModificationType?: 'MANUAL_DURATION_CHANGE' | 'MANUAL_PARDON' | 'SET_ALT_BLOCKING_TRUE' | 'SET_WIPING_TRUE' | 'SET_ALT_BLOCKING_FALSE' | 'SET_WIPING_FALSE' | null;
  newDuration?: {
    value: number;
    unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  };
  // Punishment creation fields
  selectedPunishmentCategory?: string;
  selectedSeverity?: 'Lenient' | 'Regular' | 'Aggravated';
  selectedOffenseLevel?: 'first' | 'medium' | 'habitual';
  duration?: {
    value: number;
    unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  };
  isPermanent?: boolean;
  reason?: string;
  evidence?: string;
  evidenceList?: string[];
  attachedReports?: string[];
  banLinkedAccounts?: boolean;
  wipeAccountAfterExpiry?: boolean;
  kickSameIP?: boolean;
  banToLink?: string;
  staffNotes?: string;
  silentPunishment?: boolean;
  altBlocking?: boolean;
  statWiping?: boolean;
}

interface PunishmentType {
  id: number;
  name: string;
  category: 'Gameplay' | 'Social' | 'Administrative';
  isCustomizable: boolean;
  ordinal: number;
  durations?: {
    low: { 
      first: { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; banValue?: number; banUnit?: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; };
      medium: { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; banValue?: number; banUnit?: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; };
      habitual: { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; banValue?: number; banUnit?: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; };
    };
    regular: {
      first: { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; banValue?: number; banUnit?: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; };
      medium: { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; banValue?: number; banUnit?: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; };
      habitual: { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; banValue?: number; banUnit?: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; };
    };
    severe: {
      first: { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; banValue?: number; banUnit?: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; };
      medium: { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; banValue?: number; banUnit?: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; };
      habitual: { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; banValue?: number; banUnit?: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; };
    };
  };
  points?: {
    low: number;
    regular: number;
    severe: number;
  };
  customPoints?: number;
  staffDescription?: string;
  playerDescription?: string;
  canBeAltBlocking?: boolean;
  canBeStatWiping?: boolean;
  isAppealable?: boolean;
  singleSeverityPunishment?: boolean;
  singleSeverityDurations?: {
    first: { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; type: 'mute' | 'ban'; };
    medium: { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; type: 'mute' | 'ban'; };
    habitual: { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; type: 'mute' | 'ban'; };
  };
  singleSeverityPoints?: number;
}

const PlayerDetailPage = () => {
  const [_, params] = useRoute('/panel/player/:uuid');
  const [location, navigate] = useLocation();
  const playerId = params?.uuid || '';
  
  const [activeTab, setActiveTab] = useState('history');
  const [banSearchResults, setBanSearchResults] = useState<{id: string; player: string}[]>([]);
  const [showBanSearchResults, setShowBanSearchResults] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [isApplyingPunishment, setIsApplyingPunishment] = useState(false);
  const [expandedPunishments, setExpandedPunishments] = useState<Set<string>>(new Set());

  // Get current authenticated user
  const { user } = useAuth();
  
  // Initialize the mutation hooks
  const applyPunishment = useApplyPunishment();
  const modifyPunishment = useModifyPunishment();
  const addPunishmentNote = useAddPunishmentNote();

  // Use React Query hooks to fetch data
  const { data: player, isLoading, error, refetch } = usePlayer(playerId);
  const { data: playerTickets, isLoading: isLoadingTickets } = usePlayerAllTickets(playerId);
  const { data: linkedAccountsData, isLoading: isLoadingLinkedAccounts, refetch: refetchLinkedAccounts } = useLinkedAccounts(playerId);
  const findLinkedAccountsMutation = useFindLinkedAccounts();
  const { data: settingsData, isLoading: isLoadingSettings } = useSettings();

  // State to track if we've already triggered linked account search
  const [hasTriggeredLinkedSearch, setHasTriggeredLinkedSearch] = useState(false);
  
  // Stable function to trigger linked account search
  const triggerLinkedAccountSearch = useCallback(() => {
    if (playerId && !hasTriggeredLinkedSearch && !findLinkedAccountsMutation.isPending) {
      setHasTriggeredLinkedSearch(true);
      findLinkedAccountsMutation.mutate(playerId, {
        onError: (error) => {
          console.error('Failed to trigger linked account search:', error);
          setHasTriggeredLinkedSearch(false);
        }
      });
    }
  }, [playerId, hasTriggeredLinkedSearch]);

  // Initialize player info state
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

  // Initialize punishment types state
  const [punishmentTypesByCategory, setPunishmentTypesByCategory] = useState<{
    Administrative: PunishmentType[], 
    Social: PunishmentType[], 
    Gameplay: PunishmentType[]
  }>({
    Administrative: [
      // Administrative punishment types (ordinals 0-5, not customizable) - minimal fallback
      { id: 0, name: 'Kick', category: 'Administrative', isCustomizable: false, ordinal: 0 },
      { id: 1, name: 'Manual Mute', category: 'Administrative', isCustomizable: false, ordinal: 1 },
      { id: 2, name: 'Manual Ban', category: 'Administrative', isCustomizable: false, ordinal: 2 },
      { id: 3, name: 'Security Ban', category: 'Administrative', isCustomizable: false, ordinal: 3 },
      { id: 4, name: 'Linked Ban', category: 'Administrative', isCustomizable: false, ordinal: 4 },
      { id: 5, name: 'Blacklist', category: 'Administrative', isCustomizable: false, ordinal: 5 }
    ],
    Social: [],
    Gameplay: []
  });

  // Reset avatar state when playerId changes
  useEffect(() => {
    setAvatarError(false);
    setAvatarLoading(true);
  }, [playerId]);

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

  // Function to handle ticket navigation
  const handleTicketClick = (ticketId: string) => {
    navigate(`/panel/tickets/${ticketId}`);
  };

  // Show loading state
  if (isLoading || isLoadingSettings) {
    return (
      <div className="w-full px-4 py-4 pb-20">
        <div className="flex items-center mb-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/panel/lookup')}
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Loading Player...</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !player) {
    return (
      <div className="w-full px-4 py-4 pb-20">
        <div className="flex items-center mb-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/panel/lookup')}
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Player Not Found</h1>
        </div>
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-destructive">Could not find player data.</p>
          <Button onClick={() => navigate("/panel/lookup")} className="mt-4">Return to Lookup</Button>
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
          onClick={() => navigate('/panel/lookup')}
          className="mr-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Player Details</h1>
      </div>

      <div className="space-y-4">
        <div className="pt-2">
          <div className="bg-background-lighter p-4 rounded-lg">
            <div className="flex items-start gap-4">
              <div className="relative h-16 w-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {playerId && !avatarError ? (
                  <>
                    <img 
                      src={`/api/panel/players/avatar/${playerId}?size=64&overlay=true`}
                      alt={`${playerInfo.username || 'Player'} Avatar`}
                      className={`w-full h-full object-cover transition-opacity duration-200 ${avatarLoading ? 'opacity-0' : 'opacity-100'}`}
                      onError={() => {
                        setAvatarError(true);
                        setAvatarLoading(false);
                      }}
                      onLoad={() => {
                        setAvatarError(false);
                        setAvatarLoading(false);
                      }}
                    />
                    {avatarLoading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-primary">{playerInfo.username?.substring(0, 2) || '??'}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-2xl font-bold text-primary">{playerInfo.username?.substring(0, 2) || '??'}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="text-lg font-medium">{playerInfo.username || 'Unknown'}</h5>
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
                    Social: {playerInfo.social.toLowerCase()}
                  </Badge>
                  <Badge variant="outline" className={
                    playerInfo.gameplay.toLowerCase() === 'low' ? 
                      "bg-success/10 text-success border-success/20" : 
                    playerInfo.gameplay.toLowerCase() === 'medium' ? 
                      "bg-warning/10 text-warning border-warning/20" : 
                      "bg-destructive/10 text-destructive border-destructive/20"
                  }>
                    Gameplay: {playerInfo.gameplay.toLowerCase()}
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
                    {playerInfo.region && playerInfo.region !== 'Unknown' && (
                      <span className="text-xs text-muted-foreground ml-1">(from latest IP)</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Country:</span>
                    <span className="ml-1">{playerInfo.country}</span>
                    {playerInfo.country && playerInfo.country !== 'Unknown' && (
                      <span className="text-xs text-muted-foreground ml-1">(from latest IP)</span>
                    )}
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
              <Link2 className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
              Connected
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
              {playerInfo.warnings.length > 0 ? (
                <div className="bg-muted/30 p-3 rounded-lg">
                  <p className="text-sm">Punishment history will be loaded here from the actual data.</p>
                </div>
              ) : (
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
              <p className="text-sm text-muted-foreground">Punishment creation interface will be implemented here.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PlayerDetailPage;