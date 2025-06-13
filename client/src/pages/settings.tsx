import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bot, MessageSquare, Scale, Shield, Globe, Tag, Plus, X, Fingerprint, KeyRound, Lock, QrCode, Copy, Check, Mail, Trash2, GripVertical, GamepadIcon, MessageCircle, Save, CheckCircle, User as UserIcon, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSidebar } from '@/hooks/use-sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettings } from '@/hooks/use-data';
import PageContainer from '@/components/layout/PageContainer'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { queryClient } from '@/lib/queryClient';
import { useBeforeUnload } from 'react-router-dom';
import { useLocation } from "wouter"; // For wouter navigation
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from '@/hooks/use-auth';

// Type definitions for punishment types
interface PunishmentType {
  id: number;
  name: string;
  category: 'Gameplay' | 'Social' | 'Core';
  isCustomizable: boolean;
  ordinal: number;
  durations?: {
    low: { 
      first: { value: number; unit: 'hours' | 'days' | 'weeks' | 'months'; };
      medium: { value: number; unit: 'hours' | 'days' | 'weeks' | 'months'; };
      habitual: { value: number; unit: 'hours' | 'days' | 'weeks' | 'months'; };
    };
    regular: {
      first: { value: number; unit: 'hours' | 'days' | 'weeks' | 'months'; };
      medium: { value: number; unit: 'hours' | 'days' | 'weeks' | 'months'; };
      habitual: { value: number; unit: 'hours' | 'days' | 'weeks' | 'months'; };
    };
    severe: {
      first: { value: number; unit: 'hours' | 'days' | 'weeks' | 'months'; };
      medium: { value: number; unit: 'hours' | 'days' | 'weeks' | 'months'; };
      habitual: { value: number; unit: 'hours' | 'days' | 'weeks' | 'months'; };
    };
  };
  points?: number;
}

// Type definition for offender status thresholds
interface StatusThresholds {
  gameplay: {
    medium: number;  // Points threshold for medium offender status
    habitual: number; // Points threshold for habitual offender status
  };
  social: {
    medium: number;  // Points threshold for medium offender status
    habitual: number; // Points threshold for habitual offender status
  };
}

