import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Scale, Shield, Globe, Tag, Plus, X, Fingerprint, KeyRound, Lock, QrCode, Copy, Check, Mail, Trash2, GamepadIcon, MessageCircle, Save, CheckCircle, User as UserIcon, LogOut, CreditCard, BookOpen, Settings as SettingsIcon, Upload, Key, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Button } from 'modl-shared-web/components/ui/button';
import { Card, CardContent } from 'modl-shared-web/components/ui/card';
import { useSidebar } from '@/hooks/use-sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'modl-shared-web/components/ui/tabs';
import { Switch } from 'modl-shared-web/components/ui/switch';
import { Label } from 'modl-shared-web/components/ui/label';
import { Separator } from 'modl-shared-web/components/ui/separator';
import { Slider } from 'modl-shared-web/components/ui/slider';
import { Input } from 'modl-shared-web/components/ui/input';
import { Badge } from 'modl-shared-web/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from 'modl-shared-web/components/ui/select';
import { useSettings } from '@/hooks/use-data';
import PageContainer from '@/components/layout/PageContainer'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "modl-shared-web/components/ui/dialog";
import { queryClient } from '@/lib/queryClient';
import { useBeforeUnload } from 'react-router-dom';
import { useLocation } from "wouter"; // For wouter navigation
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "modl-shared-web/components/ui/tooltip";
import { useAuth } from '@/hooks/use-auth';
import StaffManagementPanel from '@/components/settings/StaffManagementPanel';
import BillingSettings from '@/components/settings/BillingSettings';
import DomainSettings from '@/components/settings/DomainSettings';
import KnowledgebaseSettings from '@/components/settings/KnowledgebaseSettings';
import HomepageCardSettings from '@/components/settings/HomepageCardSettings';

// Type definitions for appeal form fields
interface AppealFormField {
  id: string;
  type: 'checkbox' | 'text' | 'textarea' | 'dropdown';
  label: string;
  description?: string;
  required: boolean;
  options?: string[]; // For dropdown fields
  order: number;
}

interface AppealFormSettings {
  fields: AppealFormField[];
}

