import React, { useState, useEffect } from 'react';
import { Button } from 'modl-shared-web/components/ui/button';
import { Checkbox } from 'modl-shared-web/components/ui/checkbox';
import { Badge } from 'modl-shared-web/components/ui/badge';
import { Card, CardContent } from 'modl-shared-web/components/ui/card';
import { 
  MessageSquare, 
  Shield, 
  User, 
  GameController2, 
  Settings,
  Clock,
  Upload
} from 'lucide-react';

export interface PunishmentData {
  selectedPunishmentCategory: string;
  selectedSeverity: 'lenient' | 'regular' | 'aggravated';
  selectedOffenseLevel: 'first' | 'medium' | 'habitual';
  duration: {
    value: number;
    unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  };
  isPermanent: boolean;
  reason: string;
  evidence: string[];
  staffNotes: string;
  altBlocking: boolean;
  statWiping: boolean;
  silentPunishment: boolean;
  kickSameIP: boolean;
  attachReports: string[];
  banToLink: string;
  banLinkedAccounts: boolean;
}

interface PunishmentInterfaceProps {
  playerId?: string;
  playerName?: string;
  data: PunishmentData;
  onChange: (data: PunishmentData) => void;
  onApply: (data: PunishmentData) => void;
  disabled?: boolean;
  compact?: boolean;
}

