import React, { useState } from 'react';
import { Button } from 'modl-shared-web/components/ui/button';
import { Checkbox } from 'modl-shared-web/components/ui/checkbox';
import { Badge } from 'modl-shared-web/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export interface PlayerPunishmentData {
  selectedPunishmentCategory?: string;
  selectedSeverity?: 'Lenient' | 'Regular' | 'Aggravated';
  selectedOffenseLevel?: 'first' | 'medium' | 'habitual';
  duration?: {
    value: number;
    unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  };
  isPermanent?: boolean;
  reason?: string;
  evidence?: string[];
  staffNotes?: string;
  altBlocking?: boolean;
  statWiping?: boolean;
  silentPunishment?: boolean;
  kickSameIP?: boolean;
  attachReports?: string[];
  banToLink?: string;
  banLinkedAccounts?: boolean;
}

interface PlayerPunishmentProps {
  playerId?: string;
  playerName?: string;
  playerStatus?: string; // For kick validation
  data: PlayerPunishmentData;
  onChange: (data: PlayerPunishmentData) => void;
  onApply: (data: PlayerPunishmentData) => Promise<void>;
  punishmentTypesByCategory?: {
    Administrative: any[];
    Social: any[];
    Gameplay: any[];
  };
  isLoading?: boolean;
  compact?: boolean;
}

