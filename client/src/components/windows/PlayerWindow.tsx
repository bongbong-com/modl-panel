import { useState, useEffect } from 'react';
import { 
  Eye, TriangleAlert, Ban, RefreshCcw, Search, LockOpen, History, 
  Link2, StickyNote, Ticket, UserRound, Shield, FileText, Upload, Loader2,
  ChevronDown, ChevronRight, Settings
} from 'lucide-react';
import { Button } from 'modl-shared-web/components/ui/button';
import { Badge } from 'modl-shared-web/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'modl-shared-web/components/ui/tabs';
import ResizableWindow from '@/components/layout/ResizableWindow';
import { usePlayer, useApplyPunishment, useSettings, usePlayerTickets, useModifyPunishment, useAddPunishmentNote } from '@/hooks/use-data';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';

// Local type definitions
interface WindowPosition {
  x: number;
  y: number;
}

interface Player {
  _id: string;
  username: string;
  // Add other player properties as needed
}

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
  warnings: Array<{ 
    type: string; 
    reason: string; 
    date: string; 
    by: string;
    id?: string;
    severity?: string;
    status?: string;
    evidence?: string[];
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
  isModifyingPunishment?: boolean;
  modifyPunishmentTarget?: string | null;  modifyPunishmentAction?: 'modify' | null;
  modifyPunishmentReason?: string;
  selectedModificationType?: 'MANUAL_DURATION_CHANGE' | 'MANUAL_PARDON' | 'SET_ALT_BLOCKING_TRUE' | 'SET_WIPING_TRUE' | 'SET_ALT_BLOCKING_FALSE' | 'SET_WIPING_FALSE' | null;
  newDuration?: {
    value: number;
    unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  };
  // Punishment creation fields
  selectedPunishmentCategory?: string;
  selectedSeverity?: 'Lenient' | 'Regular' | 'Aggravated';
  selectedOffenseLevel?: 'first' | 'medium' | 'habitual'; // For single-severity punishments
  duration?: {
    value: number;
    unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  };
  isPermanent?: boolean;  reason?: string;
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
  customPoints?: number; // For permanent punishments that don't use severity-based points  staffDescription?: string; // Description shown to staff when applying this punishment
  playerDescription?: string; // Description shown to players (in appeals, notifications, etc.)
  canBeAltBlocking?: boolean; // Whether this punishment can block alternative accounts
  canBeStatWiping?: boolean; // Whether this punishment can wipe player statistics
  isAppealable?: boolean; // Whether this punishment type can be appealed
  singleSeverityPunishment?: boolean; // Whether this punishment uses single severity instead of three levels
  singleSeverityDurations?: {
    first: { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; type: 'mute' | 'ban'; };
    medium: { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; type: 'mute' | 'ban'; };
    habitual: { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; type: 'mute' | 'ban'; };
  };
  singleSeverityPoints?: number; // Points for single severity punishments
}