const PunishmentInterface: React.FC<PunishmentInterfaceProps> = ({
  playerId,
  playerName,
  data,
  onChange,
  onApply,
  disabled = false,
  compact = false
}) => {
  const [punishmentStage, setPunishmentStage] = useState<'category' | 'details'>('category');

  // Punishment categories configuration
  const punishmentCategories = {
    administrative: [
      { id: 'kick', name: 'Kick', icon: '👢', requiresOnline: true },
      { id: 'manual_mute', name: 'Manual Mute', icon: '🔇' },
      { id: 'manual_ban', name: 'Manual Ban', icon: '🔨' },
      { id: 'security_ban', name: 'Security Ban', icon: '🛡️' },
      { id: 'linked_ban', name: 'Linked Ban', icon: '🔗' },
      { id: 'blacklist', name: 'Blacklist', icon: '🚫' }
    ],
    chatSocial: [
      { id: 'chat_abuse', name: 'Chat Abuse', icon: '💬' },
      { id: 'anti_social', name: 'Anti Social', icon: '😠' },
      { id: 'targeting', name: 'Targeting', icon: '🎯' },
      { id: 'bad_content', name: 'Bad Content', icon: '📵' },
      { id: 'bad_skin', name: 'Bad Skin', icon: '👤' },
      { id: 'bad_name', name: 'Bad Name', icon: '🏷️' }
    ],
    gameAccount: [
      { id: 'team_abuse', name: 'Team Abuse', icon: '👥' },
      { id: 'game_abuse', name: 'Game Abuse', icon: '🎮' },
      { id: 'systems_abuse', name: 'Systems Abuse', icon: '⚙️' },
      { id: 'account_abuse', name: 'Account Abuse', icon: '👤' },
      { id: 'game_trading', name: 'Game Trading', icon: '💱' },
      { id: 'cheating', name: 'Cheating', icon: '🚨' }
    ]
  };

  const updateData = (updates: Partial<PunishmentData>) => {
    onChange({ ...data, ...updates });
  };

  const handleCategorySelect = (categoryId: string) => {
    updateData({ selectedPunishmentCategory: categoryId });
    setPunishmentStage('details');
  };

  const handleBackToCategories = () => {
    setPunishmentStage('category');
  };

  const renderCategoryGrid = (categories: any[], title: string, icon: React.ReactNode) => (
    <div className="mb-6">
      <div className="flex items-center mb-3">
        {icon}
        <h3 className="text-sm font-medium ml-2">{title}</h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {categories.map((category) => (
          <Button
            key={category.id}
            variant="outline"
            size="sm"
            onClick={() => handleCategorySelect(category.id)}
            disabled={disabled}
            className="h-auto p-3 flex flex-col items-center text-center"
          >
            <span className="text-lg mb-1">{category.icon}</span>
            <span className="text-xs">{category.name}</span>
          </Button>
        ))}
      </div>
    </div>
  );

  const getCurrentCategory = () => {
    const allCategories = [
      ...punishmentCategories.administrative,
      ...punishmentCategories.chatSocial,
      ...punishmentCategories.gameAccount
    ];
    return allCategories.find(cat => cat.id === data.selectedPunishmentCategory);
  };

  const requiresDuration = () => {
    const category = getCurrentCategory();
    return category && !['kick', 'security_ban', 'bad_skin', 'bad_name'].includes(category.id);
  };

  const supportsMultipleSeverity = () => {
    const category = getCurrentCategory();
    return category && ['chat_abuse', 'anti_social', 'team_abuse', 'game_abuse'].includes(category.id);
  };

  if (punishmentStage === 'category') {
    return (
      <Card className={compact ? "border-0 shadow-none" : ""}>
        <CardContent className={compact ? "p-0" : "p-4"}>
          <div className="space-y-4">
            {!compact && (
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Select Punishment Category</h2>
                {playerName && (
                  <Badge variant="outline">
                    <User className="h-3 w-3 mr-1" />
                    {playerName}
                  </Badge>
                )}
              </div>
            )}
            
            {renderCategoryGrid(
              punishmentCategories.administrative,
              "Administrative Actions",
              <Shield className="h-4 w-4" />
            )}
            
            {renderCategoryGrid(
              punishmentCategories.chatSocial,
              "Chat & Social",
              <MessageSquare className="h-4 w-4" />
            )}
            
            {renderCategoryGrid(
              punishmentCategories.gameAccount,
              "Game & Account",
              <GameController2 className="h-4 w-4" />
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentCategory = getCurrentCategory();
  if (!currentCategory) return null;

  return (
    <Card className={compact ? "border-0 shadow-none" : ""}>
      <CardContent className={compact ? "p-0" : "p-4"}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Button variant="ghost" size="sm" onClick={handleBackToCategories}>
                ← Back
              </Button>
              <span className="ml-2 font-medium">{currentCategory.name}</span>
            </div>
            {playerName && (
              <Badge variant="outline">
                <User className="h-3 w-3 mr-1" />
                {playerName}
              </Badge>
            )}
          </div>

          {/* Severity/Offense Level Selection */}
          {supportsMultipleSeverity() ? (
            <div>
              <label className="text-sm font-medium mb-2 block">Severity</label>
              <div className="flex gap-2">
                {['lenient', 'regular', 'aggravated'].map((severity) => (
                  <Button
                    key={severity}
                    variant={data.selectedSeverity === severity ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateData({ selectedSeverity: severity as any })}
                    disabled={disabled}
                  >
                    {severity.charAt(0).toUpperCase() + severity.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium mb-2 block">Offense Level</label>
              <div className="flex gap-2">
                {['first', 'medium', 'habitual'].map((level) => (
                  <Button
                    key={level}
                    variant={data.selectedOffenseLevel === level ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateData({ selectedOffenseLevel: level as any })}
                    disabled={disabled}
                  >
                    {level === 'first' ? 'First Offense' : level.charAt(0).toUpperCase() + level.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Duration Configuration */}
          {requiresDuration() && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="permanent"
                  checked={data.isPermanent}
                  onCheckedChange={(checked) => updateData({ isPermanent: checked === true })}
                  disabled={disabled}
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
                      value={data.duration.value || ''}
                      onChange={(e) => updateData({
                        duration: { ...data.duration, value: parseInt(e.target.value) || 0 }
                      })}
                      min={1}
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Unit</label>
                    <select
                      className="w-full mt-1 h-8 rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={data.duration.unit}
                      onChange={(e) => updateData({
                        duration: { ...data.duration, unit: e.target.value as any }
                      })}
                      disabled={disabled}
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
          )}

          {/* Special options for specific punishments */}
          {currentCategory.id === 'kick' && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="kickSameIP"
                checked={data.kickSameIP}
                onCheckedChange={(checked) => updateData({ kickSameIP: checked === true })}
                disabled={disabled}
              />
              <label htmlFor="kickSameIP" className="text-sm">
                Kick players with same IP
              </label>
            </div>
          )}

          {currentCategory.id === 'linked_ban' && (
            <div>
              <label className="text-sm font-medium mb-2 block">Ban to Link</label>
              <input
                type="text"
                className="w-full h-8 rounded-md border border-input bg-background px-3 py-1 text-sm"
                placeholder="Search for player to link..."
                value={data.banToLink}
                onChange={(e) => updateData({ banToLink: e.target.value })}
                disabled={disabled}
              />
            </div>
          )}

          {currentCategory.id === 'blacklist' && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="banLinkedAccounts"
                checked={data.banLinkedAccounts}
                onCheckedChange={(checked) => updateData({ banLinkedAccounts: checked === true })}
                disabled={disabled}
              />
              <label htmlFor="banLinkedAccounts" className="text-sm">
                Ban linked accounts
              </label>
            </div>
          )}

          {/* General options */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="altBlocking"
                checked={data.altBlocking}
                onCheckedChange={(checked) => updateData({ altBlocking: checked === true })}
                disabled={disabled}
              />
              <label htmlFor="altBlocking" className="text-sm">Alt-blocking</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="statWiping"
                checked={data.statWiping}
                onCheckedChange={(checked) => updateData({ statWiping: checked === true })}
                disabled={disabled}
              />
              <label htmlFor="statWiping" className="text-sm">Stat-wiping</label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="silentPunishment"
                checked={data.silentPunishment}
                onCheckedChange={(checked) => updateData({ silentPunishment: checked === true })}
                disabled={disabled}
              />
              <label htmlFor="silentPunishment" className="text-sm">Silent punishment</label>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="text-sm font-medium mb-2 block">Reason</label>
            <textarea
              className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Enter punishment reason..."
              value={data.reason}
              onChange={(e) => updateData({ reason: e.target.value })}
              disabled={disabled}
            />
          </div>

          {/* Evidence */}
          <div>
            <label className="text-sm font-medium mb-2 block">Evidence</label>
            <div className="space-y-2">
              {data.evidence.map((evidence, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    className="flex-1 h-8 rounded-md border border-input bg-background px-3 py-1 text-sm"
                    placeholder="Evidence URL or description..."
                    value={evidence}
                    onChange={(e) => {
                      const newEvidence = [...data.evidence];
                      newEvidence[index] = e.target.value;
                      updateData({ evidence: newEvidence });
                    }}
                    disabled={disabled}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newEvidence = data.evidence.filter((_, i) => i !== index);
                      updateData({ evidence: newEvidence });
                    }}
                    disabled={disabled}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateData({ evidence: [...data.evidence, ''] })}
                disabled={disabled}
              >
                <Upload className="h-3 w-3 mr-1" />
                Add Evidence
              </Button>
            </div>
          </div>

          {/* Staff Notes */}
          <div>
            <label className="text-sm font-medium mb-2 block">Staff Notes (Internal)</label>
            <textarea
              className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Internal notes for staff..."
              value={data.staffNotes}
              onChange={(e) => updateData({ staffNotes: e.target.value })}
              disabled={disabled}
            />
          </div>

          {/* Apply Button */}
          <Button
            onClick={() => onApply(data)}
            disabled={disabled || !data.reason.trim()}
            className="w-full"
          >
            Apply {currentCategory.name}
            {requiresDuration() && !data.isPermanent && data.duration.value > 0 && (
              <span className="ml-1">
                ({data.duration.value} {data.duration.unit})
              </span>
            )}
            {data.isPermanent && <span className="ml-1">(Permanent)</span>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PunishmentInterface;