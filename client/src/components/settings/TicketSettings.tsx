import React, { useState } from 'react';
import { MessageCircle, Tag, Plus, X, ChevronDown, ChevronRight, Layers, Shield } from 'lucide-react';
import { Button } from 'modl-shared-web/components/ui/button';
import { Input } from 'modl-shared-web/components/ui/input';
import { Label } from 'modl-shared-web/components/ui/label';
import { Badge } from 'modl-shared-web/components/ui/badge';
import { Switch } from 'modl-shared-web/components/ui/switch';
import { Slider } from 'modl-shared-web/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'modl-shared-web/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from 'modl-shared-web/components/ui/collapsible';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

interface TicketSettingsProps {
  // Quick Responses State
  quickResponsesState: any;
  setQuickResponsesState: (value: any) => void;
  
  // Tag Management State
  bugReportTags: string[];
  setBugReportTags: (value: string[]) => void;
  playerReportTags: string[];
  setPlayerReportTags: (value: string[]) => void;
  appealTags: string[];
  setAppealTags: (value: string[]) => void;
  newBugTag: string;
  setNewBugTag: (value: string) => void;
  newPlayerTag: string;
  setNewPlayerTag: (value: string) => void;
  newAppealTag: string;
  setNewAppealTag: (value: string) => void;
  
  // Ticket Forms State
  ticketForms: any;
  selectedTicketFormType: string;
  setSelectedTicketFormType: (value: string) => void;
  
  // AI Moderation State
  aiModerationSettings: any;
  setAiModerationSettings: (value: any) => void;
  aiPunishmentConfigs: any;
  setAiPunishmentConfigs: (value: any) => void;
  punishmentTypesState: any[];
  
  // Functions
  onEditSection?: (section: any) => void;
  onDeleteSection?: (sectionId: string) => void;
  onEditField?: (field: any) => void;
  onDeleteField?: (fieldId: string) => void;
  onAddField?: () => void;
  moveField?: (dragIndex: number, hoverIndex: number, sectionId: string) => void;
  moveFieldBetweenSections?: (fieldId: string, fromSectionId: string, toSectionId: string, targetIndex?: number) => void;
}

