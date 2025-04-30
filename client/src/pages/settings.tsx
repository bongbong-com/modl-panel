import { useState } from 'react';
import { Bot, MessageSquare, Scale, Shield, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSidebar } from '@/hooks/use-sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import PageContainer from '@/components/layout/PageContainer'

const Settings = () => {
  const { } = useSidebar(); // We're not using sidebar context in this component
  
  // More generous left margin to prevent text overlap with sidebar
  const mainContentClass = "ml-[32px] pl-8";

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
            <TabsList className="w-full justify-start rounded-none bg-transparent border-b border-border overflow-x-auto">
              <TabsTrigger 
                value="ai" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-4"
              >
                <Bot className="h-4 w-4 mr-2" />
                AI Settings
              </TabsTrigger>
              <TabsTrigger 
                value="chat" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-4"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Chat Filter
              </TabsTrigger>
              <TabsTrigger 
                value="punishment" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-4"
              >
                <Scale className="h-4 w-4 mr-2" />
                Punishment Ladders
              </TabsTrigger>
              <TabsTrigger 
                value="staff" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-4"
              >
                <Shield className="h-4 w-4 mr-2" />
                Staff Management
              </TabsTrigger>
              <TabsTrigger 
                value="general" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-6 py-4"
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
            
            <TabsContent value="staff">
              <CardContent className="p-6">
                <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted rounded-lg">
                  <p className="text-muted-foreground">Staff Management Panel</p>
                </div>
              </CardContent>
            </TabsContent>
            
            <TabsContent value="general">
              <CardContent className="p-6">
                <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted rounded-lg">
                  <p className="text-muted-foreground">General Settings Panel</p>
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