const PlayerPunishment: React.FC<PlayerPunishmentProps> = ({
  playerId,
  playerName,
  playerStatus = 'Offline',
  data,
  onChange,
  onApply,
  punishmentTypesByCategory = {
    Administrative: [
      { id: 0, name: 'Kick', category: 'Administrative', isCustomizable: false, ordinal: 0 },
      { id: 1, name: 'Manual Mute', category: 'Administrative', isCustomizable: false, ordinal: 1 },
      { id: 2, name: 'Manual Ban', category: 'Administrative', isCustomizable: false, ordinal: 2 },
      { id: 3, name: 'Security Ban', category: 'Administrative', isCustomizable: false, ordinal: 3 },
      { id: 4, name: 'Linked Ban', category: 'Administrative', isCustomizable: false, ordinal: 4 },
      { id: 5, name: 'Blacklist', category: 'Administrative', isCustomizable: false, ordinal: 5 }
    ],
    Social: [],
    Gameplay: []
  },
  isLoading = false,
  compact = false
}) => {
  const { toast } = useToast();
  const [isApplying, setIsApplying] = useState(false);

  const updateData = (updates: Partial<PlayerPunishmentData>) => {
    onChange({ ...data, ...updates });
  };

  const getCurrentPunishmentType = () => {
    if (!data.selectedPunishmentCategory) return null;
    
    const allTypes = [
      ...punishmentTypesByCategory.Administrative,
      ...punishmentTypesByCategory.Social,
      ...punishmentTypesByCategory.Gameplay
    ];
    
    return allTypes.find(type => type.name === data.selectedPunishmentCategory);
  };

  const getPunishmentPreview = () => {
    const punishmentType = getCurrentPunishmentType();
    if (!punishmentType) return '';

    let preview = punishmentType.name;
    
    if (data.selectedSeverity && !punishmentType.singleSeverityPunishment) {
      preview += ` (${data.selectedSeverity})`;
    }
    
    if (data.selectedOffenseLevel && punishmentType.singleSeverityPunishment) {
      const levelMap = { first: 'First', medium: 'Medium', habitual: 'Habitual' };
      preview += ` (${levelMap[data.selectedOffenseLevel]} Offense)`;
    }
    
    if (data.isPermanent) {
      preview += ' - Permanent';
    } else if (data.duration && data.duration.value > 0) {
      preview += ` - ${data.duration.value} ${data.duration.unit}`;
    }
    
    return preview;
  };

  const handleApplyPunishment = async () => {
    const punishmentType = getCurrentPunishmentType();
    if (!punishmentType) return;

    setIsApplying(true);
    try {
      await onApply(data);
      
      // Reset form after successful application
      updateData({
        selectedPunishmentCategory: undefined,
        selectedSeverity: undefined,
        selectedOffenseLevel: undefined,
        reason: '',
        evidence: [],
        staffNotes: '',
        altBlocking: false,
        statWiping: false,
        silentPunishment: false,
        kickSameIP: false,
        attachReports: [],
        banToLink: '',
        banLinkedAccounts: false
      });
      
      toast({
        title: "Punishment Applied",
        description: `${punishmentType.name} has been applied successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to apply punishment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
    }
  };

  const handleCategorySelect = (type: any) => {
    // Validate kick for offline players
    if (type.name === 'Kick' && playerStatus !== 'Online') {
      toast({
        title: "Cannot Kick",
        description: "Player must be online to kick.",
        variant: "destructive",
      });
      return;
    }

    const newData = {
      ...data,
      selectedPunishmentCategory: type.name,
      selectedSeverity: undefined,
      selectedOffenseLevel: undefined,
      altBlocking: false,
      statWiping: false
    };

    // For single-severity punishments, automatically set default offense level
    if (type.singleSeverityPunishment) {
      newData.selectedOffenseLevel = 'first' as const;
    }

    updateData(newData);
  };

  const renderCategoryGrid = (types: any[], title: string) => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{title}</label>
      <div className="grid grid-cols-6 gap-2">
        {types.length > 0 ? types.map(type => (
          <Button 
            key={type.id}
            variant="outline" 
            size="sm" 
            className={`py-1 text-xs ${type.name === 'Kick' && playerStatus !== 'Online' ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => handleCategorySelect(type)}
            title={type.name === 'Kick' && playerStatus !== 'Online' ? 'Player must be online to kick' : ''}
          >
            {type.name}
          </Button>
        )) : (
          <div className="col-span-6 text-xs text-muted-foreground p-2 border border-dashed rounded">
            {isLoading ? `Loading ${title.toLowerCase()} punishment types...` : `No ${title.toLowerCase()} punishment types configured`}
          </div>
        )}
      </div>
    </div>
  );

  const renderSeveritySelection = () => {
    const punishmentType = getCurrentPunishmentType();
    if (!punishmentType || punishmentType.singleSeverityPunishment) return null;

    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">Severity</label>
        <div className="flex gap-2">
          {['Lenient', 'Regular', 'Aggravated'].map((severity) => (
            <Button
              key={severity}
              variant={data.selectedSeverity === severity ? "default" : "outline"}
              size="sm"
              onClick={() => updateData({ selectedSeverity: severity as any })}
            >
              {severity}
            </Button>
          ))}
        </div>
      </div>
    );
  };

  const renderOffenseSelection = () => {
    const punishmentType = getCurrentPunishmentType();
    if (!punishmentType || !punishmentType.singleSeverityPunishment) return null;

    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">Offense Level</label>
        <div className="flex gap-2">
          {[
            { id: 'first', label: 'First Offense' },
            { id: 'medium', label: 'Medium' },
            { id: 'habitual', label: 'Habitual' }
          ].map((level) => (
            <Button
              key={level.id}
              variant={data.selectedOffenseLevel === level.id ? "default" : "outline"}
              size="sm"
              onClick={() => updateData({ selectedOffenseLevel: level.id as any })}
            >
              {level.label}
            </Button>
          ))}
        </div>
      </div>
    );
  };

  const renderDurationControls = () => {
    const punishmentType = getCurrentPunishmentType();
    if (!punishmentType || punishmentType.name === 'Kick') return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="permanent"
            checked={data.isPermanent || false}
            onCheckedChange={(checked) => updateData({ isPermanent: checked === true })}
          />
          <label htmlFor="permanent" className="text-sm font-medium">
            Permanent
          </label>
        </div>

        {!data.isPermanent && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Duration</label>
              <input
                type="number"
                className="w-full mt-1 h-8 rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={data.duration?.value || ''}
                onChange={(e) => updateData({
                  duration: { 
                    ...data.duration, 
                    value: parseInt(e.target.value) || 0,
                    unit: data.duration?.unit || 'days'
                  }
                })}
                min={1}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Unit</label>
              <select
                className="w-full mt-1 h-8 rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={data.duration?.unit || 'days'}
                onChange={(e) => updateData({
                  duration: { 
                    ...data.duration,
                    value: data.duration?.value || 1,
                    unit: e.target.value as any
                  }
                })}
              >
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
    );
  };

  const renderSpecialOptions = () => {
    const punishmentType = getCurrentPunishmentType();
    if (!punishmentType) return null;

    const options = [];

    // Special options for specific punishment types
    if (punishmentType.name === 'Kick') {
      options.push(
        <div key="kickSameIP" className="flex items-center space-x-2">
          <Checkbox
            id="kickSameIP"
            checked={data.kickSameIP || false}
            onCheckedChange={(checked) => updateData({ kickSameIP: checked === true })}
          />
          <label htmlFor="kickSameIP" className="text-sm">
            Kick players with same IP
          </label>
        </div>
      );
    }

    // General options for all punishment types
    options.push(
      <div key="altBlocking" className="flex items-center space-x-2">
        <Checkbox
          id="altBlocking"
          checked={data.altBlocking || false}
          onCheckedChange={(checked) => updateData({ altBlocking: checked === true })}
        />
        <label htmlFor="altBlocking" className="text-sm">Alt-blocking</label>
      </div>,
      <div key="statWiping" className="flex items-center space-x-2">
        <Checkbox
          id="statWiping"
          checked={data.statWiping || false}
          onCheckedChange={(checked) => updateData({ statWiping: checked === true })}
        />
        <label htmlFor="statWiping" className="text-sm">Stat-wiping</label>
      </div>,
      <div key="silentPunishment" className="flex items-center space-x-2">
        <Checkbox
          id="silentPunishment"
          checked={data.silentPunishment || false}
          onCheckedChange={(checked) => updateData({ silentPunishment: checked === true })}
        />
        <label htmlFor="silentPunishment" className="text-sm">Silent punishment</label>
      </div>
    );

    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">Options</label>
        <div className="space-y-2">
          {options}
        </div>
      </div>
    );
  };

  const renderTextFields = () => (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium">Reason</label>
        <textarea
          className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Enter punishment reason..."
          value={data.reason || ''}
          onChange={(e) => updateData({ reason: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Evidence</label>
        <div className="space-y-2">
          {(data.evidence || []).map((evidence, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="text"
                className="flex-1 h-8 rounded-md border border-input bg-background px-3 py-1 text-sm"
                placeholder="Evidence URL or description..."
                value={evidence}
                onChange={(e) => {
                  const newEvidence = [...(data.evidence || [])];
                  newEvidence[index] = e.target.value;
                  updateData({ evidence: newEvidence });
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newEvidence = (data.evidence || []).filter((_, i) => i !== index);
                  updateData({ evidence: newEvidence });
                }}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateData({ evidence: [...(data.evidence || []), ''] })}
          >
            Add Evidence
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Staff Notes (Internal)</label>
        <textarea
          className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Internal notes for staff..."
          value={data.staffNotes || ''}
          onChange={(e) => updateData({ staffNotes: e.target.value })}
        />
      </div>
    </>
  );

  // Stage 1: Category Selection
  if (!data.selectedPunishmentCategory) {
    return (
      <div className={compact ? "space-y-3" : "bg-muted/30 p-4 rounded-lg space-y-4"}>
        {!compact && (
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Create Punishment</h4>
            {playerName && (
              <Badge variant="outline">
                {playerName}
              </Badge>
            )}
          </div>
        )}
        
        <div className="space-y-3">
          {renderCategoryGrid(punishmentTypesByCategory.Administrative, "Administrative Actions")}
          {renderCategoryGrid(punishmentTypesByCategory.Social, "Chat & Social")}
          {renderCategoryGrid(punishmentTypesByCategory.Gameplay, "Game & Account")}
        </div>
      </div>
    );
  }

  // Stage 2: Punishment Configuration
  const punishmentType = getCurrentPunishmentType();
  if (!punishmentType) return null;

  return (
    <div className={compact ? "space-y-4" : "bg-muted/30 p-4 rounded-lg space-y-4"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => updateData({ selectedPunishmentCategory: undefined })}
          >
            ← Back
          </Button>
          <span className="font-medium">{punishmentType.name}</span>
        </div>
        {playerName && (
          <Badge variant="outline">
            {playerName}
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        {renderSeveritySelection()}
        {renderOffenseSelection()}
        {renderDurationControls()}
        {renderSpecialOptions()}
        {renderTextFields()}
      </div>

      <Button
        onClick={handleApplyPunishment}
        disabled={isApplying || !data.reason?.trim()}
        className="w-full"
      >
        {isApplying ? (
          'Applying...'
        ) : (
          `Apply: ${getPunishmentPreview() || 'Select punishment options'}`
        )}
      </Button>
    </div>
  );
};

export default PlayerPunishment;