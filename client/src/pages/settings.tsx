import { useState } from 'react';
import { Bot, MessageSquare, Scale, Shield, Globe, Tag, Plus, X, Fingerprint, KeyRound, Lock, QrCode, Copy, Check, Mail } from 'lucide-react';
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
import PageContainer from '@/components/layout/PageContainer'

const Settings = () => {
  const { } = useSidebar(); // We're not using sidebar context in this component
  
  // More generous left margin to prevent text overlap with sidebar
  const mainContentClass = "ml-[32px] pl-8";

  // Database connection state
  const [dbConnectionStatus, setDbConnectionStatus] = useState(false);
  const [mongodbUri, setMongodbUri] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Sliders state
  const [toxicity, setToxicity] = useState(75);
  const [spam, setSpam] = useState(60);
  const [automated, setAutomated] = useState(40);

  // Switch states
  const [aiModeration, setAiModeration] = useState(true);
  const [aiChat, setAiChat] = useState(true);
  const [aiBan, setAiBan] = useState(true);
  const [staffOverride, setStaffOverride] = useState(true);
  const [requireApproval, setRequireApproval] = useState(true);
  
  // Tags state for each ticket category
  const [bugReportTags, setBugReportTags] = useState<string[]>([
    'UI Issue', 'Server', 'Performance', 'Crash', 'Game Mechanics'
  ]);
  const [playerReportTags, setPlayerReportTags] = useState<string[]>([
    'Harassment', 'Cheating', 'Spam', 'Inappropriate Content', 'Griefing'
  ]);
  const [appealTags, setAppealTags] = useState<string[]>([
    'Ban Appeal', 'Mute Appeal', 'False Positive', 'Second Chance'
  ]);
  
  // For new tag input
  const [newBugTag, setNewBugTag] = useState('');
  const [newPlayerTag, setNewPlayerTag] = useState('');
  const [newAppealTag, setNewAppealTag] = useState('');
  
  // Security tab states
  const [has2FA, setHas2FA] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [showSetup2FA, setShowSetup2FA] = useState(false);
  const [showSetupPasskey, setShowSetupPasskey] = useState(false);
  const [recoveryCodesCopied, setRecoveryCodesCopied] = useState(false);
  
  const { toast } = useToast();
  
  // Check database connection status on page load
  React.useEffect(() => {
    const checkDbStatus = async () => {
      try {
        const response = await fetch('/api/settings/database-status');
        if (response.ok) {
          const data = await response.json();
          setDbConnectionStatus(data.connected);
        }
      } catch (error) {
        console.error('Error checking database status:', error);
        setDbConnectionStatus(false);
      }
    };
    
    checkDbStatus();
  }, []);

  return (
    <PageContainer>
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Settings</h2>
          <Button>
            Save Changes
          </Button>
        </div>
        
        <Card>
          <Tabs defaultValue="ai">
            <TabsList className="w-full h-full justify-start rounded-none bg-transparent border-b border-border overflow-x-auto mx-1">
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
                Punishment Ladders
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
            
            <TabsContent value="punishment">
              <CardContent className="p-6">
                <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted rounded-lg">
                  <p className="text-muted-foreground">Punishment Ladders Settings Panel</p>
                </div>
              </CardContent>
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
      </div>
      </PageContainer>
  );
};

export default Settings;