const TicketSettings = ({
  quickResponsesState,
  setQuickResponsesState,
  bugReportTags,
  setBugReportTags,
  playerReportTags,
  setPlayerReportTags,
  appealTags,
  setAppealTags,
  newBugTag,
  setNewBugTag,
  newPlayerTag,
  setNewPlayerTag,
  newAppealTag,
  setNewAppealTag,
  ticketForms,
  selectedTicketFormType,
  setSelectedTicketFormType,
  aiModerationSettings,
  setAiModerationSettings,
  aiPunishmentConfigs,
  setAiPunishmentConfigs,
  punishmentTypesState,
  onEditSection,
  onDeleteSection,
  onEditField,
  onDeleteField,
  onAddField,
  moveField,
  moveFieldBetweenSections
}: TicketSettingsProps) => {
  // Collapsible state
  const [isQuickResponsesExpanded, setIsQuickResponsesExpanded] = useState(false);
  const [isTagManagementExpanded, setIsTagManagementExpanded] = useState(false);
  const [isTicketFormsExpanded, setIsTicketFormsExpanded] = useState(false);
  const [isAIModerationExpanded, setIsAIModerationExpanded] = useState(false);

  // AI Moderation computed values
  const availablePunishmentTypes = punishmentTypesState?.filter(pt => 
    pt.isCustomizable && (!aiPunishmentConfigs[pt.id] || !aiPunishmentConfigs[pt.id].enabled)
  ) || [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Ticket Settings</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Configure ticket tags, quick responses, and form settings.
        </p>

        <div className="space-y-6">
          {/* Quick Responses Section */}
          <Collapsible open={isQuickResponsesExpanded} onOpenChange={setIsQuickResponsesExpanded}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
              <div className="flex items-center">
                <MessageCircle className="h-4 w-4 mr-2" />
                <h4 className="text-base font-medium">Quick Responses</h4>
              </div>
              <div className="flex items-center space-x-2">
                {!isQuickResponsesExpanded && (
                  <span className="text-sm text-muted-foreground">
                    {Object.keys(quickResponsesState).length} categories configured
                  </span>
                )}
                {isQuickResponsesExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="pt-4">
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-6">
                  Configure pre-written responses for different ticket categories and actions.
                </p>
                
                <div className="space-y-6">
                  {Object.entries(quickResponsesState).map(([category, responses]) => (
                    <div key={category} className="space-y-3">
                      <h5 className="font-medium text-sm text-muted-foreground">{category}</h5>
                      <div className="space-y-3">
                        {Object.entries(responses as any).map(([action, response]) => (
                          <div key={`${category}-${action}`} className="space-y-2">
                            <Label className="text-xs font-medium">{action}</Label>
                            <textarea
                              className="w-full min-h-[80px] px-3 py-2 text-sm border border-border rounded-md bg-background resize-none"
                              value={response as string}
                              onChange={(e) => {
                                setQuickResponsesState((prev: any) => ({
                                  ...prev,
                                  [category]: {
                                    ...prev[category],
                                    [action]: e.target.value
                                  }
                                }));
                              }}
                              placeholder={`Enter ${action} response for ${category} tickets...`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Tag Management Section */}
          <Collapsible open={isTagManagementExpanded} onOpenChange={setIsTagManagementExpanded}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
              <div className="flex items-center">
                <Tag className="h-4 w-4 mr-2" />
                <h4 className="text-base font-medium">Tag Management</h4>
              </div>
              <div className="flex items-center space-x-2">
                {!isTagManagementExpanded && (
                  <span className="text-sm text-muted-foreground">
                    {bugReportTags.length + playerReportTags.length + appealTags.length} tags configured
                  </span>
                )}
                {isTagManagementExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="pt-4">
              <div className="border rounded-lg p-4">
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
            </CollapsibleContent>
          </Collapsible>

          {/* Ticket Form Configuration Section */}
          <Collapsible open={isTicketFormsExpanded} onOpenChange={setIsTicketFormsExpanded}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
              <div className="flex items-center">
                <Layers className="h-4 w-4 mr-2" />
                <h4 className="text-base font-medium">Ticket Form Configuration</h4>
              </div>
              <div className="flex items-center space-x-2">
                {!isTicketFormsExpanded && (
                  <span className="text-sm text-muted-foreground">
                    {Object.entries(ticketForms).reduce((acc, [, form]) => acc + (form && form.sections ? form.sections.length : 0), 0)} sections across {Object.keys(ticketForms).length} forms
                  </span>
                )}
                {isTicketFormsExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="pt-4">
              <div className="border rounded-lg p-4">
                <DndProvider backend={HTML5Backend}>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Configure custom forms for bug reports, support requests, and applications. These forms will be used when players submit tickets.
                    </p>

                    {/* Form Type Selector */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Form Type</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={selectedTicketFormType === 'bug' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedTicketFormType('bug')}
                        >
                          Bug Report
                        </Button>
                        <Button
                          variant={selectedTicketFormType === 'support' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedTicketFormType('support')}
                        >
                          Support Request
                        </Button>
                        <Button
                          variant={selectedTicketFormType === 'application' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedTicketFormType('application')}
                        >
                          Staff Application
                        </Button>
                      </div>
                    </div>

                    {/* Ticket Form Sections would go here - placeholder for now */}
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">Form configuration interface will be implemented here</p>
                      <p className="text-xs">This includes section management, field configuration, and drag-and-drop functionality</p>
                    </div>
                  </div>
                </DndProvider>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* AI Moderation Settings Section */}
          <Collapsible open={isAIModerationExpanded} onOpenChange={setIsAIModerationExpanded}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
              <div className="flex items-center">
                <Shield className="h-4 w-4 mr-2" />
                <h4 className="text-base font-medium">AI Moderation Settings</h4>
              </div>
              <div className="flex items-center space-x-2">
                {!isAIModerationExpanded && (
                  <span className="text-sm text-muted-foreground">
                    {aiModerationSettings.enableAutomatedActions ? 'Automated' : 'Manual'} • {aiModerationSettings.strictnessLevel}
                  </span>
                )}
                {isAIModerationExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="pt-4">
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  Configure how the AI analyzes and moderates chat reports. AI suggestions can help staff make faster, more consistent decisions.
                </p>

                <div className="space-y-6">
                  {/* Enable Automated Actions Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="enable-automated-actions" className="text-sm font-medium">
                        Enable Automated Actions
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        When enabled, the AI will automatically apply suggested punishments for clear violations. When disabled, the AI will only provide suggestions for staff review.
                      </p>
                    </div>
                    <Switch
                      id="enable-automated-actions"
                      checked={aiModerationSettings.enableAutomatedActions}
                      onCheckedChange={(checked) => {
                        setAiModerationSettings((prev: any) => ({
                          ...prev,
                          enableAutomatedActions: checked
                        }));
                      }}
                    />
                  </div>

                  {/* Strictness Level */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">AI Strictness Level</Label>
                    <Select
                      value={aiModerationSettings.strictnessLevel}
                      onValueChange={(value) => {
                        setAiModerationSettings((prev: any) => ({
                          ...prev,
                          strictnessLevel: value
                        }));
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select strictness level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lenient">Lenient - Only flagrant violations</SelectItem>
                        <SelectItem value="standard">Standard - Balanced approach</SelectItem>
                        <SelectItem value="strict">Strict - Zero tolerance policy</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Controls how sensitive the AI is to rule violations. Higher strictness means more actions will be flagged.
                    </p>
                  </div>

                  {/* Enabled Punishment Types */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">AI Punishment Types Management</Label>
                    <p className="text-xs text-muted-foreground">
                      Select which punishment types the AI can recommend or automatically apply.
                    </p>

                    {availablePunishmentTypes.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground">
                        <p className="text-sm">All customizable punishment types are already enabled for AI.</p>
                        <p className="text-xs">Create new punishment types in the Punishment Types section to add more.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
};

export default TicketSettings;