const PlayerWindow = ({ playerId, isOpen, onClose, initialPosition }: PlayerWindowProps) => {
  const [activeTab, setActiveTab] = useState('history');
  const [banSearchResults, setBanSearchResults] = useState<{id: string; player: string}[]>([]);
  const [showBanSearchResults, setShowBanSearchResults] = useState(false);
  const [isApplyingPunishment, setIsApplyingPunishment] = useState(false);
  const [expandedPunishments, setExpandedPunishments] = useState<Set<string>>(new Set());    // Get current authenticated user
  const { user } = useAuth();
    // Initialize the applyPunishment mutation hook
  const applyPunishment = useApplyPunishment();
  const modifyPunishment = useModifyPunishment();
  const addPunishmentNote = useAddPunishmentNote();
  // Mapping of punishment type names to their ordinals
  const getPunishmentOrdinal = (punishmentName: string): number => {
    const punishmentMap: { [key: string]: number } = {
      // Administrative punishments
      'Kick': 0,
      'Manual Mute': 1,
      'Manual Ban': 2,
      'Security Ban': 3,
      'Linked Ban': 4,
      'Blacklist': 5,
      // Social punishments
      'Chat Abuse': 6,
      'Anti Social': 7,
      'Targeting': 8,
      'Bad Content': 9,
      'Bad Skin': 10,
      'Bad Name': 11,
      // Gameplay punishments
      'Team Abuse': 12,
      'Game Abuse': 13,
      'Systems Abuse': 14,
      'Account Abuse': 15,
      'Game Trading': 16,
      'Cheating': 17
    };
    
    return punishmentMap[punishmentName] ?? -1;
  };

  // Convert duration to milliseconds
  const convertDurationToMilliseconds = (duration: { value: number; unit: string }): number => {
    const multipliers = {
      'seconds': 1000,
      'minutes': 60 * 1000,
      'hours': 60 * 60 * 1000,
      'days': 24 * 60 * 60 * 1000,
      'weeks': 7 * 24 * 60 * 60 * 1000,
      'months': 30 * 24 * 60 * 60 * 1000
    };
    
    return duration.value * (multipliers[duration.unit as keyof typeof multipliers] || 0);
  };  // Handler for applying punishment
  const handleApplyPunishment = async () => {
    // Test toast to verify it's working
    toast({
      title: "DEBUG: Function called",
      description: `Attempting to apply ${playerInfo.selectedPunishmentCategory}`,
      variant: "default"
    });

    const punishmentType = getCurrentPunishmentType();
    
    // Validate required fields
    if (!playerInfo.selectedPunishmentCategory) {
      toast({
        title: "Missing information",
        description: "Please select a punishment category",
        variant: "destructive"
      });
      return;
    }

    // Only validate reason for administrative manual punishments that explicitly need it
    const needsReason = ['Kick', 'Manual Mute', 'Manual Ban'].includes(playerInfo.selectedPunishmentCategory);
    if (needsReason && !playerInfo.reason?.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a reason for this punishment",
        variant: "destructive"
      });
      return;
    }
    
    // For single-severity punishments, offense level is required
    // For multi-severity punishments, severity is required
    if (punishmentType?.singleSeverityPunishment && !playerInfo.selectedOffenseLevel) {
      toast({
        title: "Missing information",
        description: "Please select an offense level",
        variant: "destructive"
      });
      return;
    }
    
    if (!punishmentType?.singleSeverityPunishment && !playerInfo.selectedSeverity && 
        !['Kick', 'Manual Mute', 'Manual Ban', 'Security Ban', 'Linked Ban', 'Blacklist'].includes(playerInfo.selectedPunishmentCategory)) {
      toast({
        title: "Missing information",
        description: "Please select a severity level",
        variant: "destructive"
      });
      return;
    }
    
    // Validate duration for punishments that need it
    const needsDuration = ['Manual Mute', 'Manual Ban'].includes(playerInfo.selectedPunishmentCategory);
    const isManualPunishment = ['Kick', 'Manual Mute', 'Manual Ban', 'Security Ban', 'Linked Ban', 'Blacklist'].includes(playerInfo.selectedPunishmentCategory);
                          
    if (needsDuration && !playerInfo.isPermanent && (!playerInfo.duration?.value || playerInfo.duration.value <= 0 || !playerInfo.duration?.unit)) {
      toast({
        title: "Invalid duration",
        description: "Please specify a valid duration (greater than 0) or select 'Permanent'",
        variant: "destructive"
      });
      return;
    }
    
    // Validate punishment ordinal
    const typeOrdinal = getPunishmentOrdinal(playerInfo.selectedPunishmentCategory);
    if (typeOrdinal === -1) {
      toast({
        title: "Invalid punishment type",
        description: "Unknown punishment type selected",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsApplyingPunishment(true);
      
      // Determine severity and status based on punishment type first
      let severity = null;
      let status = null;
      
      if (punishmentType?.singleSeverityPunishment) {
        // For single-severity punishments, severity is the single configured value
        severity = 'single'; // or could be determined from punishment type config
        // Map offense level to status for storage
        const offenseLevelMapping = {
          'first': 'low',
          'medium': 'medium', 
          'habitual': 'habitual'
        };
        status = offenseLevelMapping[playerInfo.selectedOffenseLevel as keyof typeof offenseLevelMapping] || 'low';
      } else if (playerInfo.selectedSeverity) {
        // For multi-severity punishments, map UI severity to punishment system values
        const severityMapping = {
          'Lenient': 'low',
          'Regular': 'regular', 
          'Aggravated': 'severe'
        };
        severity = severityMapping[playerInfo.selectedSeverity] || 'regular';
        
        // Status is always low for multi-severity (default offense level)
        status = 'low'; // Could be enhanced to track actual offense count
      }

      // Calculate duration in milliseconds based on punishment type configuration
      let durationMs = 0;
      
      // For manual punishments that need duration, use user-specified duration
      if (needsDuration && !playerInfo.isPermanent && playerInfo.duration) {
        durationMs = convertDurationToMilliseconds(playerInfo.duration);
      } 
      // For Linked Ban, it inherits duration from the linked ban (permanent by default)
      else if (playerInfo.selectedPunishmentCategory === 'Linked Ban') {
        durationMs = 0; // Permanent by default, unless linked ban has expiry
      }
      // For other manual punishments that don't need duration (Kick, Security Ban, Blacklist), skip duration calculation
      else if (isManualPunishment) {
        // These punishments don't need duration calculations
        durationMs = 0;
      }
      // For all other non-manual punishments, use punishment type configuration
      else if (!playerInfo.isPermanent) {
        if (punishmentType?.singleSeverityPunishment && punishmentType?.singleSeverityDurations && playerInfo.selectedOffenseLevel) {
          // Single-severity punishment - use duration from offense level
          const duration = punishmentType.singleSeverityDurations[playerInfo.selectedOffenseLevel];
          if (duration) {
            durationMs = convertDurationToMilliseconds(duration);
          }
        } else if (punishmentType?.durations && playerInfo.selectedSeverity) {
          // Multi-severity punishment - use duration from punishment type config based on severity and status
          const severityKey = playerInfo.selectedSeverity === 'Lenient' ? 'low' : 
                             playerInfo.selectedSeverity === 'Regular' ? 'regular' : 'severe';
          
          // Map stored status back to punishment type keys for duration lookup
          const statusToDurationKey = {
            'low': 'first',
            'medium': 'medium', 
            'habitual': 'habitual'
          };
          const statusKey = statusToDurationKey[status as keyof typeof statusToDurationKey] || 'first';
          const duration = punishmentType.durations[severityKey]?.[statusKey as 'first' | 'medium' | 'habitual'];
          
          if (duration) {
            durationMs = convertDurationToMilliseconds(duration);
          } else {
            // Try with 'first' as fallback
            const fallbackDuration = punishmentType.durations[severityKey]?.['first'];
            if (fallbackDuration) {
              durationMs = convertDurationToMilliseconds(fallbackDuration);
            }
          }
        }
      }
        // Prepare data map for additional punishment data
      const data: { [key: string]: any } = {
        silent: playerInfo.silentPunishment || false,
      };
        // Set duration in data for all punishments that have a calculated duration
      if (durationMs > 0) {
        data.duration = durationMs;
      }
      
      // Add punishment-specific data
      if (playerInfo.altBlocking) {
        data.altBlocking = true;
      }
      
      if (playerInfo.statWiping) {
        data.wipeAfterExpiry = true;
      }
      
      if (playerInfo.banLinkedAccounts) {
        data.banLinkedAccounts = true;
      }
      
      if (playerInfo.wipeAccountAfterExpiry) {
        data.wipeAfterExpiry = true;
      }
      
      if (playerInfo.kickSameIP) {
        data.kickSameIP = true;
      }
      
      if (playerInfo.banToLink?.trim()) {
        // Extract ban ID from the format "ban-123 (PlayerName)"
        const banIdMatch = playerInfo.banToLink.match(/^(ban-\w+)/);
        if (banIdMatch) {
          data.linkedBanId = banIdMatch[1];
        }
      }
      
      // Prepare notes array - notes must be objects with text, issuerName, and date
      const notes: Array<{text: string; issuerName: string; date?: string}> = [];
      
      // For manual punishments that need a reason, make the reason the first note
      const needsReasonAsFirstNote = ['Kick', 'Manual Mute', 'Manual Ban'].includes(playerInfo.selectedPunishmentCategory);
      if (needsReasonAsFirstNote && playerInfo.reason?.trim()) {
        notes.push({
          text: playerInfo.reason.trim(),
          issuerName: user?.username || 'Admin'
        });
      }
      
      // Add staff notes as additional notes
      if (playerInfo.staffNotes?.trim()) {
        notes.push({
          text: playerInfo.staffNotes.trim(),
          issuerName: user?.username || 'Admin'
        });
      }
      
      // Prepare attached ticket IDs
      const attachedTicketIds: string[] = [];
      if (playerInfo.attachedReports) {
        playerInfo.attachedReports.forEach(report => {
          if (report && report !== 'ticket-new') {
            // Extract ticket ID from format like "ticket-123"
            const ticketMatch = report.match(/ticket-(\w+)/);
            if (ticketMatch) {
              attachedTicketIds.push(ticketMatch[1]);
            }
          }
        });
      }
      
      // Prepare evidence array
      const evidence = playerInfo.evidenceList?.filter(e => e.trim()).map(e => e.trim()) || [];
      // Prepare punishment data in the format expected by the server
      const punishmentData: { [key: string]: any } = {
        issuerName: user?.username || 'Admin', // Use actual staff member name
        type_ordinal: typeOrdinal,
        notes: notes,
        evidence: evidence,
        attachedTicketIds: attachedTicketIds,
        severity: severity,
        status: status,
        data: data
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
        selectedOffenseLevel: undefined,
        duration: undefined,
        isPermanent: false,
        reason: '',
        evidence: '',
        evidenceList: [],
        attachedReports: [],
        banLinkedAccounts: false,
        wipeAccountAfterExpiry: false,
        kickSameIP: false,
        banToLink: '',
        staffNotes: '',
        silentPunishment: false,
        altBlocking: false,
        statWiping: false
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
    // Use React Query hook to fetch player data with refetch capability
  const { data: player, isLoading, error, refetch } = usePlayer(playerId);
  
  // Fetch player tickets
  const { data: playerTickets, isLoading: isLoadingTickets } = usePlayerTickets(playerId);
    // Fetch punishment types from settings
  const { data: settingsData, isLoading: isLoadingSettings } = useSettings();
  
  // Parse punishment types from settings - must be declared before useEffect that uses it
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
      { id: 5, name: 'Blacklist', category: 'Administrative', isCustomizable: false, ordinal: 5 }    ],
    Social: [
      // Social punishment types are loaded from server during provisioning
    ],
    Gameplay: [
      // Gameplay punishment types are loaded from server during provisioning
    ]
  });

  // Process settings data to extract punishment types by category
  useEffect(() => {
    if (settingsData?.settings?.punishmentTypes) {
      try {
        // Parse punishment types if they're stored as a string
        const typesData = typeof settingsData.settings.punishmentTypes === 'string' 
          ? JSON.parse(settingsData.settings.punishmentTypes) 
          : settingsData.settings.punishmentTypes;
          
        if (Array.isArray(typesData)) {
          // Always ensure administrative punishment types are available
          const defaultAdminTypes: PunishmentType[] = [
            { id: 0, name: 'Kick', category: 'Administrative' as const, isCustomizable: false, ordinal: 0 },
            { id: 1, name: 'Manual Mute', category: 'Administrative' as const, isCustomizable: false, ordinal: 1 },
            { id: 2, name: 'Manual Ban', category: 'Administrative' as const, isCustomizable: false, ordinal: 2 },
            { id: 3, name: 'Security Ban', category: 'Administrative' as const, isCustomizable: false, ordinal: 3 },
            { id: 4, name: 'Linked Ban', category: 'Administrative' as const, isCustomizable: false, ordinal: 4 },
            { id: 5, name: 'Blacklist', category: 'Administrative' as const, isCustomizable: false, ordinal: 5 }
          ];
          
          // Group punishment types by category
          const adminFromSettings = typesData.filter(pt => pt.category === 'Administrative');
          
          // Merge default admin types with any additional admin types from settings
          // Default types take precedence (to ensure they're always available)
          const mergedAdminTypes = [...defaultAdminTypes];
          adminFromSettings.forEach(settingsType => {
            if (!mergedAdminTypes.find(defaultType => defaultType.name === settingsType.name)) {
              mergedAdminTypes.push(settingsType);
            }
          });
          
          const categorized = {
            Administrative: mergedAdminTypes.sort((a, b) => a.ordinal - b.ordinal),
            Social: typesData.filter(pt => pt.category === 'Social').sort((a, b) => a.ordinal - b.ordinal),
            Gameplay: typesData.filter(pt => pt.category === 'Gameplay').sort((a, b) => a.ordinal - b.ordinal)
          };
          
          // Update the state with the loaded punishment types
          setPunishmentTypesByCategory(categorized);
        }
      } catch (error) {
        console.error("Error parsing punishment types:", error);
      }
    }
  }, [settingsData]);

  // Calculate player status based on punishments and settings
  const calculatePlayerStatus = (punishments: any[], punishmentTypes: PunishmentType[], statusThresholds: any) => {
    let socialPoints = 0;
    let gameplayPoints = 0;    // Calculate points from active punishments
    for (const punishment of punishments) {
      // Check if punishment is effectively active (considering modifications)
      const effectiveState = getEffectivePunishmentState(punishment);
      const isActive = effectiveState.effectiveActive;
      if (!isActive) continue;

      // Find punishment type
      const punishmentType = punishmentTypes.find(pt => pt.ordinal === punishment.type_ordinal);
      if (!punishmentType) continue;

      // Get points based on severity or single severity
      let points = 0;
      const severity = punishment.severity || punishment.data?.severity;
      
      if (punishmentType.customPoints !== undefined) {
        // Custom points for permanent punishments (like Bad Skin, Bad Name)
        points = punishmentType.customPoints;
      } else if (punishmentType.singleSeverityPoints !== undefined) {
        // Single severity punishment
        points = punishmentType.singleSeverityPoints;
      } else if (punishmentType.points && severity) {
        // Multi-severity punishment
        const severityLower = severity.toLowerCase();
        if (severityLower === 'low' || severityLower === 'lenient') {
          points = punishmentType.points.low;
        } else if (severityLower === 'regular' || severityLower === 'medium') {
          points = punishmentType.points.regular;
        } else if (severityLower === 'severe' || severityLower === 'aggravated' || severityLower === 'high') {
          points = punishmentType.points.severe;
        }
      }

      // Add points to appropriate category
      if (punishmentType.category === 'Social') {
        socialPoints += points;
      } else if (punishmentType.category === 'Gameplay') {
        gameplayPoints += points;
      }
      // Administrative punishments don't contribute to status points
    }

    // Determine status based on thresholds
    const getStatusLevel = (points: number, thresholds: { medium: number; habitual: number }) => {
      if (points >= thresholds.habitual) {
        return 'Habitual';
      } else if (points >= thresholds.medium) {
        return 'Medium';
      } else {
        return 'Low';
      }
    };

    const socialStatus = getStatusLevel(socialPoints, statusThresholds?.social || { medium: 4, habitual: 8 });
    const gameplayStatus = getStatusLevel(gameplayPoints, statusThresholds?.gameplay || { medium: 5, habitual: 10 });

    return {
      social: socialStatus,
      gameplay: gameplayStatus,
      socialPoints,
      gameplayPoints
    };
  };
  
  // Refetch player data whenever the window is opened
  useEffect(() => {
    if (isOpen) {
      // Refetch data to ensure we have the latest
      refetch();
    }
  }, [isOpen, refetch]);

  useEffect(() => {
    if (player && isOpen) {
      // Check if we're dealing with MongoDB data or the API response format
      if (player.usernames) {
        // This is MongoDB raw data that needs formatting
        const currentUsername = player.usernames && player.usernames.length > 0 
          ? player.usernames[player.usernames.length - 1].username 
          : 'Unknown';
        
        const firstJoined = player.usernames && player.usernames.length > 0 
          ? formatDateWithTime(player.usernames[0].date) 
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
        
        // Initialize warnings array - do NOT include staff notes as warnings
        const warnings: any[] = [];
        
        // Add punishments to warnings with full details
        if (player.punishments) {
          console.log('Processing punishments:', player.punishments);
          player.punishments.forEach((punishment: any) => {
            console.log('Processing punishment:', punishment);            // Determine punishment type name from ordinal using settings data
            const getPunishmentTypeName = (ordinal: number) => {
              // First check all loaded punishment types from settings
              const allTypes = [
                ...punishmentTypesByCategory.Administrative,
                ...punishmentTypesByCategory.Social,
                ...punishmentTypesByCategory.Gameplay
              ];
              
              const foundType = allTypes.find(type => type.ordinal === ordinal);
              if (foundType) {
                return foundType.name;
              }
              
              // Fallback for unknown ordinals
              return `Unknown Punishment ${ordinal}`;
            };
            
            const punishmentType = getPunishmentTypeName(punishment.type_ordinal);
            
            // Use staff notes as the main reason text
            let displayReason = '';
            if (punishment.notes && punishment.notes.length > 0) {
              // Use first note as the main reason (for both manual and automatic punishments)
              const firstNote = punishment.notes[0];
              displayReason = typeof firstNote === 'string' ? firstNote : firstNote.text;
            } else {
              // Fallback if no notes available
              displayReason = 'No additional details';
            }
            
            warnings.push({
              type: punishmentType,
              reason: displayReason,
              date: formatDateWithTime(punishment.date || punishment.issued),
              by: punishment.issuerName,
              // Additional punishment details
              id: punishment.id || punishment._id,
              severity: punishment.data?.severity || (punishment.data?.get ? punishment.data.get('severity') : punishment.severity),
              status: punishment.data?.status || (punishment.data?.get ? punishment.data.get('status') : punishment.status),
              evidence: (() => {
                const evidenceArray = punishment.evidence || [];
                console.log('Evidence for punishment', punishment.id, ':', evidenceArray);
                return evidenceArray;
              })(),
              notes: punishment.notes || [],
              attachedTicketIds: punishment.attachedTicketIds || [],
              active: punishment.data?.active !== false || (punishment.data?.get ? punishment.data.get('active') !== false : punishment.active),
              modifications: punishment.modifications || [],
              expires: punishment.expires || punishment.data?.expires || (punishment.data?.get ? punishment.data.get('expires') : null),
              data: punishment.data || {},
              altBlocking: punishment.data?.altBlocking || (punishment.data?.get ? punishment.data.get('altBlocking') : false)
            });
          });
        }
          // Extract notes
        const notes = player.notes          ? player.notes.map((note: any) => `${note.text} (Added by ${note.issuerName} on ${formatDateWithTime(note.date)})`) 
          : [];
        
        // Extract linked accounts - accounts sharing IPs (non-proxy/hosting unless within 6 hours)
        const linkedAccounts: string[] = [];
        
        // Add traditional linked accounts (Discord, Email, etc.)
        if (player.discord) linkedAccounts.push(`${player.discord} (Discord)`);
        if (player.email) linkedAccounts.push(`${player.email} (Email)`);
        
        // Add IP-based connections
        if (player.ipConnections && Array.isArray(player.ipConnections)) {
          player.ipConnections.forEach((connection: any) => {
            const timeDiff = connection.timeDifference ? connection.timeDifference : 0;
            const isWithin6Hours = timeDiff <= 6 * 60 * 60 * 1000; // 6 hours in milliseconds
            
            // Include non-proxy/hosting IPs, or proxy/hosting IPs within 6 hours
            if (!connection.isProxy && !connection.isHosting) {
              linkedAccounts.push(`${connection.username} (shared IP: ${connection.ip})`);
            } else if ((connection.isProxy || connection.isHosting) && isWithin6Hours) {
              const connectionType = connection.isProxy ? 'proxy' : 'hosting';
              linkedAccounts.push(`${connection.username} (shared ${connectionType} IP: ${connection.ip})`);
            }
          });
        }
        
        // If no specific IP connections data, fall back to generic linked accounts
        if (player.linkedAccounts && Array.isArray(player.linkedAccounts)) {
          player.linkedAccounts.forEach((account: string) => {
            if (!linkedAccounts.includes(account)) {
              linkedAccounts.push(account);
            }
          });
        }
        
        // Calculate player status using punishment points and thresholds
        const allPunishmentTypes = [
          ...punishmentTypesByCategory.Administrative,
          ...punishmentTypesByCategory.Social,
          ...punishmentTypesByCategory.Gameplay
        ];
        
        // Get status thresholds from settings
        let statusThresholds = { social: { medium: 4, habitual: 8 }, gameplay: { medium: 5, habitual: 10 } };
        if (settingsData?.settings?.statusThresholds) {
          try {
            const thresholdsData = typeof settingsData.settings.statusThresholds === 'string' 
              ? JSON.parse(settingsData.settings.statusThresholds) 
              : settingsData.settings.statusThresholds;
            if (thresholdsData) {
              statusThresholds = thresholdsData;
            }
          } catch (error) {
            console.error("Error parsing status thresholds:", error);
          }
        }
        
        const calculatedStatus = calculatePlayerStatus(player.punishments || [], allPunishmentTypes, statusThresholds);
        
        setPlayerInfo(prev => ({
          ...prev,
          username: currentUsername,
          status: status === 'Active' ? 'Online' : status,
          region: player.latestIPData?.region || player.region || 'Unknown',
          country: player.latestIPData?.country || player.country || 'Unknown',
          firstJoined: firstJoined,
          lastOnline: 'Recent', // This data isn't available in our current schema
          lastServer: player.lastServer || 'Unknown',
          playtime: player.playtime ? `${player.playtime} hours` : 'Not tracked',
          social: calculatedStatus.social,
          gameplay: calculatedStatus.gameplay,
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
    }  }, [player, isOpen, punishmentTypesByCategory, settingsData]);
  
  // Show loading state
  if (isLoading) {
    return (
      <ResizableWindow
        id={`player-${playerId}`}
        title="Loading Player Info..."
        isOpen={isOpen}
        onClose={onClose}
        initialPosition={initialPosition}
        initialSize={{ width: 650, height: 550 }}
      >
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ResizableWindow>
    );
  }

  // Show error state
  if (error || !player) {
    return (
      <ResizableWindow
        id={`player-${playerId}`}
        title="Player Not Found"
        isOpen={isOpen}
        onClose={onClose}
        initialPosition={initialPosition}
        initialSize={{ width: 650, height: 550 }}
      >
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-destructive">Could not find player data.</p>
          <Button onClick={onClose} className="mt-4">Close</Button>
        </div>
      </ResizableWindow>
    );
  }
  
  // Helper function to get the current punishment type
  const getCurrentPunishmentType = () => {
    if (!playerInfo.selectedPunishmentCategory) return null;
    
    // Search in all categories
    const allTypes = [
      ...punishmentTypesByCategory.Administrative,
      ...punishmentTypesByCategory.Social,
      ...punishmentTypesByCategory.Gameplay
    ];
    
    return allTypes.find(type => type.name === playerInfo.selectedPunishmentCategory);
  };

  // Helper function to find punishment type for a given warning
  const findPunishmentTypeForWarning = (warning: any) => {
    if (!warning.type) return null;
    
    // Search in all categories
    const allTypes = [
      ...punishmentTypesByCategory.Administrative,
      ...punishmentTypesByCategory.Social,
      ...punishmentTypesByCategory.Gameplay
    ];
    
    return allTypes.find(type => type.name === warning.type);
  };

  // Helper function to get original punishment action (ban/mute/kick) for display
  const getOriginalPunishmentAction = (warning: any, punishmentType: any) => {
    // Check for explicit action types first
    if (warning.type?.toLowerCase().includes('kick')) return 'kick';
    if (warning.type?.toLowerCase().includes('mute')) return 'mute';
    if (warning.type?.toLowerCase().includes('ban') || warning.type?.toLowerCase().includes('blacklist')) return 'ban';
    
    // Check if the punishment type has an action property
    if (punishmentType?.action) {
      return punishmentType.action;
    }
    
    // For other punishment types with durations, default to ban
    if (punishmentType?.durations || punishmentType?.singleSeverityDurations) {
      return 'ban';
    }
    
    return 'punishment';
  };

  // Helper function to determine if a punishment is currently active based on expiry logic
  const isPunishmentCurrentlyActive = (warning: any, effectiveState: any) => {
    // Check if punishment is pardoned/revoked
    const pardonModification = effectiveState.modifications.find((mod: any) => 
      mod.type === 'MANUAL_PARDON' || mod.type === 'APPEAL_ACCEPT'
    );
    
    if (pardonModification) {
      return false; // Pardoned punishments are always inactive
    }
    
    // Check if punishment has modifications with effective expiry
    if (effectiveState.hasModifications && effectiveState.effectiveExpiry) {
      const expiryDate = new Date(effectiveState.effectiveExpiry);
      if (!isNaN(expiryDate.getTime())) {
        const now = new Date();
        return expiryDate.getTime() > now.getTime(); // Active if expiry is in the future
      }
    }
    
    // Check original expiry for unmodified punishments
    if (warning.expires) {
      const expiryDate = new Date(warning.expires);
      if (!isNaN(expiryDate.getTime())) {
        const now = new Date();
        return expiryDate.getTime() > now.getTime(); // Active if expiry is in the future
      }
    }
    
    // For punishments without expiry (permanent), check effective active state
    return effectiveState.effectiveActive;
  };

  // Helper function to format punishment preview
  const getPunishmentPreview = () => {
    const punishmentType = getCurrentPunishmentType();
    if (!punishmentType) return '';
    
    // Determine if this is a ban or mute action
    const getBanOrMuteAction = (typeName: string, punishmentType: any) => {
      // Check for explicit ban/mute in the name
      if (typeName.toLowerCase().includes('mute')) return 'Mute';
      if (typeName.toLowerCase().includes('ban') || typeName.toLowerCase().includes('blacklist')) return 'Ban';
      
      // Check if the punishment type has an action property
      if (punishmentType.action) {
        return punishmentType.action === 'ban' ? 'Ban' : 
               punishmentType.action === 'mute' ? 'Mute' : null;
      }
      
      // For other punishment types, check for duration-based actions
      // If it has durations, it's likely a ban or mute (most gameplay punishments are bans)
      if (punishmentType.durations || punishmentType.singleSeverityDurations) {
        return 'Ban'; // Default assumption for most punishment types
      }
      
      return null;
    };
    
    const action = getBanOrMuteAction(punishmentType.name, punishmentType);
    let preview = action ? `${action} - ${punishmentType.name}` : punishmentType.name;
    
    if (punishmentType.singleSeverityPunishment) {
      if (punishmentType.singleSeverityDurations) {
        // For single-severity punishments, use the selected offense level or default to 'first'
        const offenseLevel = playerInfo.selectedOffenseLevel || 'first';
        const duration = punishmentType.singleSeverityDurations[offenseLevel];
        if (duration) {
          preview += ` (${duration.value} ${duration.unit})`;
        }
      }
    } else if (punishmentType.durations && playerInfo.selectedSeverity) {
      const severityKey = playerInfo.selectedSeverity === 'Lenient' ? 'low' : 
                         playerInfo.selectedSeverity === 'Regular' ? 'regular' : 'severe';
      const duration = punishmentType.durations[severityKey]?.first;
      if (duration) {
        preview += ` (${duration.value} ${duration.unit})`;
      }
    }
    
    // For administrative punishments with manual duration settings
    if (['Manual Mute', 'Manual Ban'].includes(punishmentType.name) && playerInfo.duration) {
      if (playerInfo.isPermanent) {
        preview += ' (Permanent)';
      } else if (playerInfo.duration.value) {
        preview += ` (${playerInfo.duration.value} ${playerInfo.duration.unit})`;
      }
    }
    
    const options = [];
    if (playerInfo.altBlocking && punishmentType.canBeAltBlocking) options.push('Alt-blocking');
    if (playerInfo.statWiping && punishmentType.canBeStatWiping) options.push('Stat-wiping');
    if (playerInfo.silentPunishment) options.push('Silent');
    
    if (options.length > 0) {
      preview += ` [${options.join(', ')}]`;
    }
      return preview;
  };

  // Helper function to calculate effective punishment status and expiry based on modifications
  const getEffectivePunishmentState = (punishment: any) => {
    const modifications = punishment.modifications || [];
    const originalExpiry = punishment.expires || punishment.data?.expires;
    const originalDuration = punishment.duration || punishment.data?.duration;
    const originalActive = punishment.active !== undefined ? punishment.active : (punishment.data?.active !== false);
    
    let effectiveActive = originalActive;
    let effectiveExpiry = originalExpiry;
    let effectiveDuration = originalDuration;
    
    // Apply modifications in chronological order
    const sortedModifications = modifications.sort((a: any, b: any) => {
      const dateA = a.issued ? new Date(a.issued) : new Date(0);
      const dateB = b.issued ? new Date(b.issued) : new Date(0);
      return dateA.getTime() - dateB.getTime();
    });
    
    for (const mod of sortedModifications) {
      if (mod.type === 'MANUAL_PARDON' || mod.type === 'APPEAL_ACCEPT') {
        effectiveActive = false;      } else if (mod.type === 'MANUAL_DURATION_CHANGE' || mod.type === 'APPEAL_DURATION_CHANGE') {
        if (mod.effectiveDuration !== undefined) {
          effectiveDuration = mod.effectiveDuration;
          
          // For duration modifications, calculate expiry from the modification's issued time
          const modificationTime = mod.issued;
          
          // Convert modificationTime to Date object if it's a string
          let modDate;
          if (modificationTime instanceof Date) {
            modDate = modificationTime;
          } else if (typeof modificationTime === 'string') {
            modDate = new Date(modificationTime);
          } else {
            // Fallback to current date if modificationTime is invalid
            console.warn('Invalid modification time, using current date as fallback:', modificationTime);
            modDate = new Date();
          }
          
          // Validate the modDate
          if (isNaN(modDate.getTime())) {
            console.warn('Invalid modification date calculated, using current date as fallback:', modDate);
            modDate = new Date();
          }
            if (mod.effectiveDuration === 0) {
            effectiveExpiry = null; // Permanent
            effectiveActive = true; // Permanent punishments are always active          } else {            effectiveExpiry = new Date(modDate.getTime() + mod.effectiveDuration);
            // Update active status based on whether the new expiry is in the future
            const now = new Date();
            effectiveActive = effectiveExpiry.getTime() > now.getTime();
          }
        }
      }
    }
    
    return {
      originalActive,
      originalExpiry,
      originalDuration,
      effectiveActive,
      effectiveExpiry,
      effectiveDuration,
      hasModifications: modifications.length > 0,
      modifications: sortedModifications
    };
  };
  // Helper function to format duration from milliseconds
  const formatDuration = (durationMs: number) => {
    if (durationMs === 0) return 'Permanent';
    
    const days = Math.floor(durationMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((durationMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((durationMs % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((durationMs % (60 * 1000)) / 1000);
    
    if (days > 0) {
      return `${days}d${hours > 0 ? ` ${hours}h` : ''}`;
    } else if (hours > 0) {
      return `${hours}h${minutes > 0 && hours < 24 ? ` ${minutes}m` : ''}`;
    } else if (minutes > 0) {
      return `${minutes}m${seconds > 0 && minutes < 60 ? ` ${seconds}s` : ''}`;
    } else {
      return `${seconds}s`;
    }
  };

  // Helper function to format date with time (MM/DD/YYYY HH:MM)
  const formatDateWithTime = (date: Date | string | null | undefined) => {
    if (!date) return 'Unknown';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const day = dateObj.getDate().toString().padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = dateObj.getHours().toString().padStart(2, '0');
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    return `${month}/${day}/${year} ${hours}:${minutes}`;
  };
  
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
                <span className="text-2xl font-bold text-primary">{playerInfo.username?.substring(0, 2) || '??'}</span>
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
            <div className="space-y-2">              {playerInfo.warnings.length > 0 ? playerInfo.warnings.map((warning, index) => {
                const isExpanded = expandedPunishments.has(warning.id || `warning-${index}`);
                const isPunishment = warning.id && (warning.severity || warning.status || warning.evidence?.length || warning.notes?.length);
                
                // Calculate effective status and expiry based on modifications
                const effectiveState = getEffectivePunishmentState(warning);
                
                return (                  <div 
                    key={warning.id || `warning-${index}`} 
                    className={`${
                      isPunishmentCurrentlyActive(warning, effectiveState) ? 'bg-muted/30 border-l-4 border-red-500' : 
                      'bg-muted/30'
                    } p-3 rounded-lg`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="bg-gray-50 text-gray-900 border-gray-300">
                            {warning.type}
                          </Badge>
                          {/* Show only Active or Inactive badge based on actual punishment expiry status */}
                          {isPunishmentCurrentlyActive(warning, effectiveState) ? (
                            <Badge className="text-xs bg-red-500 text-white border-red-600">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                              Inactive
                            </Badge>
                          )}
                          {warning.altBlocking && (
                            <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                              Alt-blocking
                            </Badge>
                          )}
                          {warning.severity && (
                            <Badge variant="outline" className={`text-xs ${
                              warning.severity.toLowerCase() === 'low' || warning.severity.toLowerCase() === 'lenient' ? 
                                'bg-green-100 text-green-800 border-green-300' :
                              warning.severity.toLowerCase() === 'regular' || warning.severity.toLowerCase() === 'medium' ?
                                'bg-orange-100 text-orange-800 border-orange-300' :
                                'bg-red-100 text-red-800 border-red-300'
                            }`}>
                              {warning.severity}
                            </Badge>
                          )}
                          {warning.status && (
                            <Badge variant="outline" className={`text-xs ${
                              warning.status.toLowerCase() === 'low' || warning.status.toLowerCase() === 'first' ? 
                                'bg-green-100 text-green-800 border-green-300' :
                              warning.status.toLowerCase() === 'medium' ?
                                'bg-orange-100 text-orange-800 border-orange-300' :
                                'bg-red-100 text-red-800 border-red-300'
                            }`}>
                              {warning.status}
                            </Badge>
                          )}
                          {/* Show punishment status: Active, Inactive, or Unstarted */}
                          {isPunishment && (() => {
                            // Check if punishment is unstarted (started field is null/undefined)
                            if (!warning.started) {
                              return (
                                <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                                  Unstarted
                                </Badge>
                              );
                            }
                            
                            // Check if punishment is inactive (based on effective state)
                            const effectiveState = getEffectivePunishmentState(warning);
                            const isInactive = !effectiveState.effectiveActive;
                            
                            if (isInactive) {
                              return (
                                <Badge variant="outline" className="text-xs bg-gray-100 text-gray-800 border-gray-300">
                                  Inactive
                                </Badge>
                              );
                            }
                            
                            // Punishment is active
                            return (
                              <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                                Active
                              </Badge>
                            );
                          })()}
                        </div>
                        <div className="text-sm mt-1 space-y-1">
                          <p>{warning.reason}</p>
                          
                          {/* Show expiry/duration information with full date and time format */}
                          <div className="text-xs">
                            {(() => {
                              // Don't show expiry countdown for unstarted punishments
                              if (isPunishment && !warning.started) {
                                return (
                                  <div className="text-muted-foreground">
                                    Waiting for server execution
                                  </div>
                                );
                              }
                              // Helper function to format time difference
                              const formatTimeDifference = (timeDiff: number) => {
                                const days = Math.floor(Math.abs(timeDiff) / (24 * 60 * 60 * 1000));
                                const hours = Math.floor((Math.abs(timeDiff) % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                                const minutes = Math.floor((Math.abs(timeDiff) % (60 * 60 * 1000)) / (60 * 1000));
                                
                                if (days > 0) {
                                  return `${days}d${hours > 0 ? ` ${hours}h` : ''}`;
                                } else if (hours > 0) {
                                  return `${hours}h${minutes > 0 && hours < 24 ? ` ${minutes}m` : ''}`;
                                } else {
                                  return `${minutes}m`;
                                }                              };

                              // Check if punishment is inactive/pardoned
                              const pardonModification = effectiveState.modifications.find((mod: any) => 
                                mod.type === 'MANUAL_PARDON' || mod.type === 'APPEAL_ACCEPT'
                              );
                              
                              // Check if punishment is inactive (either pardoned or naturally expired/inactive)
                              const isInactive = !effectiveState.effectiveActive;
                              
                              if (pardonModification) {
                                // Calculate time since pardoned
                                if (pardonModification.issued) {
                                  const pardonDate = new Date(pardonModification.issued);
                                  if (!isNaN(pardonDate.getTime())) {
                                    const now = new Date();
                                    const timeDiff = now.getTime() - pardonDate.getTime();
                                    const timeAgo = formatTimeDifference(timeDiff);
                                    
                                    return (
                                      <div className="text-muted-foreground">
                                        expired {timeAgo} ago ({formatDateWithTime(pardonDate)})
                                      </div>
                                    );
                                  }
                                }
                                return (
                                  <div className="text-muted-foreground">
                                    expired (pardoned)
                                  </div>
                                );
                              } else if (isInactive && warning.expires) {
                                // For other inactive punishments, calculate time since natural expiry
                                const expiryDate = new Date(warning.expires);
                                
                                if (!isNaN(expiryDate.getTime())) {
                                  const now = new Date();
                                  const timeDiff = now.getTime() - expiryDate.getTime();
                                  
                                  if (timeDiff > 0) {
                                    const timeAgo = formatTimeDifference(timeDiff);
                                  
                                    return (
                                      <div className="text-muted-foreground">
                                        expired {timeAgo} ago ({formatDateWithTime(expiryDate)})
                                      </div>
                                    );
                                  }
                                }
                              } else if (effectiveState.hasModifications && effectiveState.effectiveExpiry) {
                                /* Show modified/effective expiry - this takes priority over duration display */
                                const expiryDate = new Date(effectiveState.effectiveExpiry);
                                
                                // Check if the date is valid
                                if (isNaN(expiryDate.getTime())) {
                                  console.error('Invalid effective expiry date for punishment:', {
                                    punishmentId: warning.id,
                                    effectiveExpiry: effectiveState.effectiveExpiry,
                                    effectiveExpiryType: typeof effectiveState.effectiveExpiry,
                                    modifications: effectiveState.modifications,
                                    originalExpiry: effectiveState.originalExpiry,
                                    originalExpired: effectiveState.originalExpiry ? new Date(effectiveState.originalExpiry) : null
                                  });
                                  return (
                                    <div className="text-muted-foreground">
                                      Invalid expiry date (modified)
                                    </div>
                                  );
                                }
                                  const now = new Date();
                                const timeDiff = expiryDate.getTime() - now.getTime();
                                
                                if (timeDiff > 0) {
                                  const timeLeft = formatTimeDifference(timeDiff);
                                  return (
                                    <div className="text-muted-foreground">
                                      expires in {timeLeft} ({formatDateWithTime(expiryDate)})
                                    </div>
                                  );
                                } else {
                                  const timeAgo = formatTimeDifference(-timeDiff);
                                  return (
                                    <div className="text-muted-foreground">
                                      expired {timeAgo} ago ({formatDateWithTime(expiryDate)})
                                    </div>
                                  );
                                }
                              } else if (effectiveState.hasModifications && effectiveState.effectiveDuration !== undefined && effectiveState.effectiveDuration !== null && !effectiveState.effectiveExpiry) {
                                /* Show modified duration only when we don't have an effective expiry */
                                return (
                                  <div className="text-muted-foreground">
                                    {effectiveState.effectiveDuration === 0 ? 'Permanent' : `Duration: ${formatDuration(effectiveState.effectiveDuration)}`}
                                  </div>
                                );} else if (warning.expires) {
                                /* Show original expiry for unmodified punishments */
                                const expiryDate = new Date(warning.expires);
                                
                                // Check if the date is valid
                                if (isNaN(expiryDate.getTime())) {
                                  console.error('Invalid original expiry date for punishment:', {
                                    punishmentId: warning.id,
                                    expires: warning.expires,
                                    expiresType: typeof warning.expires
                                  });
                                  return (
                                    <div className="text-muted-foreground">
                                      Invalid expiry date (original)
                                    </div>
                                  );
                                }
                                
                                const now = new Date();
                                const timeDiff = expiryDate.getTime() - now.getTime();
                                
                                if (timeDiff > 0) {
                                  const timeLeft = formatTimeDifference(timeDiff);
                                  return (
                                    <div className="text-muted-foreground">
                                      expires in {timeLeft} ({formatDateWithTime(expiryDate)})
                                    </div>
                                  );
                                } else {
                                  const timeAgo = formatTimeDifference(-timeDiff);
                                  return (
                                    <div className="text-muted-foreground">
                                      expired {timeAgo} ago ({formatDateWithTime(expiryDate)})
                                    </div>
                                  );
                                }
                              }
                              
                              // Default case - should not reach here but ensures all paths return
                              return null;
                            })()}
                          </div>
                        </div>
                      </div>                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{warning.date}</span>
                        {warning.id && (
                          <span className="text-xs text-muted-foreground">ID: {warning.id}</span>
                        )}
                        {isPunishment && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-0 h-6 w-6"
                            onClick={() => {
                              const id = warning.id || `warning-${index}`;
                              const newExpanded = new Set(expandedPunishments);
                              if (isExpanded) {
                                newExpanded.delete(id);
                              } else {
                                newExpanded.add(id);
                              }
                              setExpandedPunishments(newExpanded);
                            }}
                          >
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground">
                        By: {warning.by}
                        {(() => {
                          // Get the original punishment type and action
                          const punishmentType = findPunishmentTypeForWarning(warning);
                          const originalAction = getOriginalPunishmentAction(warning, punishmentType);
                          const originalDuration = effectiveState.originalDuration;
                          
                          // Always show the original duration and action type
                          if (originalDuration !== undefined && originalDuration !== null) {
                            const durationText = originalDuration === 0 ? 'permanent' : formatDuration(originalDuration);
                            return (
                              <span className="ml-2 opacity-60">
                                ({durationText} {originalAction})
                              </span>
                            );
                          } else if (originalAction && originalAction !== 'punishment') {
                            return (
                              <span className="ml-2 opacity-60">
                                ({originalAction})
                              </span>
                            );
                          }
                          
                          return null;
                        })()}
                      </p>
                    </div>
                      {/* Expanded details */}
                    {isPunishment && isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                        {warning.evidence && warning.evidence.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Evidence:</p>
                            <ul className="text-xs space-y-1">
                              {warning.evidence.map((evidence, idx) => (
                                <li key={idx} className="flex items-start">
                                  <FileText className="h-3 w-3 mr-1 mt-0.5 text-muted-foreground" />
                                  <span className="break-all">{evidence}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {warning.notes && warning.notes.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Staff Notes:</p>
                            <ul className="text-xs space-y-1">
                              {warning.notes.map((note, idx) => {
                                // For manual punishments, skip the first note as it's displayed as the reason
                                const isManualPunishment = ['Kick', 'Manual Mute', 'Manual Ban'].includes(warning.type);
                                if (isManualPunishment && idx === 0) {
                                  return null; // Skip first note for manual punishments
                                }
                                
                                const noteText = typeof note === 'string' ? note : note.text;
                                const noteIssuer = typeof note === 'string' ? 'Unknown' : note.issuerName;
                                const noteDate = typeof note === 'string' ? 'Unknown' : formatDateWithTime(note.date);
                                
                                return (
                                  <li key={idx} className="bg-muted/20 p-2 rounded text-xs">
                                    <p className="mb-1">{noteText}</p>
                                    <p className="text-muted-foreground text-xs">
                                      By: {noteIssuer} on {noteDate}
                                    </p>
                                  </li>
                                );
                              }).filter(Boolean)}
                            </ul>
                          </div>
                        )}
                        
                        {warning.attachedTicketIds && warning.attachedTicketIds.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Attached Tickets:</p>
                            <div className="flex flex-wrap gap-1">
                              {warning.attachedTicketIds.map((ticketId, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  ticket-{ticketId}
                                </Badge>
                              ))}
                            </div>
                          </div>                        )}
                        
                        {/* Modification History */}
                        {effectiveState.hasModifications && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Modification History:</p>                            <div className="space-y-1">
                              {effectiveState.modifications.map((mod: any, idx: number) => (
                                <div key={idx} className="bg-muted/20 p-2 rounded text-xs border-l-2 border-blue-500">
                                  <div className="flex justify-between items-start mb-1">
                                    <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-500/30">
                                      {mod.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                    </Badge>
                                    <span className="text-muted-foreground text-xs">
                                      {formatDateWithTime(mod.issued)}
                                    </span>
                                  </div>
                                  {mod.reason && (
                                    <p className="mb-1">{mod.reason}</p>
                                  )}
                                  {mod.effectiveDuration !== undefined && (
                                    <p className="text-muted-foreground">
                                      New duration: {mod.effectiveDuration === 0 ? 'Permanent' : formatDuration(mod.effectiveDuration)}
                                    </p>
                                  )}
                                  <p className="text-muted-foreground text-xs">
                                    By: {mod.issuerName}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {warning.data && Object.keys(warning.data).length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Additional Data:</p>
                            <div className="text-xs bg-muted/20 p-2 rounded font-mono">
                              {Object.entries(warning.data).map(([key, value]) => (
                                <div key={key}>
                                  <span className="text-muted-foreground">{key}:</span> {JSON.stringify(value)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}                        {/* Action buttons - only show for punishments with IDs */}
                        {warning.id && (
                          <div className="flex gap-2 pt-2 border-t border-border/30">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => {
                              const id = warning.id || `warning-${index}`;
                              setPlayerInfo(prev => ({
                                ...prev,
                                isAddingPunishmentNote: true,
                                punishmentNoteTarget: id,
                                newPunishmentNote: ''
                              }));
                            }}
                          >
                            <StickyNote className="h-3 w-3 mr-1" />
                            Add Note
                          </Button>
                            <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => {
                              const id = warning.id || `warning-${index}`;
                              setPlayerInfo(prev => ({
                                ...prev,
                                isModifyingPunishment: true,
                                modifyPunishmentTarget: id,
                                modifyPunishmentAction: 'modify'
                              }));
                            }}
                          >
                            <Settings className="h-3 w-3 mr-1" />
                            Modify                          </Button>
                        </div>
                        )}                        {/* Add Note Form */}
                        {warning.id && playerInfo.isAddingPunishmentNote && playerInfo.punishmentNoteTarget === (warning.id || `warning-${index}`) && (
                          <div className="mt-3 p-3 bg-muted/20 rounded-lg border">
                            <p className="text-xs font-medium mb-2">Add Note to Punishment</p>
                            <textarea
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm h-16 resize-none"
                              placeholder="Enter your note here..."
                              value={playerInfo.newPunishmentNote || ''}
                              onChange={(e) => setPlayerInfo(prev => ({...prev, newPunishmentNote: e.target.value}))}
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPlayerInfo(prev => ({
                                  ...prev,
                                  isAddingPunishmentNote: false,
                                  punishmentNoteTarget: null,
                                  newPunishmentNote: ''
                                }))}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                disabled={!playerInfo.newPunishmentNote?.trim()}
                                onClick={async () => {
                                  if (!playerInfo.newPunishmentNote?.trim()) return;
                                    try {                                    await addPunishmentNote.mutateAsync({
                                      uuid: playerId,
                                      punishmentId: warning.id!,
                                      noteText: playerInfo.newPunishmentNote
                                    });
                                      toast({
                                      title: "Note added",
                                      description: "Note has been added to the punishment successfully"
                                    });
                                    
                                    // Refetch player data to update the UI
                                    refetch();
                                    
                                    // Reset form
                                    setPlayerInfo(prev => ({
                                      ...prev,
                                      isAddingPunishmentNote: false,
                                      punishmentNoteTarget: null,
                                      newPunishmentNote: ''
                                    }));
                                  } catch (error) {
                                    console.error('Error adding note to punishment:', error);
                                    toast({
                                      title: "Failed to add note",
                                      description: error instanceof Error ? error.message : "An unknown error occurred",
                                      variant: "destructive"
                                    });
                                  }
                                }}
                              >
                                Add Note
                              </Button>
                            </div>
                          </div>                        )}                        {/* Modify Punishment Form */}
                        {warning.id && playerInfo.isModifyingPunishment && playerInfo.modifyPunishmentTarget === (warning.id || `warning-${index}`) && (
                          <div className="mt-3 p-3 bg-muted/20 rounded-lg border">
                            <p className="text-xs font-medium mb-2">Modify Punishment</p>
                            
                            <div className="space-y-2 mb-3">
                              <div>
                                <label className="text-xs text-muted-foreground">Modification Type</label>
                                <select
                                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                                  value={playerInfo.selectedModificationType || ''}
                                  onChange={(e) => setPlayerInfo(prev => ({
                                    ...prev,
                                    selectedModificationType: e.target.value as any
                                  }))}
                                >                                  <option value="">Select modification type...</option>
                                  <option value="MANUAL_DURATION_CHANGE">Change Duration</option>
                                  <option value="MANUAL_PARDON">Pardon</option>
                                  <option value="SET_ALT_BLOCKING_TRUE">Enable Alt Blocking</option>
                                  <option value="SET_WIPING_TRUE">Enable Wiping</option>
                                  <option value="SET_ALT_BLOCKING_FALSE">Disable Alt Blocking</option>
                                  <option value="SET_WIPING_FALSE">Disable Wiping</option>
                                </select>
                              </div>
                                {playerInfo.selectedModificationType === 'MANUAL_DURATION_CHANGE' && (
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-xs text-muted-foreground">New Duration</label>
                                    <input
                                      type="number"
                                      min="0"
                                      className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                                      placeholder="Amount (0 for permanent)"
                                      value={playerInfo.newDuration?.value || ''}
                                      onChange={(e) => setPlayerInfo(prev => ({
                                        ...prev,
                                        newDuration: {
                                          ...prev.newDuration,
                                          value: parseInt(e.target.value) || 0,
                                          unit: prev.newDuration?.unit || 'minutes'
                                        }
                                      }))}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-muted-foreground">Unit</label>
                                    <select
                                      className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                                      value={playerInfo.newDuration?.unit || 'minutes'}
                                      onChange={(e) => setPlayerInfo(prev => ({
                                        ...prev,
                                        newDuration: {
                                          ...prev.newDuration,
                                          value: prev.newDuration?.value || 1,
                                          unit: e.target.value as 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'
                                        }
                                      }))}
                                    >
                                      <option value="seconds">Seconds</option>
                                      <option value="minutes">Minutes</option>
                                      <option value="hours">Hours</option>
                                      <option value="days">Days</option>
                                      <option value="weeks">Weeks</option>
                                      <option value="months">Months</option>
                                    </select>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <div className="mb-3">
                              <label className="text-xs text-muted-foreground">Reason</label>
                              <textarea
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm h-16 resize-none"
                                placeholder="Reason for modification..."
                                value={playerInfo.modifyPunishmentReason || ''}
                                onChange={(e) => setPlayerInfo(prev => ({...prev, modifyPunishmentReason: e.target.value}))}
                              />
                            </div>
                            
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPlayerInfo(prev => ({
                                  ...prev,
                                  isModifyingPunishment: false,
                                  modifyPunishmentTarget: null,
                                  modifyPunishmentAction: null,
                                  modifyPunishmentReason: '',
                                  selectedModificationType: null,
                                  newDuration: undefined
                                }))}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"                                disabled={!playerInfo.modifyPunishmentReason?.trim() || 
                                         !playerInfo.selectedModificationType ||
                                         (playerInfo.selectedModificationType === 'MANUAL_DURATION_CHANGE' && 
                                          playerInfo.newDuration?.value === undefined)}
                                onClick={async () => {                                  if (!playerInfo.modifyPunishmentReason?.trim() || !playerInfo.selectedModificationType) return;
                                  if (playerInfo.selectedModificationType === 'MANUAL_DURATION_CHANGE' && 
                                      playerInfo.newDuration?.value === undefined) return;
                                  
                                  try {                                    await modifyPunishment.mutateAsync({
                                      uuid: playerId,
                                      punishmentId: warning.id!,
                                      modificationType: playerInfo.selectedModificationType!,
                                      reason: playerInfo.modifyPunishmentReason!,
                                      newDuration: playerInfo.newDuration
                                    });
                                      toast({
                                      title: 'Punishment Modified',
                                      description: `Punishment has been modified successfully`
                                    });
                                    
                                    // Refetch player data to update the UI
                                    refetch();
                                    
                                    // Reset form
                                    setPlayerInfo(prev => ({
                                      ...prev,
                                      isModifyingPunishment: false,
                                      modifyPunishmentTarget: null,
                                      modifyPunishmentAction: null,
                                      modifyPunishmentReason: '',
                                      selectedModificationType: null,
                                      newDuration: undefined
                                    }));
                                  } catch (error) {
                                    console.error('Error modifying punishment:', error);
                                    toast({
                                      title: 'Failed to modify punishment',
                                      description: error instanceof Error ? error.message : "An unknown error occurred",
                                      variant: "destructive"
                                    });
                                  }
                                }}
                              >
                                Apply Modification
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="bg-muted/30 p-3 rounded-lg">
                  <p className="text-sm">No moderation history found for this player.</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="linked" className="space-y-2 mx-1 mt-3">
            <h4 className="font-medium">Connected Accounts</h4>
            <p className="text-xs text-muted-foreground mb-3">
              Accounts sharing IPs (excluding proxy/hosting IPs unless within 6 hours of each other)
            </p>
            <div className="bg-muted/30 p-3 rounded-lg">
              <ul className="space-y-2">
                {playerInfo.linkedAccounts.map((account, idx) => (
                  <li key={idx} className="text-sm flex items-center">
                    <Link2 className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                    <span>{account}</span>
                  </li>
                ))}
              </ul>
            </div>
          </TabsContent>
          
          <TabsContent value="notes" className="space-y-2 mx-1 mt-3">
            <h4 className="font-medium">Staff Notes</h4>
            <p className="text-xs text-muted-foreground mb-3">
              Staff notes are administrative comments and are not warnings or punishments.
            </p>
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
                      onClick={async () => {
                        if (!playerInfo.newNote?.trim()) return;
                        
                        const currentDate = new Date();
                        const formattedDate = formatDateWithTime(currentDate);
                        const actualUsername = user?.username || 'Admin';
                        const newNoteWithMetadata = `${playerInfo.newNote} (Added by ${actualUsername} on ${formattedDate})`;
                        
                        // Create the note in the format expected by the API
                        const noteObject = {
                          text: playerInfo.newNote.trim(),
                          issuerName: actualUsername,
                          date: new Date().toISOString()
                        };
                          try {
                          // Send note to the server
                          const response = await fetch(`/api/panel/players/${playerId}/notes`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(noteObject)
                          });
                          
                          if (!response.ok) {
                            throw new Error('Failed to add note to player');
                          }
                          
                          // Update local state
                          setPlayerInfo(prev => ({
                            ...prev,
                            notes: [...prev.notes, newNoteWithMetadata],
                            isAddingNote: false,
                            newNote: ''
                          }));
                          
                          // Force a refetch to get the latest data
                          refetch(); // Refetch player data after adding note
                        } catch (error) {
                          console.error('Error adding note:', error);
                          alert('Failed to add note. Please try again.');
                        }
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
            {isLoadingTickets ? (
              <div className="bg-muted/30 p-3 rounded-lg flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm">Loading tickets...</span>
              </div>
            ) : playerTickets && playerTickets.length > 0 ? (
              <div className="space-y-2">
                {playerTickets.map((ticket: any) => (
                  <div key={ticket._id} className="bg-muted/30 p-3 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Ticket className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium text-sm">{ticket._id}</span>
                          <Badge variant={ticket.status === 'Open' ? 'destructive' : ticket.status === 'Closed' ? 'secondary' : 'default'} className="text-xs">
                            {ticket.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          Category: {ticket.category}
                        </p>
                        <p className="text-sm text-muted-foreground mb-1">
                          Created: {formatDateWithTime(ticket.created)}
                        </p>
                        {ticket.creatorName && (
                          <p className="text-sm text-muted-foreground">
                            Creator: {ticket.creatorName}
                          </p>
                        )}
                        {ticket.tags && ticket.tags.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {ticket.tags.map((tag: string, index: number) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-muted/30 p-3 rounded-lg">
                <p className="text-sm">No tickets found for this player.</p>
              </div>
            )}
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
                    {/* Administrative Punishment Types */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Administrative Actions</label>
                      <div className="grid grid-cols-6 gap-2">
                        {punishmentTypesByCategory.Administrative.length > 0 ? punishmentTypesByCategory.Administrative.map(type => (
                          <Button 
                            key={type.id}
                            variant="outline" 
                            size="sm" 
                            className={`py-1 text-xs ${type.name === 'Kick' && playerInfo.status !== 'Online' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => {
                              if (type.name === 'Kick' && playerInfo.status !== 'Online') {
                                // Prevent kick for offline players
                                return;
                              }
                              
                              setPlayerInfo(prev => {
                                const punishmentType = type;
                                const newPlayerInfo = {
                                  ...prev, 
                                  selectedPunishmentCategory: type.name,
                                  // Reset previous selections
                                  selectedSeverity: undefined as 'Lenient' | 'Regular' | 'Aggravated' | undefined,
                                  selectedOffenseLevel: undefined as 'first' | 'medium' | 'habitual' | undefined,
                                  altBlocking: false,
                                  statWiping: false
                                };
                                
                                // For single-severity punishments, automatically set default offense level
                                if (punishmentType.singleSeverityPunishment) {
                                  newPlayerInfo.selectedOffenseLevel = 'first';
                                }
                                
                                return newPlayerInfo;
                              });
                            }}
                            title={type.name === 'Kick' && playerInfo.status !== 'Online' ? 'Player must be online to kick' : ''}
                          >
                            {type.name}
                          </Button>
                        )) : (
                          <div className="col-span-6 text-xs text-muted-foreground p-2 border border-dashed rounded">
                            {isLoadingSettings ? 'Loading punishment types...' : 'No administrative punishment types configured'}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Social Punishment Types */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Chat & Social</label>
                      <div className="grid grid-cols-6 gap-2">
                        {punishmentTypesByCategory.Social.length > 0 ? punishmentTypesByCategory.Social.map(type => (
                          <Button 
                            key={type.id}
                            variant="outline" 
                            size="sm" 
                            className="py-1 text-xs" 
                            onClick={() => setPlayerInfo(prev => {
                              const punishmentType = type;
                              const newPlayerInfo = {
                                ...prev, 
                                selectedPunishmentCategory: type.name,
                                // Reset previous selections
                                selectedSeverity: undefined as 'Lenient' | 'Regular' | 'Aggravated' | undefined,
                                selectedOffenseLevel: undefined as 'first' | 'medium' | 'habitual' | undefined,
                                altBlocking: false,
                                statWiping: false
                              };
                              
                              // For single-severity punishments, automatically set default offense level
                              if (punishmentType.singleSeverityPunishment) {
                                newPlayerInfo.selectedOffenseLevel = 'first';
                              }
                              
                              return newPlayerInfo;
                            })}
                          >
                            {type.name}
                          </Button>
                        )) : (
                          <div className="col-span-6 text-xs text-muted-foreground p-2 border border-dashed rounded">
                            {isLoadingSettings ? 'Loading punishment types...' : 'No social punishment types configured'}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Gameplay Punishment Types */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Game & Account</label>
                      <div className="grid grid-cols-6 gap-2">
                        {punishmentTypesByCategory.Gameplay.length > 0 ? punishmentTypesByCategory.Gameplay.map(type => (
                          <Button 
                            key={type.id}
                            variant="outline" 
                            size="sm" 
                            className="py-1 text-xs" 
                            onClick={() => setPlayerInfo(prev => {
                              const punishmentType = type;
                              const newPlayerInfo = {
                                ...prev, 
                                selectedPunishmentCategory: type.name,
                                // Reset previous selections
                                selectedSeverity: undefined as 'Lenient' | 'Regular' | 'Aggravated' | undefined,
                                selectedOffenseLevel: undefined as 'first' | 'medium' | 'habitual' | undefined,
                                altBlocking: false,
                                statWiping: false
                              };
                              
                              // For single-severity punishments, automatically set default offense level
                              if (punishmentType.singleSeverityPunishment) {
                                newPlayerInfo.selectedOffenseLevel = 'first';
                              }
                              
                              return newPlayerInfo;
                            })}
                          >
                            {type.name}
                          </Button>
                        )) : (
                          <div className="col-span-6 text-xs text-muted-foreground p-2 border border-dashed rounded">
                            {isLoadingSettings ? 'Loading punishment types...' : 'No gameplay punishment types configured'}
                          </div>
                        )}
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
                        selectedOffenseLevel: undefined,
                        duration: undefined,
                        reason: undefined,
                        evidence: undefined,
                        evidenceList: undefined,
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
                      </div>                      {playerInfo.status !== 'Online' && (
                        <div className="bg-warning/10 p-3 rounded-lg text-sm text-warning">
                          Player is not currently online. Kick action is only available for online players.
                        </div>                      )}
                      
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
                                  value: parseInt(e.target.value) || 1,
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
                                  unit: e.target.value as 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'
                                }
                              }))}
                            >
                              <option value="seconds">Seconds</option>
                              <option value="minutes">Minutes</option>
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
                                  value: parseInt(e.target.value) || 1,
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
                                  unit: e.target.value as 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'
                                }
                              }))}
                            >
                              <option value="seconds">Seconds</option>
                              <option value="minutes">Minutes</option>
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
                  )}                  {/* Security Ban, Bad Skin, Bad Name */}
                  {(playerInfo.selectedPunishmentCategory === 'Security Ban' || 
                    playerInfo.selectedPunishmentCategory === 'Bad Skin' || 
                    playerInfo.selectedPunishmentCategory === 'Bad Name') && (
                    <>
                      {/* These punishment types have no additional configuration */}
                    </>
                  )}

                  {/* Linked Ban */}
                  {playerInfo.selectedPunishmentCategory === 'Linked Ban' && (
                    <>                      <div className="space-y-2">
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
                    </>
                  )}                  {/* Blacklist */}
                  {playerInfo.selectedPunishmentCategory === 'Blacklist' && (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <input 
                            type="checkbox" 
                            id="ban-linked-blacklist" 
                            className="rounded mr-2"
                            checked={!!playerInfo.banLinkedAccounts}
                            onChange={(e) => setPlayerInfo(prev => ({...prev, banLinkedAccounts: e.target.checked}))}
                          />
                          <label htmlFor="ban-linked-blacklist" className="text-sm">Ban Linked Accounts</label>
                        </div>
                      </div>
                    </>
                  )}{/* Generic punishment types (all non-administrative) */}
                  {playerInfo.selectedPunishmentCategory && 
                   !['Kick', 'Manual Mute', 'Manual Ban', 'Security Ban', 'Bad Skin', 'Bad Name', 'Linked Ban', 'Blacklist'].includes(playerInfo.selectedPunishmentCategory) && (
                    <>
                      {(() => {
                        const punishmentType = getCurrentPunishmentType();
                        const isSingleSeverity = punishmentType?.singleSeverityPunishment;
                        return (
                          <>
                            {!isSingleSeverity && (
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
                            )}
                            
                            {isSingleSeverity && (
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Offense Level</label>
                                <div className="flex gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className={`flex-1 ${playerInfo.selectedOffenseLevel === 'first' ? 'bg-primary/20 border-primary/40' : ''}`}
                                    onClick={() => setPlayerInfo(prev => ({...prev, selectedOffenseLevel: 'first'}))}
                                  >
                                    First Offense
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className={`flex-1 ${playerInfo.selectedOffenseLevel === 'medium' ? 'bg-primary/20 border-primary/40' : ''}`}
                                    onClick={() => setPlayerInfo(prev => ({...prev, selectedOffenseLevel: 'medium'}))}
                                  >
                                    Medium
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className={`flex-1 ${playerInfo.selectedOffenseLevel === 'habitual' ? 'bg-primary/20 border-primary/40' : ''}`}
                                    onClick={() => setPlayerInfo(prev => ({...prev, selectedOffenseLevel: 'habitual'}))}
                                  >
                                    Habitual
                                  </Button>
                                </div>
                              </div>                            )}
                            
                            {/* Display punishment options */}
                            {(punishmentType?.canBeAltBlocking || punishmentType?.canBeStatWiping) && (
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Punishment Options</label>
                                <div className="space-y-2">
                                  {punishmentType.canBeAltBlocking && (
                                    <div className="flex items-center">
                                      <input 
                                        type="checkbox" 
                                        id="alt-blocking" 
                                        className="rounded mr-2"
                                        checked={!!playerInfo.altBlocking}
                                        onChange={(e) => setPlayerInfo(prev => ({...prev, altBlocking: e.target.checked}))}
                                      />
                                      <label htmlFor="alt-blocking" className="text-sm">Alt-blocking</label>
                                      <span className="text-xs text-muted-foreground ml-2">- Prevents alternative accounts from connecting</span>
                                    </div>
                                  )}
                                  {punishmentType.canBeStatWiping && (
                                    <div className="flex items-center">
                                      <input 
                                        type="checkbox" 
                                        id="stat-wiping" 
                                        className="rounded mr-2"
                                        checked={!!playerInfo.statWiping}
                                        onChange={(e) => setPlayerInfo(prev => ({...prev, statWiping: e.target.checked}))}
                                      />
                                      <label htmlFor="stat-wiping" className="text-sm">Stat-wiping</label>
                                      <span className="text-xs text-muted-foreground ml-2">- Resets player statistics and progress</span>
                                    </div>
                                  )}
                                </div>
                              </div>                            )}
  
                          </>
                        );
                      })()}
                    </>
                  )}                  {/* Evidence and Attach Reports - shown for all punishment types */}
                  {playerInfo.selectedPunishmentCategory && (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">Evidence</label>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setPlayerInfo(prev => ({
                              ...prev, 
                              evidenceList: [...(prev.evidenceList || []), '']
                            }))}
                            className="text-xs h-7 px-2"
                          >
                            + Add
                          </Button>
                        </div>
                        <div className="space-y-2">                          {(playerInfo.evidenceList || []).map((evidence, index) => (
                            <div key={index} className="flex gap-2 items-center">
                              <input 
                                type="text" 
                                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm" 
                                placeholder="URLs, screenshots, or text evidence"
                                value={evidence}
                                onChange={(e) => {
                                  const newEvidence = [...(playerInfo.evidenceList || [])];
                                  newEvidence[index] = e.target.value;
                                  setPlayerInfo(prev => ({...prev, evidenceList: newEvidence}));
                                }}
                              />
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="p-0 h-8 w-8"
                                onClick={() => {
                                  // Create hidden file input for upload
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*,video/*,.txt,.pdf,.doc,.docx';
                                  input.onchange = (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) {
                                      // For now, just set the filename as evidence
                                      // In a real implementation, you'd upload the file and get a URL
                                      const newEvidence = [...(playerInfo.evidenceList || [])];
                                      newEvidence[index] = file.name;
                                      setPlayerInfo(prev => ({...prev, evidenceList: newEvidence}));
                                      toast({
                                        title: "File selected",
                                        description: `${file.name} has been selected as evidence.`,
                                      });
                                    }
                                  };
                                  input.click();
                                }}
                                title="Upload file"
                              >
                                <Upload className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="p-0 h-8 w-8 text-destructive"
                                onClick={() => {
                                  const newEvidence = [...(playerInfo.evidenceList || [])];
                                  newEvidence.splice(index, 1);
                                  setPlayerInfo(prev => ({...prev, evidenceList: newEvidence}));
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
                      </div>                      <div className="pt-2">
                        <Button 
                          type="button"
                          className="w-full"
                          onClick={handleApplyPunishment}
                          disabled={isApplyingPunishment}
                        >
                          {isApplyingPunishment ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Applying...
                            </>                          ) : (
                            <>
                              Apply: {getPunishmentPreview() || 'Select punishment options'}
                            </>
                          )}
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