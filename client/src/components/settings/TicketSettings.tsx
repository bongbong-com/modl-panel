import React, { useState, useEffect } from 'react';
import { MessageCircle, Tag, Plus, X, ChevronDown, ChevronRight, Layers, Shield, Edit3, Trash2, GripVertical, Save, CheckCircle, Settings } from 'lucide-react';
import { Button } from 'modl-shared-web/components/ui/button';
import { Input } from 'modl-shared-web/components/ui/input';
import { Textarea } from 'modl-shared-web/components/ui/textarea';
import { Label } from 'modl-shared-web/components/ui/label';
import { Badge } from 'modl-shared-web/components/ui/badge';
import { Switch } from 'modl-shared-web/components/ui/switch';
import { Slider } from 'modl-shared-web/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'modl-shared-web/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from 'modl-shared-web/components/ui/collapsible';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Card, CardContent, CardHeader, CardTitle } from 'modl-shared-web/components/ui/card';
import { Separator } from 'modl-shared-web/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from 'modl-shared-web/components/ui/dialog';
import { QuickResponseAction, QuickResponseCategory, QuickResponsesConfiguration, defaultQuickResponsesConfig } from '@/types/quickResponses';

interface TicketSettingsProps {
  // Quick Responses State
  quickResponsesState: QuickResponsesConfiguration;
  setQuickResponsesState: (value: QuickResponsesConfiguration) => void;
  
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