const Settings = () => {
  const { } = useSidebar();
  const [, navigateWouter] = useLocation();
  const { user, logout } = useAuth();
  const mainContentClass = "ml-[32px] pl-8";

  // Auto-save state
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialSettingsRef = useRef<any | null>(null);
  const justLoadedFromServerRef = useRef(true);
  const pendingChangesRef = useRef(false);
  const initialLoadCompletedRef = useRef(false);

  // Database connection state
  const [dbConnectionStatus, setDbConnectionStatus] = useState(false);
  const [mongodbUri, setMongodbUri] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Punishment types state
  // State for all settings fields
  const [punishmentTypes, setPunishmentTypesState] = useState<PunishmentType[]>([
    // Fixed punishment types (not customizable)
    { id: 0, name: 'Kick', category: 'Core', isCustomizable: false, ordinal: 0 },
    { id: 1, name: 'Manual Mute', category: 'Core', isCustomizable: false, ordinal: 1 },
    { id: 2, name: 'Manual Ban', category: 'Core', isCustomizable: false, ordinal: 2 },
    { id: 3, name: 'Security Ban', category: 'Core', isCustomizable: false, ordinal: 3 },
    { id: 4, name: 'Linked Ban', category: 'Core', isCustomizable: false, ordinal: 4 },
    { id: 5, name: 'Blacklist', category: 'Core', isCustomizable: false, ordinal: 5 },
    // Customizable punishment types
    {
      id: 6,
      name: 'Bad Skin',
      category: 'Social',
      isCustomizable: true,
      ordinal: 6,
      durations: {
        low: { first: { value: 24, unit: 'hours' }, medium: { value: 3, unit: 'days' }, habitual: { value: 7, unit: 'days' } },
        regular: { first: { value: 2, unit: 'days' }, medium: { value: 4, unit: 'days' }, habitual: { value: 10, unit: 'days' } },
        severe: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } }
      },
      points: 2
    },
    {
      id: 7,
      name: 'Bad Name',
      category: 'Social',
      isCustomizable: true,
      ordinal: 7,
      durations: {
        low: { first: { value: 24, unit: 'hours' }, medium: { value: 3, unit: 'days' }, habitual: { value: 7, unit: 'days' } },
        regular: { first: { value: 2, unit: 'days' }, medium: { value: 4, unit: 'days' }, habitual: { value: 10, unit: 'days' } },
        severe: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } }
      },
      points: 2
    },
    {
      id: 8,
      name: 'Chat Abuse',
      category: 'Social',
      isCustomizable: true,
      ordinal: 8,
      durations: {
        low: { first: { value: 24, unit: 'hours' }, medium: { value: 2, unit: 'days' }, habitual: { value: 4, unit: 'days' } },
        regular: { first: { value: 2, unit: 'days' }, medium: { value: 4, unit: 'days' }, habitual: { value: 7, unit: 'days' } },
        severe: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } }
      },
      points: 2
    },
    {
      id: 9,
      name: 'Anti Social',
      category: 'Social',
      isCustomizable: true,
      ordinal: 9,
      durations: {
        low: { first: { value: 24, unit: 'hours' }, medium: { value: 2, unit: 'days' }, habitual: { value: 4, unit: 'days' } },
        regular: { first: { value: 2, unit: 'days' }, medium: { value: 4, unit: 'days' }, habitual: { value: 7, unit: 'days' } },
        severe: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } }
      },
      points: 3
    },
    {
      id: 10,
      name: 'Targeting',
      category: 'Social',
      isCustomizable: true,
      ordinal: 10,
      durations: {
        low: { first: { value: 2, unit: 'days' }, medium: { value: 4, unit: 'days' }, habitual: { value: 7, unit: 'days' } },
        regular: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } },
        severe: { first: { value: 7, unit: 'days' }, medium: { value: 14, unit: 'days' }, habitual: { value: 30, unit: 'days' } }
      },
      points: 4
    },
    {
      id: 11,
      name: 'Bad Content',
      category: 'Social',
      isCustomizable: true,
      ordinal: 11,
      durations: {
        low: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } },
        regular: { first: { value: 7, unit: 'days' }, medium: { value: 14, unit: 'days' }, habitual: { value: 30, unit: 'days' } },
        severe: { first: { value: 14, unit: 'days' }, medium: { value: 30, unit: 'days' }, habitual: { value: 60, unit: 'days' } }
      },
      points: 5
    },
    {
      id: 12,
      name: 'Team Abuse',
      category: 'Gameplay',
      isCustomizable: true,
      ordinal: 12,
      durations: {
        low: { first: { value: 24, unit: 'hours' }, medium: { value: 3, unit: 'days' }, habitual: { value: 7, unit: 'days' } },
        regular: { first: { value: 2, unit: 'days' }, medium: { value: 4, unit: 'days' }, habitual: { value: 10, unit: 'days' } },
        severe: { first: { value: 4, unit: 'days' }, medium: { value: 10, unit: 'days' }, habitual: { value: 30, unit: 'days' } }
      },
      points: 2
    },
    {
      id: 13,
      name: 'Game Abuse',
      category: 'Gameplay',
      isCustomizable: true,
      ordinal: 13,
      durations: {
        low: { first: { value: 24, unit: 'hours' }, medium: { value: 3, unit: 'days' }, habitual: { value: 7, unit: 'days' } },
        regular: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } },
        severe: { first: { value: 7, unit: 'days' }, medium: { value: 14, unit: 'days' }, habitual: { value: 30, unit: 'days' } }
      },
      points: 4
    },
    {
      id: 14,
      name: 'Cheating',
      category: 'Gameplay',
      isCustomizable: true,
      ordinal: 14,
      durations: {
        low: { first: { value: 7, unit: 'days' }, medium: { value: 14, unit: 'days' }, habitual: { value: 30, unit: 'days' } },
        regular: { first: { value: 14, unit: 'days' }, medium: { value: 30, unit: 'days' }, habitual: { value: 60, unit: 'days' } },
        severe: { first: { value: 30, unit: 'days' }, medium: { value: 60, unit: 'days' }, habitual: { value: 180, unit: 'days' } }
      },
      points: 7
    },
    {
      id: 15,
      name: 'Game Trading',
      category: 'Gameplay',
      isCustomizable: true,
      ordinal: 15,
      durations: {
        low: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } },
        regular: { first: { value: 7, unit: 'days' }, medium: { value: 14, unit: 'days' }, habitual: { value: 30, unit: 'days' } },
        severe: { first: { value: 14, unit: 'days' }, medium: { value: 30, unit: 'days' }, habitual: { value: 60, unit: 'days' } }
      },
      points: 5
    },
    {
      id: 16,
      name: 'Account Abuse',
      category: 'Gameplay',
      isCustomizable: true,
      ordinal: 16,
      durations: {
        low: { first: { value: 7, unit: 'days' }, medium: { value: 14, unit: 'days' }, habitual: { value: 30, unit: 'days' } },
        regular: { first: { value: 14, unit: 'days' }, medium: { value: 30, unit: 'days' }, habitual: { value: 60, unit: 'days' } },
        severe: { first: { value: 30, unit: 'days' }, medium: { value: 60, unit: 'days' }, habitual: { value: 120, unit: 'days' } }
      },
      points: 6
    },
    {
      id: 17,
      name: 'Scamming',
      category: 'Social',
      isCustomizable: true,
      ordinal: 17,
      durations: {
        low: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } },
        regular: { first: { value: 7, unit: 'days' }, medium: { value: 14, unit: 'days' }, habitual: { value: 30, unit: 'days' } },
        severe: { first: { value: 14, unit: 'days' }, medium: { value: 30, unit: 'days' }, habitual: { value: 60, unit: 'days' } }
      },
      points: 5
    }
  ]);
  const [newPunishmentName, setNewPunishmentNameState] = useState('');
  const [newPunishmentCategory, setNewPunishmentCategoryState] = useState<'Gameplay' | 'Social'>('Gameplay');
  
  // Threshold values for player status levels
  const [statusThresholds, setStatusThresholdsState] = useState<StatusThresholds>({
    gameplay: {
      medium: 5,  // 5+ points = medium offender
      habitual: 10 // 10+ points = habitual offender
    },
    social: {
      medium: 4,  // 4+ points = medium offender
      habitual: 8  // 8+ points = habitual offender
    }
  });
  
  // Selected punishment for editing
  const [selectedPunishment, setSelectedPunishmentState] = useState<PunishmentType | null>(null);
  
  // State to control visibility of core punishment types
  const [showCorePunishments, setShowCorePunishmentsState] = useState(false);
  
  // Sliders state
  const [toxicity, setToxicityState] = useState(75);
  const [spam, setSpamState] = useState(60);
  const [automated, setAutomatedState] = useState(40);

  const [aiModeration, setAiModerationState] = useState(true);
  const [aiChat, setAiChatState] = useState(true);
  const [aiBan, setAiBanState] = useState(true);
  const [staffOverride, setStaffOverrideState] = useState(true);
  const [requireApproval, setRequireApprovalState] = useState(true);
  
  // Tags state for each ticket category
  const [bugReportTags, setBugReportTagsState] = useState<string[]>([
    'UI Issue', 'Server', 'Performance', 'Crash', 'Game Mechanics'
  ]);
  const [playerReportTags, setPlayerReportTagsState] = useState<string[]>([
    'Harassment', 'Cheating', 'Spam', 'Inappropriate Content', 'Griefing'
  ]);
  const [appealTags, setAppealTagsState] = useState<string[]>([
    'Ban Appeal', 'Mute Appeal', 'False Positive', 'Second Chance'
  ]);
  
  // For new tag input
  const [newBugTag, setNewBugTagState] = useState('');
  const [newPlayerTag, setNewPlayerTagState] = useState('');
  const [newAppealTag, setNewAppealTagState] = useState('');
  
  // Security tab states
  const [has2FA, setHas2FAState] = useState(false);
  const [hasPasskey, setHasPasskeyState] = useState(false);
  const [showSetup2FA, setShowSetup2FAState] = useState(false);
  const [showSetupPasskey, setShowSetupPasskeyState] = useState(false);
  const [recoveryCodesCopied, setRecoveryCodesCopiedState] = useState(false);
  
  const { toast } = useToast();
  const { data: settingsData, isLoading: isLoadingSettings, isFetching: isFetchingSettings } = useSettings();
  const [currentEmail, setCurrentEmail] = useState('');

  useEffect(() => {
    if (user?.email) {
      setCurrentEmail(user.email);
    }
  }, [user]);

  // Define captureInitialSettings first, before it's used anywhere else
  const captureInitialSettings = useCallback(() => {
    const currentSettingsSnapshot = {
      punishmentTypes: JSON.parse(JSON.stringify(punishmentTypes)), // Deep copy
      statusThresholds: JSON.parse(JSON.stringify(statusThresholds)), // Deep copy
      aiModeration,
      aiChat,
      aiBan,
      staffOverride,
      requireApproval,
      toxicity,
      spam,
      automated,
      bugReportTags: JSON.parse(JSON.stringify(bugReportTags)), // Deep copy
      playerReportTags: JSON.parse(JSON.stringify(playerReportTags)), // Deep copy
      appealTags: JSON.parse(JSON.stringify(appealTags)), // Deep copy
      mongodbUri,
      has2FA,
      hasPasskey,
    };
    initialSettingsRef.current = currentSettingsSnapshot;
  }, [punishmentTypes, statusThresholds, aiModeration, aiChat, aiBan, staffOverride, requireApproval, toxicity, spam, automated, bugReportTags, playerReportTags, appealTags, mongodbUri, has2FA, hasPasskey]);

  // Helper to apply a settings object to all state variables without triggering auto-save
  const applySettingsObjectToState = useCallback((settingsObject: any) => {
    if (!settingsObject) return;

    justLoadedFromServerRef.current = true;
    console.log("[SettingsPage] Applying settings from server to state");
    
    // Use direct state setters to avoid triggering auto-save during load
    if (settingsObject.punishmentTypes) {
      const pt = settingsObject.punishmentTypes;
      setPunishmentTypesState(typeof pt === 'string' ? JSON.parse(pt) : JSON.parse(JSON.stringify(pt)));
    }
    if (settingsObject.statusThresholds) setStatusThresholdsState(JSON.parse(JSON.stringify(settingsObject.statusThresholds)));
    if (settingsObject.aiModeration !== undefined) setAiModerationState(settingsObject.aiModeration);
    if (settingsObject.aiChat !== undefined) setAiChatState(settingsObject.aiChat);
    if (settingsObject.aiBan !== undefined) setAiBanState(settingsObject.aiBan);
    if (settingsObject.staffOverride !== undefined) setStaffOverrideState(settingsObject.staffOverride);
    if (settingsObject.requireApproval !== undefined) setRequireApprovalState(settingsObject.requireApproval);
    if (settingsObject.toxicity !== undefined) setToxicityState(settingsObject.toxicity);
    if (settingsObject.spam !== undefined) setSpamState(settingsObject.spam);
    if (settingsObject.automated !== undefined) setAutomatedState(settingsObject.automated);
    if (settingsObject.bugReportTags) {
      const brt = settingsObject.bugReportTags;
      setBugReportTagsState(typeof brt === 'string' ? JSON.parse(brt) : JSON.parse(JSON.stringify(brt)));
    }
    if (settingsObject.playerReportTags) {
      const prt = settingsObject.playerReportTags;
      setPlayerReportTagsState(typeof prt === 'string' ? JSON.parse(prt) : JSON.parse(JSON.stringify(prt)));
    }
    if (settingsObject.appealTags) {
      const at = settingsObject.appealTags;
      setAppealTagsState(typeof at === 'string' ? JSON.parse(at) : JSON.parse(JSON.stringify(at)));
    }
    if (settingsObject.mongodbUri !== undefined) setMongodbUri(settingsObject.mongodbUri);
    if (settingsObject.has2FA !== undefined) setHas2FAState(settingsObject.has2FA);
    if (settingsObject.hasPasskey !== undefined) setHasPasskeyState(settingsObject.hasPasskey);
    
    // After a short delay, reset the flag to allow auto-saving
    setTimeout(() => {
      justLoadedFromServerRef.current = false;
      console.log("[SettingsPage] Initial load completed, auto-save enabled");
    }, 500);
  }, []); 

  // Save settings to backend
  const saveSettings = useCallback(async () => {
    if (justLoadedFromServerRef.current || !initialLoadCompletedRef.current) {
      console.log("[SettingsPage] Skipping auto-save during initial load");
      return; // Skip saving during initial load
    }

    console.log("[SettingsPage] Auto-saving settings...");
    setIsSaving(true);
    pendingChangesRef.current = false;
    
    try {
      const settingsToSave = {
        punishmentTypes,
        statusThresholds,
        aiModeration,
        aiChat,
        aiBan,
        staffOverride,
        requireApproval,
        toxicity,
        spam,
        automated,
        bugReportTags,
        playerReportTags,
        appealTags,
        mongodbUri,
        has2FA,
        hasPasskey,
      };

      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settingsToSave)
      });
      
      if (response.ok) {
        // Don't invalidate the query here - it causes a loop
        // await queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
        setLastSaved(new Date());
        // Don't show a toast on every auto-save to avoid spam
      } else {
        toast({
          title: "Error",
          description: "Failed to save settings",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while saving",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    punishmentTypes, statusThresholds, aiModeration, aiChat, aiBan, staffOverride, 
    requireApproval, toxicity, spam, automated, bugReportTags, playerReportTags, 
    appealTags, mongodbUri, has2FA, hasPasskey, toast
  ]);

  // Effect: Load settings from React Query into local component state
  useEffect(() => {
    if (isLoadingSettings || isFetchingSettings) {
      console.log('[SettingsPage] settingsData is loading/fetching. Waiting...');
      return;
    }

    // Log the raw settingsData received from the hook
    // console.log('[SettingsPage] Raw settingsData from useSettings:', settingsData); // Removed

    // console.log('[SettingsPage] Raw settingsData from useSettings:', settingsData); // Already removed

    if (settingsData?.settings && Object.keys(settingsData.settings).length > 0 && !initialLoadCompletedRef.current) {
      console.log('[SettingsPage] Valid settingsData.settings received for the first time. Applying to local state.');
      applySettingsObjectToState(settingsData.settings); // Call directly
      
      // Capture settings for future reference and mark initial load as complete
      // This timeout ensures state updates from applySettingsObjectToState have settled
      // before capturing and enabling auto-save.
      setTimeout(() => {
        console.log('[SettingsPage] Capturing initial settings snapshot after data load.');
        captureInitialSettings(); // Call directly
        initialLoadCompletedRef.current = true;
        console.log('[SettingsPage] Initial load process fully complete after timeout.');
      }, 600); // Delay to ensure state updates propagate
    } else if (!settingsData?.settings && !initialLoadCompletedRef.current && !isLoadingSettings && !isFetchingSettings) {
      // This case handles if the API returns no settings (e.g. empty object) on the first load
      console.log('[SettingsPage] No valid settings data received on first successful fetch, or data was empty. Marking initial load as complete.');
      initialLoadCompletedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsData, isLoadingSettings, isFetchingSettings]); // Removed applySettingsObjectToState and captureInitialSettings

  // Debounced auto-save effect - only trigger when settings change after initial load
  useEffect(() => {
    // Don't auto-save during initial load
    if (justLoadedFromServerRef.current || !initialLoadCompletedRef.current || isLoadingSettings || isFetchingSettings) {
      return;
    }
    
    console.log("[SettingsPage] Settings changed, scheduling auto-save");
    
    // If there's a pending save, clear it
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set a flag that we have pending changes
    pendingChangesRef.current = true;
    
    // Schedule a new save
    saveTimeoutRef.current = setTimeout(() => {
      if (pendingChangesRef.current) {
        saveSettings();
      }
    }, 1000); // Auto-save after 1 second of inactivity

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    punishmentTypes, statusThresholds, aiModeration, aiChat, aiBan, staffOverride, 
    requireApproval, toxicity, spam, automated, bugReportTags, playerReportTags, 
    appealTags, mongodbUri, has2FA, hasPasskey, isLoadingSettings, isFetchingSettings,
    saveSettings
  ]);

  // Check database connection status on page load
  useEffect(() => {
    const checkDbConnection = async () => {
      if (!mongodbUri) {
        setDbConnectionStatus(false);
        return;
      }
      
      setIsTestingConnection(true);
      
      try {
        const response = await fetch('/api/settings/test-database', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ uri: mongodbUri })
        });
        
        const data = await response.json();
        
        if (data.connected) {
          setDbConnectionStatus(true);
        } else {
          setDbConnectionStatus(false);
        }
      } catch (error) {
        console.error("Database connection check error:", error);
        setDbConnectionStatus(false);
      } finally {
        setIsTestingConnection(false);
      }
    };

    checkDbConnection();
  }, [mongodbUri]);

  // Wrapper functions to set state that trigger auto-save
  const setPunishmentTypes = (value: React.SetStateAction<PunishmentType[]>) => {
    // Skip auto-save during initial load
    if (justLoadedFromServerRef.current || !initialLoadCompletedRef.current) {
      setPunishmentTypesState(value);
    } else {
      console.log("[SettingsPage] Setting punishmentTypes and flagging for auto-save");
      setPunishmentTypesState(value);
    }
  };
  const setNewPunishmentName = (value: React.SetStateAction<string>) => {
    setNewPunishmentNameState(value);
  };
  const setNewPunishmentCategory = (value: React.SetStateAction<'Gameplay' | 'Social'>) => {
    setNewPunishmentCategoryState(value);
  };
  const setStatusThresholds = (value: React.SetStateAction<StatusThresholds>) => {
    setStatusThresholdsState(value);
  };
  const setSelectedPunishment = (value: React.SetStateAction<PunishmentType | null>) => {
    setSelectedPunishmentState(value);
  };
  const setShowCorePunishments = (value: React.SetStateAction<boolean>) => {
    setShowCorePunishmentsState(value);
  };
  const setToxicity = (value: React.SetStateAction<number>) => {
    setToxicityState(value);
  };
  const setSpam = (value: React.SetStateAction<number>) => {
    setSpamState(value);
  };
  const setAutomated = (value: React.SetStateAction<number>) => {
    setAutomatedState(value);
  };
  const setAiModeration = (value: React.SetStateAction<boolean>) => {
    setAiModerationState(value);
  };
  const setAiChat = (value: React.SetStateAction<boolean>) => {
    setAiChatState(value);
  };
  const setAiBan = (value: React.SetStateAction<boolean>) => {
    setAiBanState(value);
  };
  const setStaffOverride = (value: React.SetStateAction<boolean>) => {
    setStaffOverrideState(value);
  };
  const setRequireApproval = (value: React.SetStateAction<boolean>) => {
    setRequireApprovalState(value);
  };
  const setBugReportTags = (value: React.SetStateAction<string[]>) => {
    setBugReportTagsState(value);
  };
  const setPlayerReportTags = (value: React.SetStateAction<string[]>) => {
    setPlayerReportTagsState(value);
  };
  const setAppealTags = (value: React.SetStateAction<string[]>) => {
    setAppealTagsState(value);
  };
  const setNewBugTag = (value: React.SetStateAction<string>) => {
    setNewBugTagState(value);
  };
  const setNewPlayerTag = (value: React.SetStateAction<string>) => {
    setNewPlayerTagState(value);
  };
  const setNewAppealTag = (value: React.SetStateAction<string>) => {
    setNewAppealTagState(value);
  };
  const setHas2FA = (value: React.SetStateAction<boolean>) => {
    setHas2FAState(value);
  };
  const setHasPasskey = (value: React.SetStateAction<boolean>) => {
    setHasPasskeyState(value);
  };
  const setShowSetup2FA = (value: React.SetStateAction<boolean>) => {
    setShowSetup2FAState(value);
  };
  const setShowSetupPasskey = (value: React.SetStateAction<boolean>) => {
    setShowSetupPasskeyState(value);
  };
  const setRecoveryCodesCopied = (value: React.SetStateAction<boolean>) => {
    setRecoveryCodesCopiedState(value);
  };

  // Add a new punishment type
  const addPunishmentType = () => {
    if (newPunishmentName.trim()) {
      const newId = Math.max(...punishmentTypes.map(pt => pt.id)) + 1;
      const newOrdinal = Math.max(...punishmentTypes.map(pt => pt.ordinal)) + 1;
      
      // Default durations and points based on category
      const defaultUnit = 'hours' as 'hours' | 'days' | 'weeks' | 'months';
      
      // Helper function to create duration objects
      const createDuration = (value: number) => ({ value, unit: defaultUnit });
      
      const defaultGameplayDurations = {
        low: {
          first: createDuration(24),
          medium: createDuration(72),
          habitual: createDuration(168)
        },
        regular: {
          first: createDuration(72),
          medium: createDuration(168),
          habitual: createDuration(336)
        },
        severe: {
          first: createDuration(168),
          medium: createDuration(336),
          habitual: createDuration(720)
        }
      };
      
      const defaultSocialDurations = {
        low: {
          first: createDuration(24),
          medium: createDuration(48),
          habitual: createDuration(96)
        },
        regular: {
          first: createDuration(48),
          medium: createDuration(96),
          habitual: createDuration(168)
        },
        severe: {
          first: createDuration(72),
          medium: createDuration(168),
          habitual: createDuration(336)
        }
      };
      
      const defaultGameplayPoints = 4;
      const defaultSocialPoints = 3;
      
      const newPunishment = {
        id: newId,
        name: newPunishmentName.trim(),
        category: newPunishmentCategory,
        isCustomizable: true,
        ordinal: newOrdinal,
        durations: newPunishmentCategory === 'Gameplay' ? defaultGameplayDurations : defaultSocialDurations,
        points: newPunishmentCategory === 'Gameplay' ? defaultGameplayPoints : defaultSocialPoints
      };
      setPunishmentTypes(prevTypes => [...prevTypes, newPunishment]);
      setNewPunishmentName('');
    }
  };

  // Remove a punishment type
  const removePunishmentType = (id: number) => {
    setPunishmentTypes(prevTypes => prevTypes.filter(pt => pt.id !== id));
  };

  // Update punishment type
  const updatePunishmentType = (id: number, updates: Partial<PunishmentType>) => {
    setPunishmentTypes(prevTypes =>
      prevTypes.map(pt => (pt.id === id ? { ...pt, ...updates } : pt))
    );
  };

  // Format the last saved time
  const formatLastSaved = () => {
    if (!lastSaved) return "Not saved yet";
    
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);
    
    if (diffSeconds < 60) {
      return "Just now";
    } else if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return lastSaved.toLocaleTimeString();
    }
  };

  return (
    <PageContainer>
      <div className="flex flex-col space-y-6 pb-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <div className="flex items-center gap-3">
            {isSaving ? (
              <span className="text-sm text-muted-foreground flex items-center">
                <Save className="animate-spin h-4 w-4 mr-2" />
                Saving...
              </span>
            ) : lastSaved ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <span className="text-sm text-muted-foreground flex items-center">
                      <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                      Saved {formatLastSaved()}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Changes are automatically saved</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
        </div>
        
        <Card className="overflow-visible">
          <Tabs defaultValue="ai">
            <TabsList className="w-full h-full justify-start rounded-none bg-transparent border-b border-border overflow-x-auto mx-1">
              <TabsTrigger
                value="account"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-2"
              >
                <UserIcon className="h-4 w-4 mr-2" />
                Account
              </TabsTrigger>
              <TabsTrigger
                value="ai"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-2"
              >
                <Bot className="h-4 w-4 mr-2" />
                AI Settings
              </TabsTrigger>
              <TabsTrigger 
                value="chat" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-2"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Chat Filter
              </TabsTrigger>
              <TabsTrigger 
                value="punishment" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-2"
              >
                <Scale className="h-4 w-4 mr-2" />
                Punishment Types
              </TabsTrigger>
              <TabsTrigger 
                value="tags" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-2"
              >
                <Tag className="h-4 w-4 mr-2" />
                Ticket Tags
              </TabsTrigger>
              <TabsTrigger 
                value="staff" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-2"
              >
                <Shield className="h-4 w-4 mr-2" />
                Staff Management
              </TabsTrigger>
              <TabsTrigger 
                value="security" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-2"
              >
                <Lock className="h-4 w-4 mr-2" />
                Security
              </TabsTrigger>
              <TabsTrigger 
                value="general" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-2"
              >
                <Globe className="h-4 w-4 mr-2" />
                General
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="account" className="space-y-6 p-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Account Information</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-address">Email Address</Label>
                    <Input
                      id="email-address"
                      type="email"
                      value={currentEmail}
                      onChange={(e) => setCurrentEmail(e.target.value)}
                      placeholder="Enter your email address"
                    />
                  </div>
                  <Button>Change Email</Button>
                </div>
              </div>
              <Separator />
              <div>
                <h3 className="text-lg font-medium mb-4">Sign Out</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You will be logged out of your current session.
                </p>
                <Button variant="destructive" onClick={logout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="ai" className="space-y-6 p-6">
              <div>
                <h3 className="text-lg font-medium mb-4">AI Moderation</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="ai-moderation" className="font-medium">Enable AI Moderation</Label>
                      <p className="text-sm text-muted-foreground mt-1">Allow AI to automatically moderate chat and player actions</p>
                    </div>
                    <Switch 
                      id="ai-moderation" 
                      checked={aiModeration}
                      onCheckedChange={setAiModeration}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="ai-chat" className="font-medium">AI Chat Monitoring</Label>
                      <p className="text-sm text-muted-foreground mt-1">Monitor chat for toxic behavior and prohibited content</p>
                    </div>
                    <Switch 
                      id="ai-chat" 
                      checked={aiChat}
                      onCheckedChange={setAiChat}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="ai-ban" className="font-medium">AI Ban Detection</Label>
                      <p className="text-sm text-muted-foreground mt-1">Detect ban evasion attempts automatically</p>
                    </div>
                    <Switch 
                      id="ai-ban" 
                      checked={aiBan}
                      onCheckedChange={setAiBan}
                    />
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="text-lg font-medium mb-4">AI Sensitivity Settings</h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-1">
                      <Label htmlFor="toxicity-slider">Toxicity Detection</Label>
                      <span className="text-sm text-muted-foreground">{toxicity}%</span>
                    </div>
                    <Slider 
                      id="toxicity-slider"
                      value={[toxicity]} 
                      min={0} 
                      max={100} 
                      step={1}
                      onValueChange={values => setToxicity(values[0])}
                      className="py-4"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Lenient</span>
                      <span>Strict</span>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <Label htmlFor="spam-slider">Spam Detection</Label>
                      <span className="text-sm text-muted-foreground">{spam}%</span>
                    </div>
                    <Slider 
                      id="spam-slider"
                      value={[spam]} 
                      min={0} 
                      max={100} 
                      step={1}
                      onValueChange={values => setSpam(values[0])}
                      className="py-4"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Lenient</span>
                      <span>Strict</span>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-1">
                      <Label htmlFor="automated-slider">Automated Response</Label>
                      <span className="text-sm text-muted-foreground">{automated}%</span>
                    </div>
                    <Slider 
                      id="automated-slider"
                      value={[automated]} 
                      min={0} 
                      max={100} 
                      step={1}
                      onValueChange={values => setAutomated(values[0])}
                      className="py-4"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Manual</span>
                      <span>Automatic</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="text-lg font-medium mb-4">Staff Override</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="staff-override" className="font-medium">Staff Override of AI Decisions</Label>
                      <p className="text-sm text-muted-foreground mt-1">Allow staff to override AI moderation decisions</p>
                    </div>
                    <Switch 
                      id="staff-override" 
                      checked={staffOverride}
                      onCheckedChange={setStaffOverride}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="require-approval" className="font-medium">Require Approval for AI Bans</Label>
                      <p className="text-sm text-muted-foreground mt-1">Require staff approval for AI-initiated bans</p>
                    </div>
                    <Switch 
                      id="require-approval" 
                      checked={requireApproval}
                      onCheckedChange={setRequireApproval}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="chat">
              <CardContent className="p-6">
                <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted rounded-lg">
                  <p className="text-muted-foreground">Chat Filter Settings Panel</p>
                </div>
              </CardContent>
            </TabsContent>
            
            <TabsContent value="punishment" className="space-y-6 p-6">
              {/* Status Thresholds Section MOVED HERE */}
              <div>
                <h4 className="text-base font-medium mb-3 mt-2">Offender Status Thresholds</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure the point thresholds for determining a player's offender status. Higher thresholds make it harder to reach medium and habitual status.
                </p>
                
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div className="space-y-4 border rounded-md p-4">
                    <h5 className="font-medium flex items-center">
                      <GamepadIcon className="h-4 w-4 mr-2 text-amber-500" />
                      Gameplay Status Thresholds
                    </h5>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label htmlFor="gameplay-medium">Medium Offender</Label>
                          <span className="text-sm text-muted-foreground">{statusThresholds.gameplay.medium}+ points</span>
                        </div>
                        <Slider
                          id="gameplay-medium"
                          value={[statusThresholds.gameplay.medium]}
                          min={1}
                          max={20}
                          step={1}
                          onValueChange={values => setStatusThresholds(prev => ({
                            ...prev,
                            gameplay: {
                              ...prev.gameplay,
                              medium: values[0]
                            }
                          }))}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label htmlFor="gameplay-habitual">Habitual Offender</Label>
                          <span className="text-sm text-muted-foreground">{statusThresholds.gameplay.habitual}+ points</span>
                        </div>
                        <Slider
                          id="gameplay-habitual"
                          value={[statusThresholds.gameplay.habitual]}
                          min={statusThresholds.gameplay.medium + 1}
                          max={30}
                          step={1}
                          onValueChange={values => setStatusThresholds(prev => ({
                            ...prev,
                            gameplay: {
                              ...prev.gameplay,
                              habitual: values[0]
                            }
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4 border rounded-md p-4">
                    <h5 className="font-medium flex items-center">
                      <MessageCircle className="h-4 w-4 mr-2 text-blue-500" />
                      Social Status Thresholds
                    </h5>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label htmlFor="social-medium">Medium Offender</Label>
                          <span className="text-sm text-muted-foreground">{statusThresholds.social.medium}+ points</span>
                        </div>
                        <Slider
                          id="social-medium"
                          value={[statusThresholds.social.medium]}
                          min={1}
                          max={20}
                          step={1}
                          onValueChange={values => setStatusThresholds(prev => ({
                            ...prev,
                            social: {
                              ...prev.social,
                              medium: values[0]
                            }
                          }))}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label htmlFor="social-habitual">Habitual Offender</Label>
                          <span className="text-sm text-muted-foreground">{statusThresholds.social.habitual}+ points</span>
                        </div>
                        <Slider
                          id="social-habitual"
                          value={[statusThresholds.social.habitual]}
                          min={statusThresholds.social.medium + 1}
                          max={30}
                          step={1}
                          onValueChange={values => setStatusThresholds(prev => ({
                            ...prev,
                            social: {
                              ...prev.social,
                              habitual: values[0]
                            }
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-muted/30 p-4 rounded-md mb-6">
                  <h5 className="text-sm font-medium mb-1">About Offender Status</h5>
                  <p className="text-xs text-muted-foreground">
                    Players accumulate points with each punishment. When they reach the threshold for medium or habitual status,
                    stricter durations will apply to future punishments. Points decay over time according to server settings.
                  </p>
                </div>
              </div>
              
              <Separator />

              <div>
                <h3 className="text-lg font-medium mb-2">Punishment Types</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Configure the punishment types available in your system. Each type is stored with an ordinal value for persistence.
                  Core punishment types cannot be modified.
                </p>

                {/* NEW: Fixed Punishment Types Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-base font-medium flex items-center">
                      <Lock className="h-4 w-4 mr-2 text-gray-500" />
                      Core Punishment Types
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCorePunishments(!showCorePunishments)}
                      className="text-xs"
                    >
                      {showCorePunishments ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                  
                  {showCorePunishments && (
                    <div className="space-y-2 mb-6">
                      {punishmentTypes
                        .filter(pt => !pt.isCustomizable)
                        .sort((a, b) => a.ordinal - b.ordinal)
                        .map(type => (
                          <div key={type.id} className="flex items-center justify-between p-2 border rounded-md bg-card">
                            <div className="flex items-center">
                              <span className={`text-xs font-mono px-1.5 py-0.5 rounded mr-3 bg-primary/10 text-primary`}>
                                {type.ordinal}
                              </span>
                              <span>{type.name} ({type.category})</span>
                            </div>
                          </div>
                        ))
                    }
                    </div>
                  )}
                  
                  {!showCorePunishments && (
                    <div className="text-sm text-muted-foreground mb-6">
                      Click 'Show' to view core punishment types that cannot be modified or removed.
                    </div>
                  )}
                </div>
                
                <div className="flex gap-4 mb-8">
                  <div className="w-1/2">
                    <h4 className="text-base font-medium mb-3 flex items-center">
                      <GamepadIcon className="h-4 w-4 mr-2 text-amber-500" />
                      Customizable Gameplay Related
                    </h4>
                    <div className="space-y-2">
                      {punishmentTypes
                        .filter(pt => pt.category === 'Gameplay' && pt.isCustomizable)
                        .sort((a, b) => a.ordinal - b.ordinal)
                        .map(type => (
                          <div key={type.id} className="flex items-center justify-between p-2 border rounded-md bg-card hover:bg-accent/50">
                            <div className="flex items-center">
                              <span className={`text-xs font-mono px-1.5 py-0.5 rounded mr-3 bg-muted`}>
                                {type.ordinal}
                              </span>
                              <span>{type.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {type.isCustomizable && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedPunishment(type)}
                                  className="text-xs px-2 h-7 text-muted-foreground"
                                >
                                  Configure
                                </Button>
                              )}
                              {type.isCustomizable && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removePunishmentType(type.id)}
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                  
                  <div className="w-1/2">
                    <h4 className="text-base font-medium mb-3 flex items-center">
                      <MessageCircle className="h-4 w-4 mr-2 text-blue-500" />
                      Customizable Social Related
                    </h4>
                    <div className="space-y-2">
                      {punishmentTypes
                        .filter(pt => pt.category === 'Social' && pt.isCustomizable)
                        .sort((a, b) => a.ordinal - b.ordinal)
                        .map(type => (
                          <div key={type.id} className="flex items-center justify-between p-2 border rounded-md bg-card hover:bg-accent/50">
                            <div className="flex items-center">
                              <span className={`text-xs font-mono px-1.5 py-0.5 rounded mr-3 bg-muted`}>
                                {type.ordinal}
                              </span>
                              <span>{type.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {type.isCustomizable && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedPunishment(type)}
                                  className="text-xs px-2 h-7 text-muted-foreground"
                                >
                                  Configure
                                </Button>
                              )}
                              {type.isCustomizable && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removePunishmentType(type.id)}
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </div>
                                
                <Separator className="my-6" />
                
                <div className="space-y-4">
                  <h4 className="text-base font-medium">Add New Punishment Type</h4>
                  <div className="flex gap-3 items-end">
                    <div className="space-y-2 flex-grow">
                      <Label htmlFor="punishment-name">Punishment Name</Label>
                      <Input
                        id="punishment-name"
                        placeholder="Enter punishment type name"
                        value={newPunishmentName}
                        onChange={(e) => setNewPunishmentName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 w-48">
                      <Label htmlFor="punishment-category">Category</Label>
                      <Select
                        value={newPunishmentCategory}
                        onValueChange={(value) => setNewPunishmentCategory(value as 'Gameplay' | 'Social')}
                      >
                        <SelectTrigger id="punishment-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Gameplay">Gameplay</SelectItem>
                          <SelectItem value="Social">Social</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      onClick={addPunishmentType}
                      disabled={!newPunishmentName.trim()}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Type
                    </Button>
                  </div>
                </div>
                
                <div className="bg-muted/30 p-4 rounded-md mt-6">
                  <h4 className="text-sm font-medium mb-2">About Punishment Types</h4>
                  <p className="text-xs text-muted-foreground">
                    Punishment types are used throughout the system for player moderation. The ordinal values (numbers) 
                    are used for storage and should remain consistent. Core punishment types (Kick, Manual Mute, 
                    Manual Ban, Security Ban, Linked Ban, and Blacklist) cannot be modified or removed.
                  </p>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="tags" className="space-y-6 p-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Ticket Tag Management</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Customize tags for different ticket categories. These tags will appear as options when staff respond to tickets.
                </p>
                
                <div className="space-y-8">
                  {/* Bug Report Tags */}
                  <div className="space-y-3">
                    <h4 className="text-base font-medium">Bug Report Tags</h4>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {bugReportTags.map((tag, index) => (
                        <Badge key={index} variant="outline" className="py-1.5 pl-3 pr-2 flex items-center gap-1 bg-background">
                          {tag}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-4 w-4 rounded-full hover:bg-muted ml-1" 
                            onClick={() => {
                              setBugReportTags(bugReportTags.filter((_, i) => i !== index));
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}

                    </div>
                    <div className="flex gap-2 items-center">
                      <Input 
                        placeholder="New tag name" 
                        className="max-w-xs"
                        value={newBugTag}
                        onChange={(e) => setNewBugTag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newBugTag.trim()) {
                            setBugReportTags([...bugReportTags, newBugTag.trim()]);
                            setNewBugTag('');
                          }
                        }}
                      />
                      <Button 
                        size="sm" 
                        onClick={() => {
                          if (newBugTag.trim()) {
                            setBugReportTags([...bugReportTags, newBugTag.trim()]);
                            setNewBugTag('');
                          }
                        }}
                        disabled={!newBugTag.trim()}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Tag
                      </Button>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Player Report Tags */}
                  <div className="space-y-3">
                    <h4 className="text-base font-medium">Player Report Tags</h4>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {playerReportTags.map((tag, index) => (
                        <Badge key={index} variant="outline" className="py-1.5 pl-3 pr-2 flex items-center gap-1 bg-background">
                          {tag}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-4 w-4 rounded-full hover:bg-muted ml-1" 
                            onClick={() => {
                              setPlayerReportTags(playerReportTags.filter((_, i) => i !== index));
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}

                    </div>
                    <div className="flex gap-2 items-center">
                      <Input 
                        placeholder="New tag name" 
                        className="max-w-xs"
                        value={newPlayerTag}
                        onChange={(e) => setNewPlayerTag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newPlayerTag.trim()) {
                            setPlayerReportTags([...playerReportTags, newPlayerTag.trim()]);
                            setNewPlayerTag('');
                          }
                        }}
                      />
                      <Button 
                        size="sm" 
                        onClick={() => {
                          if (newPlayerTag.trim()) {
                            setPlayerReportTags([...playerReportTags, newPlayerTag.trim()]);
                            setNewPlayerTag('');
                          }
                        }}
                        disabled={!newPlayerTag.trim()}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Tag
                      </Button>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Appeal Tags */}
                  <div className="space-y-3">
                    <h4 className="text-base font-medium">Appeal Tags</h4>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {appealTags.map((tag, index) => (
                        <Badge key={index} variant="outline" className="py-1.5 pl-3 pr-2 flex items-center gap-1 bg-background">
                          {tag}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-4 w-4 rounded-full hover:bg-muted ml-1" 
                            onClick={() => {
                              setAppealTags(appealTags.filter((_, i) => i !== index));
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}

                    </div>
                    <div className="flex gap-2 items-center">
                      <Input 
                        placeholder="New tag name" 
                        className="max-w-xs"
                        value={newAppealTag}
                        onChange={(e) => setNewAppealTag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newAppealTag.trim()) {
                            setAppealTags([...appealTags, newAppealTag.trim()]);
                            setNewAppealTag('');
                          }
                        }}
                      />
                      <Button 
                        size="sm" 
                        onClick={() => {
                          if (newAppealTag.trim()) {
                            setAppealTags([...appealTags, newAppealTag.trim()]);
                            setNewAppealTag('');
                          }
                        }}
                        disabled={!newAppealTag.trim()}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Tag
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="staff">
              <CardContent className="p-6">
                <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted rounded-lg">
                  <p className="text-muted-foreground">Staff Management Panel</p>
                </div>
              </CardContent>
            </TabsContent>
            
            <TabsContent value="security" className="space-y-6 p-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Account Security</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Enhance your account security by enabling multi-factor authentication methods.
                </p>
                
                <div className="space-y-8">
                  {/* Two-Factor Authentication */}
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-base font-medium flex items-center">
                          <KeyRound className="h-4 w-4 mr-2" />
                          Two-Factor Authentication (2FA)
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Add an extra layer of security by requiring a verification code from your authentication app.
                        </p>
                      </div>
                      <div className="flex items-center">
                        {has2FA ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Enabled</Badge>
                        ) : (
                          <Button 
                            onClick={() => setShowSetup2FA(true)}
                            size="sm"
                          >
                            Set up 2FA
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {showSetup2FA && (
                      <div className="bg-muted/50 p-5 rounded-lg space-y-4 mt-2">
                        <h5 className="font-medium">Set up Two-Factor Authentication</h5>
                        
                        <div className="space-y-4">
                          <div className="flex flex-col items-center justify-center space-y-3 p-4 bg-background rounded-md">
                            <div className="w-44 h-44 bg-white p-2 rounded-md flex items-center justify-center">
                              {/* This would typically be a real QR code generated from a 2FA secret */}
                              <QrCode className="w-36 h-36 text-primary" />
                            </div>
                            <p className="text-xs text-center text-muted-foreground mt-2">
                              Scan this QR code with your authentication app (Google Authenticator, Authy, etc.)
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="backup-code">Secret Key (if you can't scan the QR code)</Label>
                            <div className="relative">
                              <Input
                                id="backup-code"
                                value="HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ"
                                readOnly
                                className="pr-10"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1 h-8 w-8"
                                onClick={() => {
                                  navigator.clipboard.writeText("HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ");
                                  toast({
                                    title: "Copied to clipboard",
                                    description: "Secret key copied to clipboard"
                                  });
                                }}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="verification-code">Enter verification code to confirm</Label>
                            <Input
                              id="verification-code"
                              placeholder="Enter 6-digit code"
                              inputMode="numeric"
                              maxLength={6}
                            />
                          </div>
                          
                          {!recoveryCodesCopied ? (
                            <div className="space-y-2">
                              <Label>Recovery Codes</Label>
                              <div className="bg-background p-3 rounded-md text-xs font-mono grid grid-cols-2 gap-2">
                                <div>1. ABCD-EFGH-IJKL-MNOP</div>
                                <div>2. QRST-UVWX-YZ12-3456</div>
                                <div>3. 7890-ABCD-EFGH-IJKL</div>
                                <div>4. MNOP-QRST-UVWX-YZ12</div>
                                <div>5. 3456-7890-ABCD-EFGH</div>
                                <div>6. IJKL-MNOP-QRST-UVWX</div>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Save these recovery codes in a secure place. They can be used to access your account if you lose your authentication device.
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => {
                                  const codes = [
                                    "ABCD-EFGH-IJKL-MNOP",
                                    "QRST-UVWX-YZ12-3456",
                                    "7890-ABCD-EFGH-IJKL",
                                    "MNOP-QRST-UVWX-YZ12",
                                    "3456-7890-ABCD-EFGH",
                                    "IJKL-MNOP-QRST-UVWX"
                                  ].join("\n");
                                  navigator.clipboard.writeText(codes);
                                  setRecoveryCodesCopied(true);
                                  toast({
                                    title: "Recovery codes copied",
                                    description: "Please store them in a secure location"
                                  });
                                }}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Copy Recovery Codes
                              </Button>
                            </div>
) : (
                            <div className="bg-green-50 border border-green-200 rounded-md p-3">
                              <div className="flex items-start">
                                <Check className="h-5 w-5 text-green-500 mr-2 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-green-800">Recovery codes copied</p>
                                  <p className="text-xs text-green-700">
                                    Make sure to store them in a secure location. You'll need them if you lose access to your authenticator app.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <div className="flex justify-between">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowSetup2FA(false);
                                setRecoveryCodesCopied(false);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => {
                                setHas2FA(true);
                                setShowSetup2FA(false);
                                toast({
                                  title: "2FA Enabled",
                                  description: "Two-factor authentication has been enabled for your account",
                                });
                              }}
                              disabled={!recoveryCodesCopied}
                            >
                              Enable 2FA
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
</div>
                  
                  <Separator />
                  
                  {/* Passkey Authentication */}
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-base font-medium flex items-center">
                          <Fingerprint className="h-4 w-4 mr-2" />
                          Passkey Authentication
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Use biometrics or hardware security keys as a passwordless authentication method.
                        </p>
                      </div>
                      <div className="flex items-center">
                        {hasPasskey ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Enabled</Badge>
                        ) : (
                          <Button 
                            onClick={() => setShowSetupPasskey(true)}
                            size="sm"
                          >
                            Set up Passkey
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {showSetupPasskey && (
                      <div className="bg-muted/50 p-5 rounded-lg space-y-4 mt-2">
                        <h5 className="font-medium">Set up Passkey Authentication</h5>
                        
                        <div className="flex flex-col items-center justify-center gap-4 p-6 bg-background rounded-lg">
                          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                            <Fingerprint className="h-10 w-10 text-primary" />
                          </div>
                          <div className="text-center">
                            <h4 className="font-medium">Register a passkey</h4>
                            <p className="text-sm text-muted-foreground max-w-sm mt-1">
                              Your device will prompt you to use your biometrics (fingerprint, face) or
                              security key to create a passkey for this account.
                            </p>
                          </div>
                          
                          <div className="bg-primary/5 rounded-md p-4 w-full">
                            <h5 className="text-sm font-medium mb-2">Compatible with:</h5>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              <li>• Windows Hello</li>
                              <li>• Apple Touch ID / Face ID</li>
                              <li>• Android fingerprint</li>
                              <li>• FIDO2 security keys (YubiKey, etc.)</li>
                            </ul>
                          </div>
                        </div>
                        
                        <div className="flex justify-between mt-6">
                          <Button
                            variant="outline"
                            onClick={() => setShowSetupPasskey(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => {
                              // Simulate FIDO2/WebAuthn registration
                              toast({
                                title: "FIDO Authentication",
                                description: "Your browser would prompt for biometric verification here",
                              });
                              
                              // After successful registration
                              setTimeout(() => {
                                setHasPasskey(true);
                                setShowSetupPasskey(false);
                                toast({
                                  title: "Passkey Registered",
                                  description: "You can now sign in using your passkey"
                                });
                              }, 1500);
                            }}
                          >
                            Register Passkey
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <Separator />
                  
                  {/* Account Recovery */}
                  <div>
                    <h4 className="text-base font-medium mb-3">Account Recovery</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Make sure you have access to your recovery options in case you get locked out of your account.
                    </p>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">Recovery Email</p>
                            <p className="text-xs text-muted-foreground">admin@example.com</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">Update</Button>
                      </div>
                      
                      {has2FA && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <KeyRound className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Recovery Codes</p>
                              <p className="text-xs text-muted-foreground">6 single-use codes remaining</p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm">View Codes</Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="general">
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">System Settings</h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="site-name">Site Name</Label>
                          <Input id="site-name" defaultValue="Game Moderation Panel" />
                          <p className="text-xs text-muted-foreground">The name displayed in the title bar and header.</p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="admin-email">Admin Email</Label>
                          <Input id="admin-email" defaultValue="admin@example.com" type="email" />
                          <p className="text-xs text-muted-foreground">Primary contact for system notifications.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="text-lg font-medium mb-4">Database Configuration</h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${dbConnectionStatus ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span>{dbConnectionStatus ? 'Connected to MongoDB' : 'Not connected to MongoDB'}</span>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="mongodb-uri">MongoDB Connection URI</Label>
                        <Input 
                          id="mongodb-uri" 
                          type="password" 
                          placeholder="mongodb+srv://username:password@cluster.mongodb.net/database"
                          value={mongodbUri}
                          onChange={(e) => setMongodbUri(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          The connection string for your MongoDB database. This will be stored as an environment secret.
                        </p>
                      </div>
                      
                      <Button 
                        onClick={async () => {
                          if (!mongodbUri.trim()) {
                            toast({
                              title: "Error",
                              description: "Please enter a MongoDB connection URI",
                              variant: "destructive"
                            });
                            return;
                          }
                          
                          setIsTestingConnection(true);
                          toast({
                            title: "Testing Connection",
                            description: "Attempting to connect to MongoDB..."
                          });
                          
                          try {
                            const response = await fetch('/api/settings/test-database', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify({ uri: mongodbUri })
                            });
                            
                            const data = await response.json();
                            
                            if (data.connected) {
                              setDbConnectionStatus(true);
                              toast({
                                title: "Connection Successful",
                                description: data.message || "Successfully connected to MongoDB"
                              });
                            } else {
                              setDbConnectionStatus(false);
                              toast({
                                title: "Connection Failed",
                                description: data.message || "Failed to connect to MongoDB",
                                variant: "destructive"
                              });
                            }
                          } catch (error) {
                            setDbConnectionStatus(false);
                            toast({
                              title: "Connection Error",
                              description: "An error occurred while testing the connection",
                              variant: "destructive"
                            });
                            console.error("Database connection test error:", error);
                          } finally {
                            setIsTestingConnection(false);
                          }
                        }} 
                        disabled={isTestingConnection}
                      >
                        {isTestingConnection ? "Testing..." : "Test Connection"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
        
        {/* Punishment Configuration Dialog */}
        {selectedPunishment && (
          <Dialog open={Boolean(selectedPunishment)} onOpenChange={() => setSelectedPunishmentState(null)}>
            <DialogContent className="max-w-2xl p-6">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">
                  Configure Punishment Type
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Adjust the settings for the punishment type "{selectedPunishment.name}".
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Punishment Name and Category */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-punishment-name">Punishment Name</Label>
                    <Input
                      id="edit-punishment-name"
                      value={selectedPunishment.name}
                      onChange={(e) => setSelectedPunishment(prev => prev ? { ...prev, name: e.target.value } : null)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-punishment-category">Category</Label>
                    <Select
                      value={selectedPunishment.category}
                      onValueChange={(value) => setSelectedPunishment(prev => prev ? { ...prev, category: value as 'Gameplay' | 'Social' } : null)}
                    >
                      <SelectTrigger id="edit-punishment-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Gameplay">Gameplay</SelectItem>
                        <SelectItem value="Social">Social</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Durations and Points Configuration */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-base font-medium mb-2">Durations</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Set the durations and units for low, regular, and severe levels of this punishment.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Low Severity */}
                      <div className="space-y-2">
                        <Label className="font-medium">Low Severity Durations</Label>
                        <div className="space-y-3 p-2 border rounded-md">
                          {['first', 'medium', 'habitual'].map((offenseType) => (
                            <div key={`low-${offenseType}`}>
                              <Label htmlFor={`low-${offenseType}-${selectedPunishment.id}`} className="text-xs text-muted-foreground">
                                {offenseType.charAt(0).toUpperCase() + offenseType.slice(1)} Offense
                              </Label>
                              <div className="flex gap-2 mt-1">
                                <Input
                                  id={`low-${offenseType}-${selectedPunishment.id}`}
                                  type="number"
                                  min="0"
                                  value={selectedPunishment.durations?.low[offenseType as keyof typeof selectedPunishment.durations.low]?.value || ''}
                                  onChange={(e) => {
                                    const value = Number(e.target.value);
                                    setSelectedPunishment(prev => prev && prev.durations ? {
                                      ...prev,
                                      durations: {
                                        ...prev.durations,
                                        low: { 
                                          ...prev.durations.low, 
                                          [offenseType]: { 
                                            ...prev.durations.low[offenseType as keyof typeof prev.durations.low],
                                            value 
                                          } 
                                        }
                                      }
                                    } : null);
                                  }}
                                  className="text-center w-full"
                                  placeholder="e.g., 24"
                                />
                                <Select
                                  value={selectedPunishment.durations?.low[offenseType as keyof typeof selectedPunishment.durations.low]?.unit || 'hours'}
                                  onValueChange={(unit) => {
                                    setSelectedPunishment(prev => prev && prev.durations ? {
                                      ...prev,
                                      durations: {
                                        ...prev.durations,
                                        low: { 
                                          ...prev.durations.low, 
                                          [offenseType]: { 
                                            ...prev.durations.low[offenseType as keyof typeof prev.durations.low],
                                            unit: unit as 'hours' | 'days' | 'weeks' | 'months'
                                          } 
                                        }
                                      }
                                    } : null);
                                  }}
                                >
                                  <SelectTrigger className="w-[120px]">
                                    <SelectValue/>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="hours">Hours</SelectItem>
                                    <SelectItem value="days">Days</SelectItem>
                                    <SelectItem value="weeks">Weeks</SelectItem>
                                    <SelectItem value="months">Months</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Regular Severity */}
                      <div className="space-y-2">
                        <Label className="font-medium">Regular Severity Durations</Label>
                        <div className="space-y-3 p-2 border rounded-md">
                          {['first', 'medium', 'habitual'].map((offenseType) => (
                            <div key={`regular-${offenseType}`}>
                              <Label htmlFor={`regular-${offenseType}-${selectedPunishment.id}`} className="text-xs text-muted-foreground">
                                {offenseType.charAt(0).toUpperCase() + offenseType.slice(1)} Offense
                              </Label>
                              <div className="flex gap-2 mt-1">
                                <Input
                                  id={`regular-${offenseType}-${selectedPunishment.id}`}
                                  type="number"
                                  min="0"
                                  value={selectedPunishment.durations?.regular[offenseType as keyof typeof selectedPunishment.durations.regular]?.value || ''}
                                  onChange={(e) => {
                                    const value = Number(e.target.value);
                                    setSelectedPunishment(prev => prev && prev.durations ? {
                                      ...prev,
                                      durations: {
                                        ...prev.durations,
                                        regular: { 
                                          ...prev.durations.regular, 
                                          [offenseType]: { 
                                            ...prev.durations.regular[offenseType as keyof typeof prev.durations.regular],
                                            value 
                                          } 
                                        }
                                      }
                                    } : null);
                                  }}
                                  className="text-center w-full"
                                  placeholder="e.g., 48"
                                />
                                <Select
                                  value={selectedPunishment.durations?.regular[offenseType as keyof typeof selectedPunishment.durations.regular]?.unit || 'hours'}
                                  onValueChange={(unit) => {
                                    setSelectedPunishment(prev => prev && prev.durations ? {
                                      ...prev,
                                      durations: {
                                        ...prev.durations,
                                        regular: { 
                                          ...prev.durations.regular, 
                                          [offenseType]: { 
                                            ...prev.durations.regular[offenseType as keyof typeof prev.durations.regular],
                                            unit: unit as 'hours' | 'days' | 'weeks' | 'months'
                                          } 
                                        }
                                      }
                                    } : null);
                                  }}
                                >
                                  <SelectTrigger className="w-[120px]">
                                    <SelectValue/>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="hours">Hours</SelectItem>
                                    <SelectItem value="days">Days</SelectItem>
                                    <SelectItem value="weeks">Weeks</SelectItem>
                                    <SelectItem value="months">Months</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Severe Severity */}
                      <div className="space-y-2">
                                               <Label className="font-medium">Severe Severity Durations</Label>
                        <div className="space-y-3 p-2 border rounded-md">
                                                   {['first', 'medium', 'habitual'].map((offenseType) => (
                            <div key={`severe-${offenseType}`}>
                              <Label htmlFor={`severe-${offenseType}-${selectedPunishment.id}`} className="text-xs text-muted-foreground">
                                {offenseType.charAt(0).toUpperCase() + offenseType.slice(1)} Offense
                              </Label>
                              <div className="flex gap-2 mt-1">
                                <Input
                                  id={`severe-${offenseType}-${selectedPunishment.id}`}
                                  type="number"
                                  min="0"
                                 
                                  value={selectedPunishment.durations?.severe[offenseType as keyof typeof selectedPunishment.durations.severe]?.value || ''}
                                  onChange={(e) => {
                                    const value = Number(e.target.value);
                                    setSelectedPunishment(prev => prev && prev.durations ? {
                                      ...prev,
                                      durations: {
                                        ...prev.durations,
                                        severe: { 
                                          ...prev.durations.severe, 
                                          [offenseType]: { 
                                            ...prev.durations.severe[offenseType as keyof typeof prev.durations.severe],
                                            value 
                                          } 
                                        }
                                      }
                                    } : null);
                                  }}
                                  className="text-center w-full"
                                  placeholder="e.g., 72"
                                />
                                <Select
                                  value={selectedPunishment.durations?.severe[offenseType as keyof typeof selectedPunishment.durations.severe]?.unit || 'hours'}
                                  onValueChange={(unit) => {
                                    setSelectedPunishment(prev => prev && prev.durations ? {
                                      ...prev,
                                      durations: {
                                        ...prev.durations,
                                        severe: { 
                                          ...prev.durations.severe, 
                                          [offenseType]: { 
                                            ...prev.durations.severe[offenseType as keyof typeof prev.durations.severe],
                                            unit: unit as 'hours' | 'days' | 'weeks' | 'months'
                                          } 
                                        }
                                      }
                                    } : null);
                                  }}
                                >
                                  <SelectTrigger className="w-[120px]">
                                    <SelectValue/>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="hours">Hours</SelectItem>
                                    <SelectItem value="days">Days</SelectItem>
                                    <SelectItem value="weeks">Weeks</SelectItem>
                                    <SelectItem value="months">Months</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-base font-medium mb-2">Points</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Set the points for this punishment.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2 md:col-span-1"> {/* Adjusted to take less space */}
                        <Label className="font-medium">Points Value</Label>
                        <Input
                          type="number"
                          placeholder="Points"
                          value={selectedPunishment.points || ''}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            setSelectedPunishment(prev => {
                              if (!prev) return null;
                              return {
                                ...prev,
                                points: value,
                              };
                            });
                          }}
                          className="text-center w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <DialogFooter className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedPunishment(null)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => {
                    // Save updates to the punishment type
                    if (selectedPunishment) {
                      setPunishmentTypes(prev => 
                        prev.map(pt => pt.id === selectedPunishment.id ? selectedPunishment : pt)
                      );
                      toast({
                        title: "Punishment Type Updated",
                        description: `The punishment type "${selectedPunishment.name}" has been updated`
                        // Removed invalid variant: "success"
                      });
                    }
                    setSelectedPunishment(null);
                  }}
                >
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      </PageContainer>
  );
};

export default Settings;
