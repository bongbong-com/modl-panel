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

  // Process settings data to extract punishment types by category
  useEffect(() => {
    const punishmentTypesData = settingsData?.settings?.punishmentTypes;
    if (punishmentTypesData) {
      try {
        // Parse punishment types if they're stored as a string
        const typesData = typeof punishmentTypesData === 'string' 
          ? JSON.parse(punishmentTypesData) 
          : punishmentTypesData;
          
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
    let gameplayPoints = 0;

    // Calculate points from active punishments
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

  // Helper function to calculate effective punishment status and expiry based on modifications
  const getEffectivePunishmentState = (punishment: any) => {
    const modifications = punishment.modifications || [];
    
    let effectiveActive = punishment.active;
    let effectiveExpiry = punishment.expires;
    let effectiveDuration = punishment.duration;
    let hasModifications = modifications.length > 0;
    
    // Process modifications in chronological order (oldest first)
    const sortedModifications = [...modifications].sort((a, b) => 
      new Date(a.issued).getTime() - new Date(b.issued).getTime()
    );
    
    for (const mod of sortedModifications) {
      switch (mod.type) {
        case 'MANUAL_PARDON':
        case 'APPEAL_ACCEPT':
          effectiveActive = false;
          effectiveExpiry = mod.issued; // Set expiry to when it was pardoned
          break;
        case 'MANUAL_DURATION_CHANGE':
          if (mod.effectiveDuration !== undefined) {
            effectiveDuration = mod.effectiveDuration;
            // Calculate new expiry based on new duration and punishment start time
            if (mod.effectiveDuration === 0 || mod.effectiveDuration === -1 || mod.effectiveDuration < 0) {
              effectiveExpiry = null; // Permanent
            } else if (punishment.issued || punishment.date) {
              const startTime = new Date(punishment.issued || punishment.date);
              effectiveExpiry = new Date(startTime.getTime() + mod.effectiveDuration).toISOString();
            }
          }
          break;
        // Add other modification types as needed
      }
    }
    
    return {
      effectiveActive,
      effectiveExpiry,
      effectiveDuration,
      hasModifications,
      modifications: sortedModifications,
      originalExpiry: punishment.expires
    };
  };

  // Helper function to safely get data from player.data (handles both Map and plain object)
  const getPlayerData = (player: any, key: string) => {
    if (!player?.data) return undefined;
    if (typeof player.data.get === 'function') {
      return player.data.get(key);
    }
    return (player.data as any)[key];
  };

  // Helper function to format date with time
  const formatDateWithTime = (date: any) => {
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

  // Load player data into state when it changes
  useEffect(() => {
    if (player) {
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
        
        // Initialize warnings array
        const warnings: any[] = [];
        
        // Add punishments to warnings with full details
        if (player.punishments) {
          player.punishments.forEach((punishment: any) => {
            // Determine punishment type name from ordinal using settings data
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
              severity: (() => {
                // For linked bans (type_ordinal 4), severity should always be null
                if (punishment.type_ordinal === 4) return null;
                const severity = punishment.data?.severity || (punishment.data?.get ? punishment.data.get('severity') : punishment.severity);
                return severity === 0 || severity === '0' || severity === null || severity === undefined ? null : severity;
              })(),
              status: (() => {
                // For linked bans (type_ordinal 4), status should always be null
                if (punishment.type_ordinal === 4) return null;
                const status = punishment.data?.status || (punishment.data?.get ? punishment.data.get('status') : punishment.status);
                return status === 0 || status === '0' || status === null || status === undefined ? null : status;
              })(),
              evidence: punishment.evidence || [],
              notes: punishment.notes || [],
              attachedTicketIds: punishment.attachedTicketIds || [],
              active: punishment.data?.active !== false || (punishment.data?.get ? punishment.data.get('active') !== false : punishment.active),
              modifications: punishment.modifications || [],
              expires: punishment.expires || punishment.data?.expires || (punishment.data?.get ? punishment.data.get('expires') : null),
              data: punishment.data || {},
              altBlocking: punishment.data?.altBlocking || (punishment.data?.get ? punishment.data.get('altBlocking') : false),
              started: punishment.started
            });
          });
        }
        
        // Extract notes
        const notes = player.notes 
          ? player.notes.map((note: any) => `${note.text} (Added by ${note.issuerName} on ${formatDateWithTime(note.date)})`) 
          : [];
        
        // Extract linked accounts from API data
        const linkedAccounts: string[] = [];
        
        if (linkedAccountsData?.linkedAccounts && Array.isArray(linkedAccountsData.linkedAccounts)) {
          linkedAccountsData.linkedAccounts.forEach((account: any) => {
            const statusInfo = [];
            if (account.activeBans > 0) statusInfo.push(`${account.activeBans} active ban${account.activeBans > 1 ? 's' : ''}`);
            if (account.activeMutes > 0) statusInfo.push(`${account.activeMutes} active mute${account.activeMutes > 1 ? 's' : ''}`);
            
            const statusText = statusInfo.length > 0 ? ` (${statusInfo.join(', ')})` : '';
            linkedAccounts.push(`${account.username}${statusText}`);
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
            statusThresholds = settingsData.settings.statusThresholds;
          } catch (error) {
            console.error("Error parsing status thresholds:", error);
          }
        }
        
        const calculatedStatus = calculatePlayerStatus(player.punishments || [], allPunishmentTypes, statusThresholds);
        
        // Sort warnings by date (most recent first)
        warnings.sort((a, b) => {
          const dateA = new Date(a.date || a.issued || 0).getTime();
          const dateB = new Date(b.date || b.issued || 0).getTime();
          return dateB - dateA; // Descending order (newest first)
        });
        
        setPlayerInfo(prev => ({
          ...prev,
          username: currentUsername,
          status: getPlayerData(player, 'isOnline') ? 'Online' : (status === 'Active' ? 'Offline' : status),
          region: player.latestIPData?.region || player.region || 'Unknown',
          country: player.latestIPData?.country || player.country || 'Unknown',
          firstJoined: firstJoined,
          lastOnline: getPlayerData(player, 'isOnline') ? 'Online' : 
            (getPlayerData(player, 'lastDisconnect') ? 
              formatDateWithTime(getPlayerData(player, 'lastDisconnect')) : 
              'Unknown'),
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
    }
  }, [player, punishmentTypesByCategory, settingsData, linkedAccountsData]);

  // Trigger linked account search when player data is loaded
  useEffect(() => {
    if (player && playerId) {
      triggerLinkedAccountSearch();
    }
  }, [player, playerId, triggerLinkedAccountSearch]);

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
              {playerInfo.warnings.length > 0 ? playerInfo.warnings.map((warning, index) => (
                <div 
                  key={warning.id || `warning-${index}`} 
                  className="bg-muted/30 p-3 rounded-lg"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-gray-50 text-gray-900 border-gray-300">
                          {warning.type}
                        </Badge>
                        {warning.severity && (
                          <Badge variant="outline" className={`text-xs ${
                            (warning.severity && warning.severity.toLowerCase() === 'low') || (warning.severity && warning.severity.toLowerCase() === 'lenient') ? 
                              'bg-green-100 text-green-800 border-green-300' :
                            (warning.severity && warning.severity.toLowerCase() === 'regular') || (warning.severity && warning.severity.toLowerCase() === 'medium') ?
                              'bg-orange-100 text-orange-800 border-orange-300' :
                              'bg-red-100 text-red-800 border-red-300'
                          }`}>
                            {warning.severity}
                          </Badge>
                        )}
                        {warning.status && (
                          <Badge variant="outline" className={`text-xs ${
                            (warning.status && warning.status.toLowerCase() === 'low') || (warning.status && warning.status.toLowerCase() === 'first') ? 
                              'bg-green-100 text-green-800 border-green-300' :
                            warning.status && warning.status.toLowerCase() === 'medium' ?
                              'bg-orange-100 text-orange-800 border-orange-300' :
                              'bg-red-100 text-red-800 border-red-300'
                          }`}>
                            {warning.status}
                          </Badge>
                        )}
                        {warning.altBlocking && (
                          <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                            Alt-blocking
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm mt-1 space-y-1">
                        <p>{warning.reason}</p>
                        <div className="text-xs text-muted-foreground">
                          {warning.date} by {warning.by}
                        </div>
                      </div>
                    </div>
                  </div>
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