  // Quick Response editing states
  const [editingAction, setEditingAction] = useState<QuickResponseAction | null>(null);
  const [editingCategory, setEditingCategory] = useState<QuickResponseCategory | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Initialize quick responses with defaults if empty
  useEffect(() => {
    if (!quickResponsesState || !quickResponsesState.categories || quickResponsesState.categories.length === 0) {
      setQuickResponsesState(defaultQuickResponsesConfig);
    }
  }, [quickResponsesState, setQuickResponsesState]);

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
                    {quickResponsesState?.categories?.length || 0} categories configured
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
                  {quickResponsesState?.categories?.length > 0 ? quickResponsesState.categories.map((category) => (
                    <Card key={category.id} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">{category.name}</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              {category.ticketTypes.join(', ')} • {category.actions.length} actions
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setEditingCategory(category);
                                setShowCategoryDialog(true);
                              }}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedCategoryId(category.id);
                                setEditingAction(null);
                                setShowActionDialog(true);
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {category.actions.map((action) => (
                          <div key={action.id} className="group relative">
                            <div className="flex items-start space-x-3 p-3 rounded-lg border bg-background/50 hover:bg-background/80 transition-colors">
                              <GripVertical className="h-4 w-4 text-muted-foreground mt-1 cursor-move" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                  <h6 className="font-medium text-sm">{action.name}</h6>
                                  <div className="flex items-center space-x-1">
                                    {action.closeTicket && (
                                      <Badge variant="secondary" className="text-xs">Close</Badge>
                                    )}
                                    {action.issuePunishment && (
                                      <Badge variant="destructive" className="text-xs">Punish</Badge>
                                    )}
                                    {action.appealAction === 'pardon' && (
                                      <Badge variant="secondary" className="text-xs">Pardon</Badge>
                                    )}
                                    {action.appealAction === 'reduce' && (
                                      <Badge variant="outline" className="text-xs">Reduce</Badge>
                                    )}
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {action.message}
                                </p>
                              </div>
                              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => {
                                    setEditingAction(action);
                                    setSelectedCategoryId(category.id);
                                    setShowActionDialog(true);
                                  }}
                                >
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => {
                                    const updatedConfig = {
                                      ...quickResponsesState,
                                      categories: quickResponsesState.categories.map(cat => 
                                        cat.id === category.id
                                          ? { ...cat, actions: cat.actions.filter(a => a.id !== action.id) }
                                          : cat
                                      )
                                    };
                                    setQuickResponsesState(updatedConfig);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {category.actions.length === 0 && (
                          <div className="text-center py-6 text-muted-foreground">
                            <p className="text-sm">No quick responses configured</p>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="mt-2"
                              onClick={() => {
                                setSelectedCategoryId(category.id);
                                setEditingAction(null);
                                setShowActionDialog(true);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add First Response
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">Loading quick response configuration...</p>
                    </div>
                  )}
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
                    {Object.entries(ticketForms || {}).reduce((acc, [, form]) => acc + (form && typeof form === 'object' && 'sections' in form && Array.isArray(form.sections) ? form.sections.length : 0), 0)} sections across {Object.keys(ticketForms || {}).length} forms
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

      {/* Quick Response Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAction ? 'Edit Quick Response' : 'Add Quick Response'}
            </DialogTitle>
            <DialogDescription>
              Configure a quick response action with optional punishment or appeal handling.
            </DialogDescription>
          </DialogHeader>
          <QuickResponseActionForm 
            action={editingAction}
            categoryId={selectedCategoryId}
            quickResponsesState={quickResponsesState}
            setQuickResponsesState={setQuickResponsesState}
            punishmentTypes={punishmentTypesState}
            onSave={() => {
              setShowActionDialog(false);
              setEditingAction(null);
            }}
            onCancel={() => {
              setShowActionDialog(false);
              setEditingAction(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Quick Response Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Category' : 'Add Category'}
            </DialogTitle>
            <DialogDescription>
              Configure category settings and ticket type associations.
            </DialogDescription>
          </DialogHeader>
          <QuickResponseCategoryForm 
            category={editingCategory}
            quickResponsesState={quickResponsesState}
            setQuickResponsesState={setQuickResponsesState}
            onSave={() => {
              setShowCategoryDialog(false);
              setEditingCategory(null);
            }}
            onCancel={() => {
              setShowCategoryDialog(false);
              setEditingCategory(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Quick Response Action Form Component
const QuickResponseActionForm = ({ 
  action, 
  categoryId, 
  quickResponsesState, 
  setQuickResponsesState, 
  punishmentTypes, 
  onSave, 
  onCancel 
}: {
  action: QuickResponseAction | null;
  categoryId: string | null;
  quickResponsesState: QuickResponsesConfiguration;
  setQuickResponsesState: (value: QuickResponsesConfiguration) => void;
  punishmentTypes: any[];
  onSave: () => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState<Partial<QuickResponseAction>>({
    name: action?.name || '',
    message: action?.message || '',
    closeTicket: action?.closeTicket || false,
    issuePunishment: action?.issuePunishment || false,
    punishmentTypeId: action?.punishmentTypeId || undefined,
    punishmentSeverity: action?.punishmentSeverity || 'regular',
    appealAction: action?.appealAction || 'none'
  });

  const category = quickResponsesState.categories.find(c => c.id === categoryId);
  const isReportCategory = category?.ticketTypes.some(type => type.includes('report'));
  const isAppealCategory = category?.ticketTypes.includes('appeal');

  const handleSave = () => {
    if (!formData.name || !formData.message || !categoryId) return;

    const newAction: QuickResponseAction = {
      id: action?.id || `action_${Date.now()}`,
      name: formData.name,
      message: formData.message,
      order: action?.order || category?.actions.length || 0,
      ...formData
    };

    const updatedConfig = {
      ...quickResponsesState,
      categories: quickResponsesState.categories.map(cat => 
        cat.id === categoryId
          ? {
              ...cat,
              actions: action
                ? cat.actions.map(a => a.id === action.id ? newAction : a)
                : [...cat.actions, newAction]
            }
          : cat
      )
    };

    setQuickResponsesState(updatedConfig);
    onSave();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="action-name">Action Name</Label>
          <Input
            id="action-name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Accept & Punish"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="action-message">Response Message</Label>
          <Textarea
            id="action-message"
            value={formData.message}
            onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
            placeholder="Enter the message that will be sent to the user..."
            className="min-h-[100px]"
          />
        </div>

        <div className="space-y-4">
          <Separator />
          <h4 className="font-medium">Action Settings</h4>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="close-ticket"
              checked={formData.closeTicket}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, closeTicket: checked }))}
            />
            <Label htmlFor="close-ticket">Close ticket when this response is used</Label>
          </div>
        </div>

        {isReportCategory && (
          <div className="space-y-4">
            <Separator />
            <h4 className="font-medium">Punishment Settings</h4>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="issue-punishment"
                checked={formData.issuePunishment}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, issuePunishment: checked }))}
              />
              <Label htmlFor="issue-punishment">Issue punishment when this response is used</Label>
            </div>

            {formData.issuePunishment && (
              <div className="space-y-4 pl-6">
                <div className="space-y-2">
                  <Label>Punishment Type</Label>
                  <Select
                    value={formData.punishmentTypeId?.toString()}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, punishmentTypeId: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select punishment type" />
                    </SelectTrigger>
                    <SelectContent>
                      {punishmentTypes?.map(type => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.name} ({type.category})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Severity Level</Label>
                  <Select
                    value={formData.punishmentSeverity}
                    onValueChange={(value: 'low' | 'regular' | 'severe') => setFormData(prev => ({ ...prev, punishmentSeverity: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="severe">Severe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        )}

        {isAppealCategory && (
          <div className="space-y-4">
            <Separator />
            <h4 className="font-medium">Appeal Action</h4>
            
            <div className="space-y-2">
              <Label>Appeal Decision</Label>
              <Select
                value={formData.appealAction}
                onValueChange={(value: 'pardon' | 'reduce' | 'reject' | 'none') => setFormData(prev => ({ ...prev, appealAction: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No automatic action</SelectItem>
                  <SelectItem value="pardon">Pardon (remove punishment)</SelectItem>
                  <SelectItem value="reduce">Reduce punishment duration</SelectItem>
                  <SelectItem value="reject">Reject appeal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.appealAction === 'reduce' && (
              <div className="space-y-2 pl-6">
                <p className="text-sm text-muted-foreground">
                  Duration reduction will be handled through the ticket form when this response is used.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!formData.name || !formData.message}>
          <Save className="h-4 w-4 mr-2" />
          Save Response
        </Button>
      </DialogFooter>
    </div>
  );
};

// Quick Response Category Form Component
const QuickResponseCategoryForm = ({ 
  category, 
  quickResponsesState, 
  setQuickResponsesState, 
  onSave, 
  onCancel 
}: {
  category: QuickResponseCategory | null;
  quickResponsesState: QuickResponsesConfiguration;
  setQuickResponsesState: (value: QuickResponsesConfiguration) => void;
  onSave: () => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    ticketTypes: category?.ticketTypes || []
  });

  const availableTicketTypes = ['player_report', 'chat_report', 'bug_report', 'appeal', 'support', 'other'];

  const handleSave = () => {
    if (!formData.name || formData.ticketTypes.length === 0) return;

    const newCategory: QuickResponseCategory = {
      id: category?.id || `category_${Date.now()}`,
      name: formData.name,
      ticketTypes: formData.ticketTypes,
      order: category?.order || quickResponsesState.categories.length,
      actions: category?.actions || []
    };

    const updatedConfig = {
      ...quickResponsesState,
      categories: category
        ? quickResponsesState.categories.map(cat => cat.id === category.id ? newCategory : cat)
        : [...quickResponsesState.categories, newCategory]
    };

    setQuickResponsesState(updatedConfig);
    onSave();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="category-name">Category Name</Label>
          <Input
            id="category-name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Report Actions"
          />
        </div>

        <div className="space-y-2">
          <Label>Ticket Types</Label>
          <div className="grid grid-cols-2 gap-2">
            {availableTicketTypes.map(type => (
              <div key={type} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={type}
                  checked={formData.ticketTypes.includes(type)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData(prev => ({ ...prev, ticketTypes: [...prev.ticketTypes, type] }));
                    } else {
                      setFormData(prev => ({ ...prev, ticketTypes: prev.ticketTypes.filter(t => t !== type) }));
                    }
                  }}
                />
                <Label htmlFor={type} className="capitalize">
                  {type.replace('_', ' ')}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!formData.name || formData.ticketTypes.length === 0}>
          <Save className="h-4 w-4 mr-2" />
          Save Category
        </Button>
      </DialogFooter>
    </div>
  );
};

export default TicketSettings;