// Type definitions for punishment types
interface PunishmentType {
  id: number;
  name: string;
  category: 'Gameplay' | 'Social' | 'Administrative';
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
  points?: {
    low: number;
    regular: number;
    severe: number;
  };
  permanentUntilUsernameChange?: boolean;
  permanentUntilSkinChange?: boolean;
  customPoints?: number; // For permanent punishments that don't use severity-based points
  appealForm?: AppealFormSettings; // Punishment-specific appeal form configuration
  staffDescription?: string; // Description shown to staff when applying this punishment
  playerDescription?: string; // Description shown to players (in appeals, notifications, etc.)
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
  const [activeTab, setActiveTab] = useState('account');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('session_id') && user?.role === 'Super Admin') {
      setActiveTab('billing');
    }  }, [user]);
  
  // Auto-save state
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const profileSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Separate timeout for profile
  const initialSettingsRef = useRef<any | null>(null);
  const justLoadedFromServerRef = useRef(true);
  const pendingChangesRef = useRef(false);
  const initialLoadCompletedRef = useRef(false);
  
  // Refs to capture latest profile values for auto-save
  const profileUsernameRef = useRef('');

  // Database connection state
  const [dbConnectionStatus, setDbConnectionStatus] = useState(false);
  const [mongodbUri, setMongodbUri] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  // Punishment types state
  // State for all settings fields
  const [punishmentTypesState, setPunishmentTypesState] = useState<PunishmentType[]>([
    // Administrative punishment types (IDs 0-5, not customizable) - minimal fallback
    { id: 0, name: 'Kick', category: 'Administrative', isCustomizable: false, ordinal: 0 },
    { id: 1, name: 'Manual Mute', category: 'Administrative', isCustomizable: false, ordinal: 1 },
    { id: 2, name: 'Manual Ban', category: 'Administrative', isCustomizable: false, ordinal: 2 },
    { id: 3, name: 'Security Ban', category: 'Administrative', isCustomizable: false, ordinal: 3 },
    { id: 4, name: 'Linked Ban', category: 'Administrative', isCustomizable: false, ordinal: 4 },
    { id: 5, name: 'Blacklist', category: 'Administrative', isCustomizable: false, ordinal: 5 }
    // Social and Gameplay punishment types are loaded from server during provisioning
  ]);  const [newPunishmentNameState, setNewPunishmentNameState] = useState('');
  const [newPunishmentCategoryState, setNewPunishmentCategoryState] = useState<'Gameplay' | 'Social'>('Gameplay');

  // Threshold values for player status levels
  const [statusThresholdsState, setStatusThresholdsState] = useState<StatusThresholds>({
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
  const [selectedPunishmentState, setSelectedPunishmentState] = useState<PunishmentType | null>(null);

  // State to control visibility of core punishment types
  const [showCorePunishmentsState, setShowCorePunishmentsState] = useState(false);

  // Appeal form state variables
  const [selectedAppealField, setSelectedAppealField] = useState<AppealFormField | null>(null);
  const [isAddAppealFieldDialogOpen, setIsAddAppealFieldDialogOpen] = useState(false);
  const [newAppealFieldLabel, setNewAppealFieldLabel] = useState('');
  const [newAppealFieldType, setNewAppealFieldType] = useState<'checkbox' | 'text' | 'textarea' | 'dropdown'>('text');
  const [newAppealFieldDescription, setNewAppealFieldDescription] = useState('');
  const [newAppealFieldRequired, setNewAppealFieldRequired] = useState(false);
  const [newAppealFieldOptions, setNewAppealFieldOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState('');

  // Tags state for each ticket category
  const [bugReportTagsState, setBugReportTagsState] = useState<string[]>([
    'UI Issue', 'Server', 'Performance', 'Crash', 'Game Mechanics'
  ]);
  const [playerReportTagsState, setPlayerReportTagsState] = useState<string[]>([
    'Harassment', 'Cheating', 'Spam', 'Inappropriate Content', 'Griefing'
  ]);
  const [appealTagsState, setAppealTagsState] = useState<string[]>([
    'Ban Appeal', 'Mute Appeal', 'False Positive', 'Second Chance'
  ]);
  


  // For new tag input
  const [newBugTagState, setNewBugTagState] = useState('');
  const [newPlayerTagState, setNewPlayerTagState] = useState('');
  const [newAppealTagState, setNewAppealTagState] = useState('');
  // Security tab states
  const [has2FAState, setHas2FAState] = useState(false);
  const [hasPasskeyState, setHasPasskeyState] = useState(false);  const [showSetup2FAState, setShowSetup2FAState] = useState(false);
  const [showSetupPasskeyState, setShowSetupPasskeyState] = useState(false);
  const [recoveryCodesCopiedState, setRecoveryCodesCopiedState] = useState(false);

  // General tab states
  const [serverDisplayName, setServerDisplayName] = useState('');
  const [homepageIcon, setHomepageIcon] = useState<File | null>(null);
  const [panelIcon, setPanelIcon] = useState<File | null>(null);
  const [homepageIconUrl, setHomepageIconUrl] = useState('');
  const [panelIconUrl, setPanelIconUrl] = useState('');
  const [uploadingHomepageIcon, setUploadingHomepageIcon] = useState(false);
  const [uploadingPanelIcon, setUploadingPanelIcon] = useState(false);

  // API Key management states
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isGeneratingApiKey, setIsGeneratingApiKey] = useState(false);
  const [isRevokingApiKey, setIsRevokingApiKey] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  // Minecraft API Key management states
  const [minecraftApiKey, setMinecraftApiKey] = useState('');
  const [showMinecraftApiKey, setShowMinecraftApiKey] = useState(false);
  const [isGeneratingMinecraftApiKey, setIsGeneratingMinecraftApiKey] = useState(false);
  const [isRevokingMinecraftApiKey, setIsRevokingMinecraftApiKey] = useState(false);
  const [minecraftApiKeyCopied, setMinecraftApiKeyCopied] = useState(false);    // Profile settings state
  const [profileUsernameState, setProfileUsernameState] = useState('');
  
  const { toast } = useToast();
  const { data: settingsData, isLoading: isLoadingSettings, isFetching: isFetchingSettings } = useSettings();  const [currentEmail, setCurrentEmail] = useState('');

  // Create aliases for the state variables to maintain backward compatibility
  const punishmentTypes = punishmentTypesState;
  const newPunishmentName = newPunishmentNameState;
  const newPunishmentCategory = newPunishmentCategoryState;
  const statusThresholds = statusThresholdsState;
  const selectedPunishment = selectedPunishmentState;
  const showCorePunishments = showCorePunishmentsState;
  const bugReportTags = bugReportTagsState;
  const playerReportTags = playerReportTagsState;
  const appealTags = appealTagsState;
  const newBugTag = newBugTagState;
  const newPlayerTag = newPlayerTagState;
  const newAppealTag = newAppealTagState;
  const has2FA = has2FAState;
  const hasPasskey = hasPasskeyState;
  const showSetup2FA = showSetup2FAState;
  const showSetupPasskey = showSetupPasskeyState;  const recoveryCodesCopied = recoveryCodesCopiedState;  
  
  // Profile settings aliases
  const profileUsername = profileUsernameState;
  
  useEffect(() => {
    if (user?.email) {
      setCurrentEmail(user.email);
    }  }, [user]);  // Initialize profile settings from user data
  useEffect(() => {
    if (user) {
      justLoadedFromServerRef.current = true; // Prevent auto-save during initial load
      setProfileUsernameState(user.username || '');
      
      // Initialize the refs with the current values
      profileUsernameRef.current = user.username || '';
      
      // Mark profile data as loaded after a short delay
      setTimeout(() => {
        justLoadedFromServerRef.current = false;
        if (!initialLoadCompletedRef.current) {
          initialLoadCompletedRef.current = true;
        }
      }, 500);
    }
  }, [user]);

  // Load API key on component mount
  useEffect(() => {
    loadApiKey();
    loadMinecraftApiKey();
  }, []);

  // File upload functions
  const uploadIcon = async (file: File, iconType: 'homepage' | 'panel'): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('icon', file);

      const response = await fetch(`/api/panel/settings/upload-icon?iconType=${iconType}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      return result.url;
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload the icon. Please try again.",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleHomepageIconUpload = async (file: File) => {
    setUploadingHomepageIcon(true);
    const uploadedUrl = await uploadIcon(file, 'homepage');
    if (uploadedUrl) {
      setHomepageIcon(file);
      setHomepageIconUrl(uploadedUrl);
      toast({
        title: "Homepage Icon Uploaded",
        description: "Your homepage icon has been successfully uploaded.",
      });
    }
    setUploadingHomepageIcon(false);
  };
  const handlePanelIconUpload = async (file: File) => {
    setUploadingPanelIcon(true);
    const uploadedUrl = await uploadIcon(file, 'panel');
    if (uploadedUrl) {
      setPanelIcon(file);
      setPanelIconUrl(uploadedUrl);
      toast({
        title: "Panel Icon Uploaded",
        description: "Your panel icon has been successfully uploaded.",
      });    }
    setUploadingPanelIcon(false);
  };

  // API Key management functions
  const loadApiKey = async () => {
    try {
      const response = await fetch('/api/panel/settings/ticket-api-key');
      console.log('API Key response status:', response.status); // Debug log
      if (response.ok) {
        const data = await response.json();
        console.log('API Key response data:', data); // Debug log
        if (data.hasApiKey && data.maskedKey) {
          setApiKey(data.maskedKey);
        } else {
          setApiKey(''); // No API key exists
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to load API key:', response.status, response.statusText, errorText);
        setApiKey('');
      }
    } catch (error) {
      console.error('Error loading API key:', error);
      setApiKey(''); // Set to empty on error
    }
  };

  const generateApiKey = async () => {
    setIsGeneratingApiKey(true);
    try {
      const response = await fetch('/api/panel/settings/ticket-api-key/generate', {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setApiKey(data.apiKey);
        setShowApiKey(true);
        toast({
          title: "API Key Generated",
          description: "Your new API key has been generated. Make sure to copy it as it won't be shown again.",
        });
        // Reload the API key after a short delay to ensure it appears on refresh
        setTimeout(() => {
          loadApiKey();
        }, 1000);
      } else {
        throw new Error('Failed to generate API key');
      }
    } catch (error) {
      console.error('Error generating API key:', error);
      toast({
        title: "Error",
        description: "Failed to generate API key. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingApiKey(false);
    }
  };

  const revokeApiKey = async () => {
    if (!confirm('Are you sure you want to revoke the API key? This will invalidate all existing integrations using this key.')) {
      return;
    }
    
    setIsRevokingApiKey(true);
    try {
      const response = await fetch('/api/panel/settings/ticket-api-key', {
        method: 'DELETE',
      });
      if (response.ok) {
        setApiKey('');
        setShowApiKey(false);
        toast({
          title: "API Key Revoked",
          description: "The API key has been revoked successfully.",
        });
      } else {
        throw new Error('Failed to revoke API key');
      }
    } catch (error) {
      console.error('Error revoking API key:', error);
      toast({
        title: "Error",
        description: "Failed to revoke API key. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRevokingApiKey(false);
    }
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2000);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  };

  const maskApiKey = (key: string) => {
    if (!key) return '';
    return key.substring(0, 8) + '••••••••••••••••••••••••' + key.substring(key.length - 4);
  };

  // Minecraft API Key management functions
  const loadMinecraftApiKey = async () => {
    try {
      const response = await fetch('/api/panel/settings/minecraft-api-key');
      if (response.ok) {
        const data = await response.json();
        console.log('Minecraft API Key response:', data); // Debug log
        if (data.hasApiKey && data.maskedKey) {
          setMinecraftApiKey(data.maskedKey);
        } else {
          setMinecraftApiKey(''); // No API key exists
        }
      } else {
        console.error('Failed to load Minecraft API key:', response.status, response.statusText);
        setMinecraftApiKey('');
      }
    } catch (error) {
      console.error('Error loading Minecraft API key:', error);
      setMinecraftApiKey(''); // Set to empty on error
    }
  };

  const generateMinecraftApiKey = async () => {
    setIsGeneratingMinecraftApiKey(true);
    try {
      const response = await fetch('/api/panel/settings/minecraft-api-key/generate', {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setMinecraftApiKey(data.apiKey);
        setShowMinecraftApiKey(true);
        toast({
          title: "Minecraft API Key Generated",
          description: "Your new Minecraft API key has been generated. Make sure to copy it as it won't be shown again.",
        });
      } else {
        throw new Error('Failed to generate Minecraft API key');
      }
    } catch (error) {
      console.error('Error generating Minecraft API key:', error);
      toast({
        title: "Error",
        description: "Failed to generate Minecraft API key. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingMinecraftApiKey(false);
    }
  };

  const revokeMinecraftApiKey = async () => {
    if (!confirm('Are you sure you want to revoke the Minecraft API key? This will invalidate all existing Minecraft plugin integrations using this key.')) {
      return;
    }
    
    setIsRevokingMinecraftApiKey(true);
    try {
      const response = await fetch('/api/panel/settings/minecraft-api-key', {
        method: 'DELETE',
      });
      if (response.ok) {
        setMinecraftApiKey('');
        setShowMinecraftApiKey(false);
        toast({
          title: "Minecraft API Key Revoked",
          description: "The Minecraft API key has been revoked successfully.",
        });
      } else {
        throw new Error('Failed to revoke Minecraft API key');
      }
    } catch (error) {
      console.error('Error revoking Minecraft API key:', error);
      toast({
        title: "Error",
        description: "Failed to revoke Minecraft API key. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRevokingMinecraftApiKey(false);
    }
  };

  const copyMinecraftApiKey = () => {
    navigator.clipboard.writeText(minecraftApiKey);
    setMinecraftApiKeyCopied(true);
    setTimeout(() => setMinecraftApiKeyCopied(false), 2000);
    toast({
      title: "Copied",
      description: "Minecraft API key copied to clipboard",
    });
  };

  // Define captureInitialSettings first, before it's used anywhere else
  const captureInitialSettings = useCallback(() => {
    const currentSettingsSnapshot = {
      punishmentTypes: JSON.parse(JSON.stringify(punishmentTypes)), // Deep copy
      statusThresholds: JSON.parse(JSON.stringify(statusThresholds)), // Deep copy
      bugReportTags: JSON.parse(JSON.stringify(bugReportTags)), // Deep copy
      playerReportTags: JSON.parse(JSON.stringify(playerReportTags)), // Deep copy
      appealTags: JSON.parse(JSON.stringify(appealTags)), // Deep copy
      mongodbUri,
      has2FA,
      hasPasskey,
      serverDisplayName,
      homepageIconUrl,
      panelIconUrl,
    };
    initialSettingsRef.current = currentSettingsSnapshot;
  }, [punishmentTypes, statusThresholds, bugReportTags, playerReportTags, appealTags, mongodbUri, has2FA, hasPasskey, serverDisplayName, homepageIconUrl, panelIconUrl]);

  // Helper to apply a settings object to all state variables without triggering auto-save
  const applySettingsObjectToState = useCallback((settingsObject: any) => {
    if (!settingsObject) return;

    justLoadedFromServerRef.current = true;

    // Use direct state setters to avoid triggering auto-save during load
    if (settingsObject.punishmentTypes) {
      const pt = settingsObject.punishmentTypes;
      setPunishmentTypesState(typeof pt === 'string' ? JSON.parse(pt) : JSON.parse(JSON.stringify(pt)));
    }
    if (settingsObject.statusThresholds) setStatusThresholdsState(JSON.parse(JSON.stringify(settingsObject.statusThresholds)));
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
    
    // Handle general settings (both direct properties and nested object)
    if (settingsObject.general) {
      if (settingsObject.general.serverDisplayName !== undefined) setServerDisplayName(settingsObject.general.serverDisplayName);
      if (settingsObject.general.homepageIconUrl !== undefined) setHomepageIconUrl(settingsObject.general.homepageIconUrl);
      if (settingsObject.general.panelIconUrl !== undefined) setPanelIconUrl(settingsObject.general.panelIconUrl);
    } else {
      // Fallback for direct properties (backward compatibility)
      if (settingsObject.serverDisplayName !== undefined) setServerDisplayName(settingsObject.serverDisplayName);
      if (settingsObject.homepageIconUrl !== undefined) setHomepageIconUrl(settingsObject.homepageIconUrl);
      if (settingsObject.panelIconUrl !== undefined) setPanelIconUrl(settingsObject.panelIconUrl);
    }

    // After a short delay, reset the flag to allow auto-saving
    setTimeout(() => {
      justLoadedFromServerRef.current = false;
    }, 500);
  }, []);

  // Save settings to backend
  const saveSettings = useCallback(async () => {
    if (justLoadedFromServerRef.current || !initialLoadCompletedRef.current) {
      // console.log("[SettingsPage] Skipping auto-save during initial load"); // Removed
      return; // Skip saving during initial load
    }

    // console.log("[SettingsPage] Auto-saving settings..."); // Removed
    setIsSaving(true);
    pendingChangesRef.current = false;

    try {
      const settingsToSave = {
        punishmentTypes,
        statusThresholds,
        bugReportTags,
        playerReportTags,
        appealTags,
        mongodbUri,
        has2FA,
        hasPasskey,
        general: {
          serverDisplayName,
          homepageIconUrl,
          panelIconUrl,
        },
      };

      const response = await fetch('/api/panel/settings', {
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
    punishmentTypes, statusThresholds, serverDisplayName, homepageIconUrl, panelIconUrl,
    bugReportTags, playerReportTags, appealTags, mongodbUri, has2FA, hasPasskey, toast
  ]);

  // Effect: Load settings from React Query into local component state
  useEffect(() => {
    if (isLoadingSettings || isFetchingSettings) {
      // console.log('[SettingsPage] settingsData is loading/fetching. Waiting...'); // Removed
      return;
    }

    // Log the raw settingsData received from the hook
    // console.log('[SettingsPage] Raw settingsData from useSettings:', settingsData); // Removed

    // console.log('[SettingsPage] Raw settingsData from useSettings:', settingsData); // Already removed

    if (settingsData?.settings && Object.keys(settingsData.settings).length > 0 && !initialLoadCompletedRef.current) {
      // console.log('[SettingsPage] Valid settingsData.settings received for the first time. Applying to local state.'); // Removed
      applySettingsObjectToState(settingsData.settings); // Call directly

      // Capture settings for future reference and mark initial load as complete
      // This timeout ensures state updates from applySettingsObjectToState have settled
      // before capturing and enabling auto-save.
      setTimeout(() => {
        // console.log('[SettingsPage] Capturing initial settings snapshot after data load.'); // Removed
        captureInitialSettings(); // Call directly
        initialLoadCompletedRef.current = true;
        // console.log('[SettingsPage] Initial load process fully complete after timeout.'); // Removed
      }, 600); // Delay to ensure state updates propagate
    } else if (!settingsData?.settings && !initialLoadCompletedRef.current && !isLoadingSettings && !isFetchingSettings) {
      // This case handles if the API returns no settings (e.g. empty object) on the first load
      // console.log('[SettingsPage] No valid settings data received on first successful fetch, or data was empty. Marking initial load as complete.'); // Removed
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

    // console.log("[SettingsPage] Settings changed, scheduling auto-save"); // Removed

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
    };  }, [
    punishmentTypes, statusThresholds, serverDisplayName, homepageIconUrl, panelIconUrl,
    bugReportTags, playerReportTags, appealTags, mongodbUri, has2FA, hasPasskey, 
    profileUsername, // Add profile settings to auto-save
    isLoadingSettings, isFetchingSettings, saveSettings
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
        const response = await fetch('/api/panel/settings/test-database', {
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
      // console.log("[SettingsPage] Setting punishmentTypes and flagging for auto-save"); // Removed
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
  };  const setShowSetupPasskey = (value: React.SetStateAction<boolean>) => {
    setShowSetupPasskeyState(value);
  };
  const setRecoveryCodesCopied = (value: React.SetStateAction<boolean>) => {
    setRecoveryCodesCopiedState(value);
  };
  
  // Profile settings auto-save wrapper functions
  const setProfileUsername = (value: React.SetStateAction<string>) => {
    const newValue = typeof value === 'function' ? value(profileUsernameState) : value;
    setProfileUsernameState(newValue);
    profileUsernameRef.current = newValue; // Keep ref in sync
    
    console.log('Profile username changed to:', newValue);
      // Trigger auto-save for profile updates, but skip during initial load
    if (!justLoadedFromServerRef.current && initialLoadCompletedRef.current) {
      triggerProfileAutoSave();
    }
  };
  
  // Save profile settings function
  const saveProfileSettings = useCallback(async () => {
    console.log('saveProfileSettings called with:', {
      username: profileUsernameState
    });
    
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: profileUsernameState
        })
      });

      console.log('Profile save response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Profile save success:', data);
        setLastSaved(new Date());
        // Update the user context without refreshing
        if (user) {
          user.username = data.user.username;
        }
        
        // Show success toast
        toast({
          title: "Profile Updated",
          description: "Your profile information has been saved.",
        });
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Profile auto-save failed:', errorData.message);
        
        // Show error toast
        toast({
          title: "Save Failed",
          description: `Failed to save profile: ${errorData.message}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Profile auto-save error:', error);
      
      // Show error toast
      toast({
        title: "Save Failed",
        description: "Failed to save profile. Please try again.",        variant: "destructive",
      });
    }
  }, [profileUsernameState, user, toast, setLastSaved]);
  
  // Auto-save function for profile settings
  const triggerProfileAutoSave = useCallback(() => {
    console.log('triggerProfileAutoSave called');
    console.log('Current profile state:', {
      username: profileUsernameState
    });
    console.log('Current profile refs:', {
      username: profileUsernameRef.current
    });
    
    if (profileSaveTimeoutRef.current) {
      clearTimeout(profileSaveTimeoutRef.current);
    }
    
    profileSaveTimeoutRef.current = setTimeout(async () => {
      console.log('Executing profile auto-save...');
      
      // Use refs to get the latest values at execution time
      const currentUsername = profileUsernameRef.current;
        console.log('Saving profile with current values from refs:', {
        username: currentUsername
      });
      
      // Skip save if username is empty
      if (!currentUsername.trim()) {
        console.log('Skipping save - username is empty');
        return;
      }
      
      try {
        const response = await fetch('/api/auth/profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            username: currentUsername
          })
        });

        console.log('Profile save response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('Profile save success:', data);
          setLastSaved(new Date());
          
          // Update the user context without refreshing
          if (user) {
            user.username = data.user.username;
          }
          
          // Show success toast
          toast({
            title: "Profile Updated",
            description: "Your profile information has been saved.",
          });
        } else {
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
          console.error('Profile auto-save failed:', errorData.message);
          
          // Show error toast
          toast({
            title: "Save Failed",
            description: `Failed to save profile: ${errorData.message}`,
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Profile auto-save error:', error);
        
        // Show error toast
        toast({
          title: "Save Failed",
          description: "Failed to save profile. Please try again.",          variant: "destructive",
        });
      }
    }, 500); // Reduced to 500ms for faster response
  }, []); // Empty dependencies since we use refs to get current values

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

      const defaultGameplayPoints = {
        low: 2,
        regular: 4,
        severe: 6
      };
      const defaultSocialPoints = {
        low: 1,
        regular: 3,
        severe: 5
      };

      const newPunishment: PunishmentType = {
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

  // Appeal form helper functions
  const addAppealFormField = () => {
    if (!selectedPunishment || !newAppealFieldLabel.trim()) return;

    const currentFields = selectedPunishment.appealForm?.fields || [];
    const newField: AppealFormField = {
      id: `field_${Date.now()}`,
      type: newAppealFieldType,
      label: newAppealFieldLabel.trim(),
      description: newAppealFieldDescription.trim() || undefined,
      required: newAppealFieldRequired,
      options: newAppealFieldType === 'dropdown' ? newAppealFieldOptions : undefined,
      order: currentFields.length
    };

    const updatedAppealForm: AppealFormSettings = {
      fields: [...currentFields, newField]
    };

    setSelectedPunishment(prev => prev ? {
      ...prev,
      appealForm: updatedAppealForm
    } : null);

    // Reset form
    setNewAppealFieldLabel('');
    setNewAppealFieldType('text');
    setNewAppealFieldDescription('');
    setNewAppealFieldRequired(false);
    setNewAppealFieldOptions([]);
    setIsAddAppealFieldDialogOpen(false);
  };

  const removeAppealFormField = (fieldId: string) => {
    if (!selectedPunishment?.appealForm?.fields) return;

    const updatedFields = selectedPunishment.appealForm.fields
      .filter(f => f.id !== fieldId)
      .map((field, index) => ({ ...field, order: index }));

    setSelectedPunishment(prev => prev ? {
      ...prev,
      appealForm: {
        fields: updatedFields
      }
    } : null);
  };

  const updateAppealFormField = (fieldId: string, updates: Partial<AppealFormField>) => {
    if (!selectedPunishment?.appealForm?.fields) return;

    const updatedFields = selectedPunishment.appealForm.fields.map(field =>
      field.id === fieldId ? { ...field, ...updates } : field
    );

    setSelectedPunishment(prev => prev ? {
      ...prev,
      appealForm: {
        fields: updatedFields
      }
    } : null);
  };

  const addNewAppealFieldOption = () => {
    if (newOption.trim()) {
      setNewAppealFieldOptions(prev => [...prev, newOption.trim()]);
      setNewOption('');
    }
  };

  const removeAppealFieldOption = (index: number) => {
    setNewAppealFieldOptions(prev => prev.filter((_, i) => i !== index));
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
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full h-full justify-start rounded-none bg-transparent border-b border-border overflow-x-auto mx-1">
              <TabsTrigger
                value="account"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-2"
              >
                <UserIcon className="h-4 w-4 mr-2" />
                Account
              </TabsTrigger>
              <TabsTrigger
                value="general"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-2"
              >
                <SettingsIcon className="h-4 w-4 mr-2" />
                General
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
              {(user?.role === 'Super Admin' || user?.role === 'Admin') && (
                <TabsTrigger
                  value="domain"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-2"
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Custom Domain
                </TabsTrigger>
              )}
              {user?.role === 'Super Admin' && (
                <TabsTrigger
                  value="billing"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-2"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Billing
                </TabsTrigger>
              )}
              {(user?.role === 'Super Admin' || user?.role === 'Admin') && (
                <TabsTrigger
                  value="staff"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-2"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Staff Management
                </TabsTrigger>
              )}
              <TabsTrigger
                value="knowledgebase"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-2"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Knowledgebase
              </TabsTrigger>
              {(user?.role === 'Super Admin' || user?.role === 'Admin') && (
                <TabsTrigger
                  value="homepage"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-2"
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Homepage Cards
                </TabsTrigger>
              )}
            </TabsList>            <TabsContent value="account" className="space-y-6 p-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Profile Information</h3>
                <div className="space-y-6">
                  <div className="space-y-4">                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        type="text"
                        value={profileUsername}
                        onChange={(e) => setProfileUsername(e.target.value)}
                        placeholder="Enter your username"
                      />
                      <p className="text-sm text-muted-foreground">
                        This name will appear in ticket conversations and other interactions.
                      </p>                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span>Changes are saved automatically</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <Separator />
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
                  <Button
                    onClick={() => {
                      toast({
                        title: "Work In Progress",
                        description: "This feature is currently not available.",
                      });
                    }}
                  >
                    Change Email
                  </Button>
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
              <Separator />
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
                            onClick={() => {
                              toast({
                                title: "Work In Progress",
                                description: "This feature is currently not available.",
                              });
                              // setShowSetup2FA(true)
                            }}
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
                                // setShowSetup2FA(false);
                                // setRecoveryCodesCopied(false);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => {
                                // setHas2FA(true);
                                // setShowSetup2FA(false);
                                // toast({
                                //   title: "2FA Enabled",
                                //   description: "Two-factor authentication has been enabled for your account",
                                // });
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
                            onClick={() => {
                              toast({
                                title: "Work In Progress",
                                description: "This feature is currently not available.",
                              });
                              // setShowSetupPasskey(true)
                            }}
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
                              // toast({
                              //   title: "FIDO Authentication",
                              //   description: "Your browser would prompt for biometric verification here",
                              // });

                              // After successful registration
                              // setTimeout(() => {
                              //   setHasPasskey(true);
                              //   setShowSetupPasskey(false);
                              //   toast({
                              //     title: "Passkey Registered",
                              //     description: "You can now sign in using your passkey"
                              //   });
                              // }, 1500);
                            }}
                          >
                            Register Passkey
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* <Separator /> */}

                  {/* Account Recovery
                  <div>
                    <h4 className="text-base font-medium mb-3">Account Recovery</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Make sure you have access to your recovery options in case you get locked out of your account.
                    </p>
                    
                    <div className="space-y-4">
                      
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
                  </div> */}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="general" className="space-y-6 p-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Server Configuration</h3>
                <div className="space-y-6">
                  {/* Server Display Name */}
                  <div className="space-y-2">
                    <Label htmlFor="server-display-name">Server Display Name</Label>
                    <Input
                      id="server-display-name"
                      placeholder="Enter server name (shown in browser tab and auth page)"
                      value={serverDisplayName}
                      onChange={(e) => setServerDisplayName(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      This name will appear in the browser tab title and on the authentication page
                    </p>
                  </div>

                  <Separator />

                  {/* Server Icons */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-base font-medium mb-3">Server Icons</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Upload custom icons for your server. Recommended size: 512x512px PNG format.
                      </p>
                    </div>

                    {/* Homepage Icon */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label>Homepage Icon</Label>
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                            {homepageIconUrl ? (
                              <img src={homepageIconUrl} alt="Homepage Icon" className="w-full h-full object-cover" />
                            ) : (
                              <Globe className="h-8 w-8 text-muted-foreground" />
                            )}
                          </div>
                          <div className="space-y-2">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleHomepageIconUpload(file);
                                }
                              }}
                              className="hidden"
                              id="homepage-icon-upload"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => document.getElementById('homepage-icon-upload')?.click()}
                              disabled={uploadingHomepageIcon}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              {uploadingHomepageIcon ? 'Uploading...' : 'Upload Icon'}
                            </Button>
                            <p className="text-xs text-muted-foreground">Displayed on public homepage</p>
                          </div>
                        </div>
                      </div>

                      {/* Panel Icon */}
                      <div className="space-y-3">
                        <Label>Panel Icon</Label>
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                            {panelIconUrl ? (
                              <img src={panelIconUrl} alt="Panel Icon" className="w-full h-full object-cover" />
                            ) : (
                              <SettingsIcon className="h-8 w-8 text-muted-foreground" />
                            )}
                          </div>
                          <div className="space-y-2">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handlePanelIconUpload(file);
                                }
                              }}
                              className="hidden"
                              id="panel-icon-upload"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => document.getElementById('panel-icon-upload')?.click()}
                              disabled={uploadingPanelIcon}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              {uploadingPanelIcon ? 'Uploading...' : 'Upload Icon'}
                            </Button>
                            <p className="text-xs text-muted-foreground">Displayed in admin panel and used as browser favicon</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* API Key Management */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-base font-medium mb-3 flex items-center">
                        <Key className="h-4 w-4 mr-2" />
                        Ticket API Key
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Generate an API key to allow external systems to create tickets programmatically. 
                        Keep this key secure as it provides access to your ticket system.
                      </p>
                    </div>

                    {apiKey ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <Label className="text-xs text-muted-foreground">Current API Key</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="text-sm font-mono bg-background px-2 py-1 rounded border">
                                {showApiKey ? apiKey : maskApiKey(apiKey)}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowApiKey(!showApiKey)}
                              >
                                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={copyApiKey}
                              disabled={!showApiKey}
                            >
                              {apiKeyCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={generateApiKey}
                            disabled={isGeneratingApiKey}
                          >
                            {isGeneratingApiKey ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Regenerating...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Regenerate
                              </>
                            )}
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={revokeApiKey}
                            disabled={isRevokingApiKey}
                          >
                            {isRevokingApiKey ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Revoking...
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Revoke
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 border-2 border-dashed border-muted rounded-lg">
                        <Key className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mb-4">No API key generated yet</p>
                        <Button onClick={generateApiKey} disabled={isGeneratingApiKey}>
                          {isGeneratingApiKey ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Generate API Key
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h5 className="font-medium mb-2 text-blue-900 dark:text-blue-100">API Usage</h5>
                      <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                        <p>• Use the API key in the <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">X-Ticket-API-Key</code> header</p>
                        <p>• Endpoint: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">POST /api/public/tickets</code></p>
                        <p>• View API documentation for detailed usage examples</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Minecraft API Key Management */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-base font-medium mb-3 flex items-center">
                        <Key className="h-4 w-4 mr-2" />
                        Minecraft API Key
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Generate an API key for Minecraft plugin integration. This key allows your plugins to interact 
                        with player data, punishments, and ticket creation. Keep this key secure.
                      </p>
                    </div>

                    {minecraftApiKey ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <Label className="text-xs text-muted-foreground">Current Minecraft API Key</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="text-sm font-mono bg-background px-2 py-1 rounded border">
                                {showMinecraftApiKey ? minecraftApiKey : maskApiKey(minecraftApiKey)}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowMinecraftApiKey(!showMinecraftApiKey)}
                              >
                                {showMinecraftApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={copyMinecraftApiKey}
                              disabled={!showMinecraftApiKey}
                            >
                              {minecraftApiKeyCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={generateMinecraftApiKey}
                            disabled={isGeneratingMinecraftApiKey}
                          >
                            {isGeneratingMinecraftApiKey ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Regenerating...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Regenerate
                              </>
                            )}
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={revokeMinecraftApiKey}
                            disabled={isRevokingMinecraftApiKey}
                          >
                            {isRevokingMinecraftApiKey ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Revoking...
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Revoke
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 border-2 border-dashed border-muted rounded-lg">
                        <Key className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mb-4">No Minecraft API key generated yet</p>
                        <Button onClick={generateMinecraftApiKey} disabled={isGeneratingMinecraftApiKey}>
                          {isGeneratingMinecraftApiKey ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Generate API Key
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <h5 className="font-medium mb-2 text-green-900 dark:text-green-100">Minecraft Plugin Usage</h5>
                      <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                        <p>• Use the API key in the <code className="bg-green-100 dark:bg-green-900 px-1 rounded">X-API-Key</code> header</p>
                        <p>• Endpoints: <code className="bg-green-100 dark:bg-green-900 px-1 rounded">/api/minecraft/*</code></p>
                        <p>• Configure in your plugin's API settings</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
                  Core administrative punishment types can be configured (staff/player descriptions and appeal forms) but their names, categories, durations, and points cannot be modified.
                </p>

                {/* Administrative Punishment Types Section (Ordinals 0-5) */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-base font-medium flex items-center">
                      <Lock className="h-4 w-4 mr-2 text-gray-500" />
                      Core Administrative Punishments
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
                        .filter(pt => pt.ordinal >= 0 && pt.ordinal <= 5)
                        .sort((a, b) => a.ordinal - b.ordinal)
                        .map(type => (
                          <div key={type.id} className="flex items-center justify-between p-2 border rounded-md bg-card">
                            <div className="flex items-center">
                              <span className={`text-xs font-mono px-1.5 py-0.5 rounded mr-3 bg-primary/10 text-primary`}>
                                {type.ordinal}
                              </span>
                              <span>{type.name} ({type.category})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedPunishment(type)}
                                className="text-xs px-2 h-7 text-muted-foreground"
                              >
                                Configure
                              </Button>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  )}

                  {!showCorePunishments && (
                    <div className="text-sm text-muted-foreground mb-6">
                      Click 'Show' to view administrative punishment types (ordinals 0-5) that can be configured for descriptions and appeal forms but cannot be modified or removed.
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
                        .filter(pt => pt.category === 'Gameplay' && pt.ordinal > 5)
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
                        .filter(pt => pt.category === 'Social' && pt.ordinal > 5)
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
                    are used for storage and should remain consistent. Administrative punishment types (ordinals 0-5: Kick, Manual Mute,
                    Manual Ban, Security Ban, Linked Ban, and Blacklist) appear in the Core Administrative section and cannot be modified or removed.
                    All other punishment types are customizable.
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

            <TabsContent value="domain" className="p-6">
              <DomainSettings />
            </TabsContent>

            <TabsContent value="staff" className="p-6">
              {(user?.role === 'Super Admin' || user?.role === 'Admin') ? (
                <StaffManagementPanel />
              ) : (
                <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted rounded-lg">
                  <p className="text-muted-foreground">You do not have permission to view this page.</p>
                </div>
              )}
            </TabsContent>

            {user?.role === 'Super Admin' && (
              <TabsContent value="billing" className="space-y-6 p-6">
                <BillingSettings />
              </TabsContent>
            )}

            <TabsContent value="knowledgebase" className="space-y-6 p-6">
              <KnowledgebaseSettings />
            </TabsContent>

            {(user?.role === 'Super Admin' || user?.role === 'Admin') && (
              <TabsContent value="homepage" className="space-y-6 p-6">
                <HomepageCardSettings />
              </TabsContent>
            )}

          </Tabs>
        </Card>

        {/* Punishment Configuration Dialog */}
        {selectedPunishment && (
          <Dialog open={Boolean(selectedPunishment)} onOpenChange={() => setSelectedPunishmentState(null)}>
            <DialogContent className="max-w-4xl p-6 max-h-[90vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">
                  Configure Punishment Type
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Adjust the settings for the punishment type "{selectedPunishment.name}".
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="configuration" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="configuration">Configuration</TabsTrigger>
                  <TabsTrigger value="appeal-form">Appeal Form</TabsTrigger>
                </TabsList>

                <TabsContent value="configuration" className="space-y-4 max-h-[60vh] overflow-y-auto">
                  {/* Show different fields based on whether it's a core administrative punishment */}
                  {selectedPunishment.isCustomizable ? (
                    <>
                      {/* Punishment Name and Category - Only for customizable punishments */}
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
                    </>
                  ) : (
                    <>
                      {/* Core Administrative Punishment - Show read-only info */}
                      <div className="bg-muted/30 p-4 rounded-lg">
                        <h5 className="text-sm font-medium mb-2">Core Administrative Punishment</h5>
                        <p className="text-xs text-muted-foreground mb-3">
                          This is a core administrative punishment type. The name, category, durations, and points cannot be modified.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Name</Label>
                            <div className="text-sm font-medium">{selectedPunishment.name}</div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Category</Label>
                            <div className="text-sm font-medium">{selectedPunishment.category}</div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Staff and Player Descriptions - Available for all punishment types */}
                  <div className="space-y-4">
                    <h5 className="text-sm font-medium">Descriptions</h5>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="staff-description">Staff Description</Label>
                        <textarea
                          id="staff-description"
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[80px]"
                          placeholder="Description shown to staff when applying this punishment (optional)"
                          value={selectedPunishment.staffDescription || ''}
                          onChange={(e) => setSelectedPunishment(prev => prev ? { ...prev, staffDescription: e.target.value } : null)}
                        />
                        <p className="text-xs text-muted-foreground">
                          This description will be shown to staff members when they apply this punishment type.
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="player-description">Player Description</Label>
                        <textarea
                          id="player-description"
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[80px]"
                          placeholder="Description shown to players in appeals, notifications, etc. (optional)"
                          value={selectedPunishment.playerDescription || ''}
                          onChange={(e) => setSelectedPunishment(prev => prev ? { ...prev, playerDescription: e.target.value } : null)}
                        />
                        <p className="text-xs text-muted-foreground">
                          This description will be shown to players in appeals, notifications, and other player-facing contexts.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Restrictions, Durations, and Points - Only for customizable punishments */}
                  {selectedPunishment.isCustomizable && (
                    <>
                      {/* Permanent Punishment Options */}
                      <div className="space-y-3 p-3 border rounded-md">
                        <h5 className="text-sm font-medium">Restrictions</h5>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="permanentUntilUsernameChange"
                              checked={selectedPunishment.permanentUntilUsernameChange || false}
                              onChange={(e) => {
                                setSelectedPunishment(prev => prev ? {
                                  ...prev,
                                  permanentUntilUsernameChange: e.target.checked,
                                  // Clear other permanent option if this one is checked
                                  permanentUntilSkinChange: e.target.checked ? false : prev.permanentUntilSkinChange
                                } : null);
                              }}
                              className="rounded"
                            />
                            <Label htmlFor="permanentUntilUsernameChange" className="text-sm">
                              Permanent until username change
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="permanentUntilSkinChange"
                              checked={selectedPunishment.permanentUntilSkinChange || false}
                              onChange={(e) => {
                                setSelectedPunishment(prev => prev ? {
                                  ...prev,
                                  permanentUntilSkinChange: e.target.checked,
                                  // Clear other permanent option if this one is checked
                                  permanentUntilUsernameChange: e.target.checked ? false : prev.permanentUntilUsernameChange
                                } : null);
                              }}
                              className="rounded"
                            />
                            <Label htmlFor="permanentUntilSkinChange" className="text-sm">
                              Permanent until skin change
                            </Label>
                          </div>
                          {(selectedPunishment.permanentUntilUsernameChange || selectedPunishment.permanentUntilSkinChange) && (
                            <div className="mt-2">
                              <Input
                                type="number"
                                placeholder="Points"
                                value={selectedPunishment.customPoints || ''}
                                onChange={(e) => {
                                  const value = Number(e.target.value);
                                  setSelectedPunishment(prev => prev ? {
                                    ...prev,
                                    customPoints: value
                                  } : null);
                                }}
                                className="text-center w-full mt-1"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Only show Durations and Points if no permanent options are selected */}
                      {!selectedPunishment.permanentUntilUsernameChange && !selectedPunishment.permanentUntilSkinChange && (
                    <div className="space-y-4">
                      {/* Durations Configuration */}
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
                                        <SelectValue />
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
                                        <SelectValue />
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
                                        <SelectValue />
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

                      {/* Points Configuration */}
                      <div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Low Severity Points */}
                          <div className="space-y-2">
                            <Label className="font-medium">Low Severity Points</Label>
                            <Input
                              type="number"
                              placeholder="Points"
                              value={selectedPunishment.points?.low || ''}
                              onChange={(e) => {
                                const value = Number(e.target.value);
                                setSelectedPunishment(prev => prev ? {
                                  ...prev,
                                  points: {
                                    low: value,
                                    regular: prev.points?.regular || 0,
                                    severe: prev.points?.severe || 0
                                  }
                                } : null);
                              }}
                              className="text-center w-full"
                            />
                          </div>

                          {/* Regular Severity Points */}
                          <div className="space-y-2">
                            <Label className="font-medium">Regular Severity Points</Label>
                            <Input
                              type="number"
                              placeholder="Points"
                              value={selectedPunishment.points?.regular || ''}
                              onChange={(e) => {
                                const value = Number(e.target.value);
                                setSelectedPunishment(prev => prev ? {
                                  ...prev,
                                  points: {
                                    low: prev.points?.low || 0,
                                    regular: value,
                                    severe: prev.points?.severe || 0
                                  }
                                } : null);
                              }}
                              className="text-center w-full"
                            />
                          </div>

                          {/* Severe Severity Points */}
                          <div className="space-y-2">
                            <Label className="font-medium">Severe Severity Points</Label>
                            <Input
                              type="number"
                              placeholder="Points"
                              value={selectedPunishment.points?.severe || ''}
                              onChange={(e) => {
                                const value = Number(e.target.value);
                                setSelectedPunishment(prev => prev ? {
                                  ...prev,
                                  points: {
                                    low: prev.points?.low || 0,
                                    regular: prev.points?.regular || 0,
                                    severe: value
                                  }
                                } : null);
                              }}
                              className="text-center w-full"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* Appeal Form Configuration Tab */}
                <TabsContent value="appeal-form" className="space-y-4 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-medium">Appeal Form Fields</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Configure custom fields for players to fill out when appealing this punishment type.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setIsAddAppealFieldDialogOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Field
                      </Button>
                    </div>

                    {/* Appeal Form Fields List */}
                    <div className="space-y-2">
                      {selectedPunishment.appealForm?.fields
                        ?.sort((a, b) => a.order - b.order)
                        .map((field) => (
                          <div key={field.id} className="flex items-center justify-between p-3 border rounded-md bg-card">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {field.type}
                                </Badge>
                                <span className="font-medium">{field.label}</span>
                                {field.required && (
                                  <Badge variant="secondary" className="text-xs">Required</Badge>
                                )}
                              </div>
                              {field.description && (
                                <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
                              )}
                              {field.options && field.options.length > 0 && (
                                <div className="flex gap-1 mt-2">
                                  {field.options.map((option, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {option}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedAppealField(field);
                                  setNewAppealFieldLabel(field.label);
                                  setNewAppealFieldType(field.type);
                                  setNewAppealFieldDescription(field.description || '');
                                  setNewAppealFieldRequired(field.required);
                                  setNewAppealFieldOptions(field.options || []);
                                  setIsAddAppealFieldDialogOpen(true);
                                }}
                                className="text-xs px-2 h-7"
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeAppealFormField(field.id)}
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}

                      {(!selectedPunishment.appealForm?.fields || selectedPunishment.appealForm.fields.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No custom appeal fields configured</p>
                          <p className="text-xs mt-1">Players will use the default appeal form</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedPunishment(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (selectedPunishment) {
                      setPunishmentTypes(prev =>
                        prev.map(pt => pt.id === selectedPunishment.id ? selectedPunishment : pt)
                      );
                      toast({
                        title: "Punishment Type Updated",
                        description: `The punishment type "${selectedPunishment.name}" has been updated`
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

        {/* Add/Edit Appeal Form Field Dialog */}
        {isAddAppealFieldDialogOpen && (
          <Dialog open={isAddAppealFieldDialogOpen} onOpenChange={setIsAddAppealFieldDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {selectedAppealField ? 'Edit Appeal Form Field' : 'Add Appeal Form Field'}
                </DialogTitle>
                <DialogDescription>
                  Configure a custom field for the appeal form for this punishment type.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Field Label */}
                <div className="space-y-2">
                  <Label htmlFor="field-label">Field Label</Label>
                  <Input
                    id="field-label"
                    placeholder="e.g., Reason for Appeal"
                    value={newAppealFieldLabel}
                    onChange={(e) => setNewAppealFieldLabel(e.target.value)}
                  />
                </div>

                {/* Field Type */}
                <div className="space-y-2">
                  <Label htmlFor="field-type">Field Type</Label>
                  <Select
                    value={newAppealFieldType}
                    onValueChange={(value) => setNewAppealFieldType(value as 'checkbox' | 'text' | 'textarea' | 'dropdown')}
                  >
                    <SelectTrigger id="field-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text Input</SelectItem>
                      <SelectItem value="textarea">Text Area</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                      <SelectItem value="dropdown">Dropdown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Field Description */}
                <div className="space-y-2">
                  <Label htmlFor="field-description">Description (Optional)</Label>
                  <Input
                    id="field-description"
                    placeholder="Help text for this field"
                    value={newAppealFieldDescription}
                    onChange={(e) => setNewAppealFieldDescription(e.target.value)}
                  />
                </div>

                {/* Required Checkbox */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="field-required"
                    checked={newAppealFieldRequired}
                    onChange={(e) => setNewAppealFieldRequired(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="field-required" className="text-sm">
                    Required field
                  </Label>
                </div>

                {/* Dropdown Options */}
                {newAppealFieldType === 'dropdown' && (
                  <div className="space-y-2">
                    <Label>Dropdown Options</Label>
                    <div className="space-y-2">
                      {newAppealFieldOptions.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            value={option}
                            onChange={(e) => {
                              const updatedOptions = [...newAppealFieldOptions];
                              updatedOptions[index] = e.target.value;
                              setNewAppealFieldOptions(updatedOptions);
                            }}
                            className="flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAppealFieldOption(index)}
                            className="h-8 w-8"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Input
                          placeholder="New option"
                          value={newOption}
                          onChange={(e) => setNewOption(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addNewAppealFieldOption();
                            }
                          }}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={addNewAppealFieldOption}
                          disabled={!newOption.trim()}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddAppealFieldDialogOpen(false);
                    setSelectedAppealField(null);
                    setNewAppealFieldLabel('');
                    setNewAppealFieldType('text');
                    setNewAppealFieldDescription('');
                    setNewAppealFieldRequired(false);
                    setNewAppealFieldOptions([]);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (selectedAppealField) {
                      // Update existing field
                      updateAppealFormField(selectedAppealField.id, {
                        label: newAppealFieldLabel.trim(),
                        type: newAppealFieldType,
                        description: newAppealFieldDescription.trim() || undefined,
                        required: newAppealFieldRequired,
                        options: newAppealFieldType === 'dropdown' ? newAppealFieldOptions : undefined
                      });
                      setSelectedAppealField(null);
                    } else {
                      // Add new field
                      addAppealFormField();
                    }
                  }}
                  disabled={!newAppealFieldLabel.trim() || (newAppealFieldType === 'dropdown' && newAppealFieldOptions.length === 0)}
                >
                  {selectedAppealField ? 'Update Field' : 'Add Field'}
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
