import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, MessageSquare, Scale, Shield, Globe, Tag, Plus, X, Fingerprint, KeyRound, Lock, QrCode, Copy, Check, Mail, Trash2, GripVertical, GamepadIcon, MessageCircle, Save, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useAuth } from "../hooks/use-auth";
// Removed duplicate React, hooks, and component imports that were causing errors

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
  const { } = useSidebar(); // Assuming useSidebar is correctly defined and used elsewhere
  const [, navigateWouter] = useLocation();
  // const mainContentClass = "ml-[32px] pl-8"; // This might need adjustment based on actual sidebar width
  const { user, logout, updateUserDetails, isLoading: authLoading } = useAuth();

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

  // Account settings state
  const [email, setEmail] = useState(user?.email || '');
  const [username, setUsername] = useState(user?.username || '');
  const [isUpdatingAccount, setIsUpdatingAccount] = useState(false); // Renamed from isUpdating to avoid conflicts

  useEffect(() => {
    if (user) {
      setEmail(user.email);
      setUsername(user.username);
    }
  }, [user]);

  const handleAccountUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUpdatingAccount(true);
    await updateUserDetails({ email, username });
    setIsUpdatingAccount(false);
  };

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
    if (settingsObject.punishmentTypes) setPunishmentTypesState(JSON.parse(JSON.stringify(settingsObject.punishmentTypes)));
    if (settingsObject.statusThresholds) setStatusThresholdsState(JSON.parse(JSON.stringify(settingsObject.statusThresholds)));
    if (settingsObject.aiModeration !== undefined) setAiModerationState(settingsObject.aiModeration);
    if (settingsObject.aiChat !== undefined) setAiChatState(settingsObject.aiChat);
    if (settingsObject.aiBan !== undefined) setAiBanState(settingsObject.aiBan);
    if (settingsObject.staffOverride !== undefined) setStaffOverrideState(settingsObject.staffOverride);
    if (settingsObject.requireApproval !== undefined) setRequireApprovalState(settingsObject.requireApproval);
    if (settingsObject.toxicity !== undefined) setToxicityState(settingsObject.toxicity);
    if (settingsObject.spam !== undefined) setSpamState(settingsObject.spam);
    if (settingsObject.automated !== undefined) setAutomatedState(settingsObject.automated);
    if (settingsObject.bugReportTags) setBugReportTagsState(JSON.parse(JSON.stringify(settingsObject.bugReportTags)));
    if (settingsObject.playerReportTags) setPlayerReportTagsState(JSON.parse(JSON.stringify(settingsObject.playerReportTags)));
    if (settingsObject.appealTags) setAppealTagsState(JSON.parse(JSON.stringify(settingsObject.appealTags)));
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

    if (!initialLoadCompletedRef.current) {
      if (settingsData?.settings && Object.keys(settingsData.settings).length > 0) {
        console.log('[SettingsPage] Valid settingsData.settings received. Applying to local state.');
        applySettingsObjectToState(settingsData.settings);
        
        // Capture settings for future reference
        setTimeout(() => {
          captureInitialSettings();
          initialLoadCompletedRef.current = true;
        }, 600);
      } else {
        console.log('[SettingsPage] No valid settings data received, marking initial load as complete anyway');
        initialLoadCompletedRef.current = true;
      }
    }
  }, [settingsData, isLoadingSettings, isFetchingSettings, applySettingsObjectToState, captureInitialSettings]);

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
    <PageContainer title="Settings">
      <Tabs defaultValue="account" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-6">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="punishments">Punishments</TabsTrigger>
          <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger> {/* Example, adjust as needed */}
        </TabsList>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Manage your account details. Only you can change your own information.
              </CardDescription>
            </CardHeader>
            {user ? (
              <form onSubmit={handleAccountUpdate}>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isUpdatingAccount || authLoading}
                      placeholder="your@email.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isUpdatingAccount || authLoading}
                      placeholder="Your username"
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-4">
                  <Button type="submit" className="w-full sm:w-auto" disabled={isUpdatingAccount || authLoading}>
                    {isUpdatingAccount ? 'Updating...' : 'Save Changes'}
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto" onClick={logout} disabled={authLoading}>
                    Sign Out
                  </Button>
                </CardFooter>
              </form>
            ) : (
              <CardContent>
                <p>Please log in to manage your account settings.</p>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="punishments">
          <Card>
            <CardHeader><CardTitle>Punishments</CardTitle></CardHeader>
            <CardContent><p>Configure punishment types and durations. (Content TBD)</p></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="thresholds">
          <Card>
            <CardHeader><CardTitle>Offender Status Thresholds</CardTitle></CardHeader>
            <CardContent><p>Define points for offender status changes. (Content TBD)</p></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="database">
          <Card>
            <CardHeader><CardTitle>Database Connection</CardTitle></CardHeader>
            <CardContent>
              <p>Manage MongoDB connection settings. (Content TBD)</p>
              {/* Placeholder for existing DB connection UI if any */}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="general"> {/* Example, adjust as needed */}
          <Card>
            <CardHeader><CardTitle>General Settings</CardTitle></CardHeader>
            <CardContent><p>General application settings. (Content TBD)</p></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
};

export default Settings;
