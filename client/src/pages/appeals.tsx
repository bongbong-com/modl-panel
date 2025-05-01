import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, SearchIcon, ShieldCheck, ShieldX, Link2, UploadCloud, Send } from 'lucide-react';
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

// Define the search form schema
const searchSchema = z.object({
  banId: z.string().min(6, { message: "Ban ID must be at least 6 characters" }),
});

type SearchFormValues = z.infer<typeof searchSchema>;

// Define base appeal schema with common fields
const baseAppealSchema = z.object({
  banId: z.string().min(6, { message: "Ban ID must be at least 6 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
});

// Extended schemas for each punishment type
const securityBanSchema = baseAppealSchema.extend({
  accountSecured: z.boolean({
    required_error: "Please indicate if you've secured your account",
  }),
  additionalInfo: z.string().optional(),
});

const linkedBanSchema = baseAppealSchema.extend({
  accessedLinkedAccount: z.boolean({
    required_error: "Please indicate if you've logged into the linked account",
  }),
  appealReason: z.string().min(20, {
    message: "Please provide a detailed reason for your appeal (at least 20 characters)",
  }),
  evidence: z.string().optional(),
});

const badNameSkinSchema = baseAppealSchema.extend({
  understandAutoUnban: z.boolean({
    required_error: "Please confirm your understanding",
  }),
  appealReason: z.string().min(20, {
    message: "Please provide a detailed reason for your appeal (at least 20 characters)",
  }),
  evidence: z.string().optional(),
});

const generalViolationSchema = baseAppealSchema.extend({
  punishmentError: z.boolean({
    required_error: "Please indicate if you believe this punishment was made in error",
  }),
  appealReason: z.string().min(20, {
    message: "Please provide a detailed reason for your appeal (at least 20 characters)",
  }),
  evidence: z.string().optional(),
});

// Default schema for standard appeals
const appealSchema = baseAppealSchema.extend({
  reason: z.string().min(20, {
    message: "Please provide a detailed explanation (min 20 characters)",
  }),
});

// Define types for our forms
type BaseAppealFormValues = z.infer<typeof baseAppealSchema>;
type SecurityBanAppealValues = z.infer<typeof securityBanSchema>;
type LinkedBanAppealValues = z.infer<typeof linkedBanSchema>;
type BadNameSkinAppealValues = z.infer<typeof badNameSkinSchema>;
type GeneralViolationAppealValues = z.infer<typeof generalViolationSchema>;
type AppealFormValues = z.infer<typeof appealSchema>;

// Mock data for demonstration
interface BanInfo {
  id: string;
  reason: string;
  date: string;
  staffMember: string;
  status: 'Active' | 'Expired' | 'Pardoned';
  expiresIn?: string;
  type: PunishmentType;
}

type PunishmentType = 
  | 'Kick' | 'Blacklist' 
  | 'Security Ban'
  | 'Linked Ban'
  | 'Bad Skin' | 'Bad Name'
  | 'Chat Abuse' | 'Anti Social' | 'Targeting' | 'Bad Content' 
  | 'Team Abuse' | 'Game Abuse' | 'Cheating' | 'Game Trading'
  | 'Account Abuse' | 'Scamming' | 'Manual Mute' | 'Manual Ban';

interface AppealMessage {
  id: string;
  sender: 'player' | 'staff' | 'system';
  senderName: string;
  content: string;
  timestamp: string;
  isStaffNote?: boolean;
}

interface AppealInfo {
  id: string;
  banId: string;
  submittedOn: string;
  status: 'Pending Review' | 'Under Review' | 'Rejected' | 'Approved';
  lastUpdate?: string;
  messages: AppealMessage[];
}

const MockBans: Record<string, BanInfo> = {
  'BAN123456': {
    id: 'BAN123456',
    reason: 'Using cheats/hacks (Movement)',
    date: '2023-12-15',
    staffMember: 'AdminUser42',
    status: 'Active',
    expiresIn: '28 days',
    type: 'Cheating'
  },
  'BAN654321': {
    id: 'BAN654321',
    reason: 'Harassment and abusive language',
    date: '2023-11-30',
    staffMember: 'ModeratorX',
    status: 'Active',
    expiresIn: '7 days',
    type: 'Chat Abuse'
  },
  'BAN789012': {
    id: 'BAN789012',
    reason: 'Griefing protected builds',
    date: '2023-12-01',
    staffMember: 'SeniorMod',
    status: 'Pardoned',
    type: 'Game Abuse'
  },
  'BAN234567': {
    id: 'BAN234567',
    reason: 'Inappropriate username',
    date: '2024-01-15',
    staffMember: 'AdminUser42',
    status: 'Active',
    expiresIn: '30 days',
    type: 'Bad Name'
  },
  'BAN345678': {
    id: 'BAN345678',
    reason: 'Suspicious login patterns detected',
    date: '2024-02-01',
    staffMember: 'SecurityTeam',
    status: 'Active',
    expiresIn: '14 days',
    type: 'Security Ban'
  },
  'BAN456789': {
    id: 'BAN456789',
    reason: 'Alt account of banned user',
    date: '2024-02-15',
    staffMember: 'ModeratorY',
    status: 'Active',
    type: 'Linked Ban'
  },
  'BAN567890': {
    id: 'BAN567890',
    reason: 'Disruptive behavior',
    date: '2024-02-20',
    staffMember: 'AdminZ',
    status: 'Active',
    type: 'Kick'
  }
};

const MockAppeals: Record<string, AppealInfo> = {
  'APP123456': {
    id: 'APP123456',
    banId: 'BAN654321',
    submittedOn: '2023-12-01',
    status: 'Under Review',
    lastUpdate: '2023-12-05',
    messages: [
      {
        id: 'm1',
        sender: 'player',
        senderName: 'PlayerUser123',
        content: 'I believe this ban was unfair as I was only responding to harassment from another player. I have screenshots showing they started the argument.',
        timestamp: '2023-12-01 14:23',
      },
      {
        id: 'm2',
        sender: 'system',
        senderName: 'System',
        content: 'Your appeal has been received and will be reviewed by our moderation team.',
        timestamp: '2023-12-01 14:23',
      },
      {
        id: 'm3',
        sender: 'staff',
        senderName: 'ModeratorX',
        content: 'I\'ve reviewed your case and can see the chat logs. Can you provide the screenshots you mentioned showing the other player\'s harassment?',
        timestamp: '2023-12-03 09:15',
      },
      {
        id: 'm4',
        sender: 'player',
        senderName: 'PlayerUser123',
        content: 'Here are the screenshots showing the conversation before my messages: https://example.com/screenshots',
        timestamp: '2023-12-03 15:42',
      },
      {
        id: 'm5',
        sender: 'staff',
        senderName: 'AdminUser42',
        content: 'Player has a history of similar behavior. Checking previous records.',
        timestamp: '2023-12-05 11:30',
        isStaffNote: true,
      },
    ],
  },
};

const AppealsPage = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [banInfo, setBanInfo] = useState<BanInfo | null>(null);
  const [appealInfo, setAppealInfo] = useState<AppealInfo | null>(null);
  const [showAppealForm, setShowAppealForm] = useState(false);
  
  // Create forms for different punishment types
  const securityBanForm = useForm<SecurityBanAppealValues>({
    resolver: zodResolver(securityBanSchema),
    defaultValues: {
      banId: "",
      email: "",
      accountSecured: false,
      additionalInfo: "",
    },
  });
  
  const linkedBanForm = useForm<LinkedBanAppealValues>({
    resolver: zodResolver(linkedBanSchema),
    defaultValues: {
      banId: "",
      email: "",
      accessedLinkedAccount: false,
      appealReason: "",
      evidence: "",
    },
  });
  
  const badNameSkinForm = useForm<BadNameSkinAppealValues>({
    resolver: zodResolver(badNameSkinSchema),
    defaultValues: {
      banId: "",
      email: "",
      understandAutoUnban: false,
      appealReason: "",
      evidence: "",
    },
  });
  
  const generalViolationForm = useForm<GeneralViolationAppealValues>({
    resolver: zodResolver(generalViolationSchema),
    defaultValues: {
      banId: "",
      email: "",
      punishmentError: false,
      appealReason: "",
      evidence: "",
    },
  });

  // Standard appeal form for fallback
  const appealForm = useForm<AppealFormValues>({
    resolver: zodResolver(appealSchema),
    defaultValues: {
      banId: "",
      email: "",
      reason: "",
    },
  });

  // Search form
  const searchForm = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      banId: "",
    },
  });

  // Handle search form submission
  const onSearchSubmit = (values: SearchFormValues) => {
    // Normalize ban ID (uppercase, remove spaces)
    const normalizedBanId = values.banId.toUpperCase().replace(/\s/g, '');
    
    // Look up ban info
    const foundBan = MockBans[normalizedBanId];
    setBanInfo(foundBan || null);
    
    // Look up existing appeal for this ban
    const foundAppeal = Object.values(MockAppeals).find(
      appeal => appeal.banId === normalizedBanId
    );
    setAppealInfo(foundAppeal || null);
    
    if (!foundBan) {
      toast({
        title: "Ban not found",
        description: `No ban found with ID: ${normalizedBanId}`,
        variant: "destructive"
      });
      return;
    }
    
    // Prefill the appeal forms based on punishment type
    if (foundBan) {
      // Common fields for all forms
      const commonFields = {
        banId: normalizedBanId
      };
      
      // Update all forms with common data
      appealForm.setValue('banId', normalizedBanId);
      
      securityBanForm.setValue('banId', normalizedBanId);
      
      linkedBanForm.setValue('banId', normalizedBanId);
      
      badNameSkinForm.setValue('banId', normalizedBanId);
      
      generalViolationForm.setValue('banId', normalizedBanId);
    }
    
    // Show/hide appeal form based on whether an appeal already exists and ban type
    const canAppeal = !foundAppeal && foundBan?.status === 'Active' && 
                      !['Kick', 'Blacklist'].includes(foundBan.type);
    
    setShowAppealForm(canAppeal);
  };

  // Get the active form based on punishment type
  const getActiveForm = () => {
    if (!banInfo) return appealForm;
    
    switch (banInfo.type) {
      case 'Security Ban':
        return securityBanForm;
      case 'Linked Ban':
        return linkedBanForm;
      case 'Bad Name':
      case 'Bad Skin':
        return badNameSkinForm;
      case 'Chat Abuse':
      case 'Anti Social':
      case 'Targeting':
      case 'Bad Content':
      case 'Team Abuse':
      case 'Game Abuse':
      case 'Cheating':
      case 'Game Trading':
      case 'Account Abuse':
      case 'Scamming':
      case 'Manual Mute':
      case 'Manual Ban':
        return generalViolationForm;
      default:
        return appealForm;
    }
  };

  // Reply message state and form
  const [newReply, setNewReply] = useState("");
  
  // Generic appeal form submission handler
  const onAppealSubmit = (values: any) => {
    // In a real application, this would submit to backend and create an appeal
    toast({
      title: "Appeal Submitted",
      description: `Your appeal for ban ${values.banId} has been submitted and will be reviewed by our staff.`,
    });
    
    // Format all form data into a structured message
    let formattedContent = "Appeal Details:\n\n";
    
    // Add different fields based on form type
    if ('reason' in values) {
      formattedContent += `Appeal Reason: ${values.reason || "Not provided"}\n`;
    }
    
    if ('appealReason' in values) {
      formattedContent += `Appeal Reason: ${values.appealReason || "Not provided"}\n`;
    }
    
    if ('additionalInfo' in values) {
      formattedContent += `Additional Information: ${values.additionalInfo || "Not provided"}\n`;
    }
    
    // Add checkbox values
    if ('punishmentError' in values) {
      formattedContent += `Issued in Error: ${values.punishmentError ? "Yes" : "No"}\n`;
    }
    
    if ('accountSecured' in values) {
      formattedContent += `Account Secured: ${values.accountSecured ? "Yes" : "No"}\n`;
    }
    
    if ('accessedLinkedAccount' in values) {
      formattedContent += `Accessed Linked Account: ${values.accessedLinkedAccount ? "Yes" : "No"}\n`;
    }
    
    if ('understandAutoUnban' in values) {
      formattedContent += `Understands Auto-Unban Process: ${values.understandAutoUnban ? "Yes" : "No"}\n`;
    }
    
    // Add evidence links if provided
    if ('evidence' in values && values.evidence) {
      formattedContent += `\nEvidence: ${values.evidence}\n`;
    }
    
    // Create initial messages
    const initialMessages: AppealMessage[] = [
      {
        id: `m${Date.now()}-1`,
        sender: 'player',
        senderName: 'You',
        content: formattedContent,
        timestamp: new Date().toLocaleString(),
      },
      {
        id: `m${Date.now()}-2`,
        sender: 'system',
        senderName: 'System',
        content: 'Your appeal has been received and will be reviewed by our moderation team.',
        timestamp: new Date().toLocaleString(),
      }
    ];
    
    // Create mock appeal with messages
    const newAppeal: AppealInfo = {
      id: `APP${Math.floor(100000 + Math.random() * 900000)}`,
      banId: values.banId,
      submittedOn: new Date().toISOString().split('T')[0],
      status: 'Pending Review',
      lastUpdate: new Date().toISOString().split('T')[0],
      messages: initialMessages,
    };
    
    // Update UI to show the new appeal
    setAppealInfo(newAppeal);
    setShowAppealForm(false);
  };
  
  // Handle sending a reply to an existing appeal
  const handleSendReply = () => {
    if (!newReply.trim() || !appealInfo) return;
    
    // Create new message
    const newMessage: AppealMessage = {
      id: `m${Date.now()}`,
      sender: 'player',
      senderName: 'You',
      content: newReply,
      timestamp: new Date().toLocaleString(),
    };
    
    // Create updated appeal with the new message
    const updatedAppeal: AppealInfo = {
      ...appealInfo,
      lastUpdate: new Date().toISOString().split('T')[0],
      messages: [...(appealInfo.messages || []), newMessage],
    };
    
    // Update UI and clear input
    setAppealInfo(updatedAppeal);
    setNewReply("");
    
    // Show confirmation toast
    toast({
      title: "Reply Sent",
      description: "Your reply has been added to the appeal.",
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="max-w-md w-full">
        {/* Header section */}
        <div className="flex flex-col space-y-2 mb-8 text-center">
          <h1 className="text-3xl font-bold">Punishment Appeal</h1>
          <p className="text-muted-foreground">
            Check the status of or submit an appeal for review
          </p>
        </div>

        <Card>
          <br></br>
          <CardContent>
            <Form {...searchForm}>
              <form onSubmit={searchForm.handleSubmit(onSearchSubmit)} className="space-y-4">
                <FormField
                  control={searchForm.control}
                  name="banId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Punishment ID</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            placeholder="e.g. BAN123456"
                            className="pl-10"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Enter the Punishment ID you received with your ban/mute
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full mt-6">
                  Check Status
                </Button>
              </form>
            </Form>
            
            {/* Ban Information Section */}
            {banInfo && (
              <div className="mt-8 space-y-4">
                <h3 className="text-lg font-semibold">Ban Information</h3>
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Punishment ID:</span>
                    <Badge variant="outline">{banInfo.id}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Type:</span>
                    <Badge variant="outline">{banInfo.type}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Date:</span>
                    <span className="text-sm">{banInfo.date}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status:</span>
                    <Badge 
                      variant={banInfo.status === 'Active' ? "destructive" : 
                              banInfo.status === 'Pardoned' ? "outline" : "default"}
                      className={banInfo.status === 'Pardoned' ? "border-green-500 text-green-500" : ""}
                    >
                      {banInfo.status}
                      {banInfo.expiresIn && ` (Expires in ${banInfo.expiresIn})`}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
            
            {/* Appeal Information Section */}
            {appealInfo && (
              <div className="mt-8 space-y-4">
                <h3 className="text-lg font-semibold">Appeal Status</h3>
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Appeal ID:</span>
                    <Badge variant="outline">{appealInfo.id}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Submitted:</span>
                    <span className="text-sm">{appealInfo.submittedOn}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status:</span>
                    <Badge 
                      variant={
                        appealInfo.status === 'Approved' ? "outline" :
                        appealInfo.status === 'Rejected' ? "destructive" :
                        appealInfo.status.includes('Review') ? "default" : "outline"
                      }
                      className={appealInfo.status === 'Approved' ? "border-green-500 text-green-500" : ""}
                    >
                      {appealInfo.status}
                    </Badge>
                  </div>
                  {appealInfo.lastUpdate && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Last Update:</span>
                      <span className="text-sm">{appealInfo.lastUpdate}</span>
                    </div>
                  )}
                </div>
                
                {appealInfo.status === 'Pending Review' && (
                  <Alert className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Appeal Under Review</AlertTitle>
                    <AlertDescription>
                      Your appeal is in the queue and will be reviewed by our staff. This process typically takes 1-3 days.
                    </AlertDescription>
                  </Alert>
                )}
                
                {appealInfo.status === 'Rejected' && (
                  <Alert variant="destructive" className="mt-4">
                    <ShieldX className="h-4 w-4" />
                    <AlertTitle>Appeal Rejected</AlertTitle>
                    <AlertDescription>
                      Your appeal has been reviewed and rejected. You may submit a new appeal after 30 days.
                    </AlertDescription>
                  </Alert>
                )}
                
                {appealInfo.status === 'Approved' && (
                  <Alert className="mt-4 border-green-500 text-green-500 bg-green-50 dark:bg-green-950 dark:bg-opacity-20">
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>Appeal Approved</AlertTitle>
                    <AlertDescription>
                      Your appeal has been approved! Your ban has been lifted or reduced.
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Messages Section */}
                {appealInfo.messages && appealInfo.messages.length > 0 && (
                  <div className="mt-6 space-y-4">
                    <Separator />
                    <h4 className="text-md font-semibold">Conversation</h4>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto p-2">
                      {/* Filter out staff-only messages in the public appeals route */}
                      {appealInfo.messages
                        .filter(message => !message.isStaffNote && message.sender !== 'staff')
                        .map((message) => (
                          <div 
                            key={message.id} 
                            className={`flex flex-col ${
                              message.sender === 'player' 
                                ? 'items-end' 
                                : 'items-center'
                            }`}
                          >
                            <div 
                              className={`max-w-[85%] rounded-lg p-3 ${
                                message.sender === 'player' 
                                  ? 'bg-primary text-primary-foreground' 
                                  : 'bg-muted/50 text-xs w-full text-center'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-medium ${
                                  message.sender === 'player' 
                                    ? 'text-primary-foreground/80' 
                                    : 'text-muted-foreground'
                                }`}>
                                  {message.senderName}
                                </span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                              <div className="text-xs opacity-70 mt-1 text-right">
                                {message.timestamp}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                    
                    {/* Reply input */}
                    {appealInfo.status !== 'Approved' && appealInfo.status !== 'Rejected' && (
                      <div className="mt-4">
                        <div className="flex flex-col space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="reply">Add a reply</Label>
                            <div className="text-xs text-muted-foreground">
                              Your reply will be visible to staff
                            </div>
                          </div>
                          <Textarea
                            id="reply"
                            placeholder="Type your message here..."
                            rows={3}
                            value={newReply}
                            onChange={(e) => setNewReply(e.target.value)}
                          />
                          <div className="flex justify-end">
                            <Button 
                              onClick={handleSendReply}
                              disabled={!newReply.trim()}
                              size="sm"
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Send Reply
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Appeal Form */}
            {showAppealForm && banInfo && (
              <div className="mt-8 space-y-4">
                <Separator />
                <h3 className="text-lg font-semibold mt-6">Submit Appeal</h3>
                
                {/* Unavailable ban type notice */}
                {['Kick', 'Blacklist'].includes(banInfo.type) && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Appeal Not Available</AlertTitle>
                    <AlertDescription>
                      {banInfo.type === 'Kick' ? 
                        "Kicks are temporary actions and cannot be appealed. Please rejoin the server."
                        : 
                        "This type of punishment cannot be appealed. If you believe this is in error, please contact support directly."
                      }
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Security Ban Appeal Form */}
                {banInfo.type === 'Security Ban' && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Your account has been flagged for security concerns. Please confirm you've secured your account.
                    </p>
                    
                    <Form {...securityBanForm}>
                      <form onSubmit={securityBanForm.handleSubmit(onAppealSubmit)} className="space-y-4">
                        {/* Common Fields */}
                        <FormField
                          control={securityBanForm.control}
                          name="banId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ban ID</FormLabel>
                              <FormControl>
                                <Input {...field} readOnly disabled />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={securityBanForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" placeholder="Your email for notifications" />
                              </FormControl>
                              <FormDescription>
                                We'll notify you when your appeal is processed
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Security-specific Fields */}
                        <FormField
                          control={securityBanForm.control}
                          name="accountSecured"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  I have secured my account
                                </FormLabel>
                                <FormDescription>
                                  I've changed my password, enabled 2FA, and secured my email account
                                </FormDescription>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={securityBanForm.control}
                          name="additionalInfo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Additional Information (Optional)</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  placeholder="Any additional details about your account security"
                                  className="min-h-[80px]"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <Button type="submit" className="w-full mt-6">
                          Submit Appeal
                        </Button>
                      </form>
                    </Form>
                  </>
                )}
                
                {/* Linked Ban Appeal Form */}
                {banInfo.type === 'Linked Ban' && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Your account has been linked to another banned account. Please provide information below.
                    </p>
                    
                    <Form {...linkedBanForm}>
                      <form onSubmit={linkedBanForm.handleSubmit(onAppealSubmit)} className="space-y-4">
                        {/* Common Fields */}
                        <FormField
                          control={linkedBanForm.control}
                          name="banId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ban ID</FormLabel>
                              <FormControl>
                                <Input {...field} readOnly disabled />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={linkedBanForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" placeholder="Your email for notifications" />
                              </FormControl>
                              <FormDescription>
                                We'll notify you when your appeal is processed
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Linked Ban-specific Fields */}
                        <FormField
                          control={linkedBanForm.control}
                          name="accessedLinkedAccount"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  I have logged into the linked account in question
                                </FormLabel>
                                <FormDescription>
                                  Please tell us if you have ever logged into the account you are linked to. Even if it was for 5 seconds 2 years ago.
                                </FormDescription>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={linkedBanForm.control}
                          name="appealReason"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Appeal Reason</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  placeholder="Explain why you believe this ban should be reviewed"
                                  className="min-h-[120px]"
                                />
                              </FormControl>
                              <FormDescription>
                                Be honest and provide as much detail as possible
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={linkedBanForm.control}
                          name="evidence"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Evidence (Optional)</FormLabel>
                              <FormControl>
                                <div className="flex gap-2">
                                  <Input
                                    {...field}
                                    placeholder="Link to screenshots or evidence"
                                  />
                                  <Button type="button" size="icon" variant="outline">
                                    <Link2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </FormControl>
                              <FormDescription>
                                Provide a link to any evidence supporting your appeal
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <Button type="submit" className="w-full mt-6">
                          Submit Appeal
                        </Button>
                      </form>
                    </Form>
                  </>
                )}
                
                {/* Bad Name/Skin Appeal Form */}
                {(banInfo.type === 'Bad Name' || banInfo.type === 'Bad Skin') && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {banInfo.type === 'Bad Name' 
                        ? "Your username has been deemed inappropriate. Changing your name will automatically lift this restriction." 
                        : "Your skin has been deemed inappropriate. Changing your skin will automatically lift this restriction."}
                    </p>
                    
                    <Form {...badNameSkinForm}>
                      <form onSubmit={badNameSkinForm.handleSubmit(onAppealSubmit)} className="space-y-4">
                        {/* Common Fields */}
                        <FormField
                          control={badNameSkinForm.control}
                          name="banId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ban ID</FormLabel>
                              <FormControl>
                                <Input {...field} readOnly disabled />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={badNameSkinForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" placeholder="Your email for notifications" />
                              </FormControl>
                              <FormDescription>
                                We'll notify you when your appeal is processed
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Bad Name/Skin-specific Fields */}
                        <FormField
                          control={badNameSkinForm.control}
                          name="understandAutoUnban"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  I understand changing my {banInfo.type === 'Bad Name' ? 'username' : 'skin'} will lift this ban
                                </FormLabel>
                                <FormDescription>
                                  Instead of waiting for an appeal, you can simply change your {banInfo.type === 'Bad Name' ? 'username' : 'skin'} to resolve this immediately
                                </FormDescription>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={badNameSkinForm.control}
                          name="appealReason"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Appeal Reason</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  placeholder="Explain why you believe this ban should be reviewed"
                                  className="min-h-[120px]"
                                />
                              </FormControl>
                              <FormDescription>
                                Be honest and provide as much detail as possible
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={badNameSkinForm.control}
                          name="evidence"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Evidence (Optional)</FormLabel>
                              <FormControl>
                                <div className="flex gap-2">
                                  <Input
                                    {...field}
                                    placeholder="Link to screenshots or evidence"
                                  />
                                  <Button type="button" size="icon" variant="outline">
                                    <Link2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </FormControl>
                              <FormDescription>
                                Provide a link to any evidence supporting your appeal
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <Button type="submit" className="w-full mt-6">
                          Submit Appeal
                        </Button>
                      </form>
                    </Form>
                  </>
                )}
                
                {/* General Violation Appeal Form */}
                {['Chat Abuse', 'Anti Social', 'Targeting', 'Bad Content', 
                   'Team Abuse', 'Game Abuse', 'Cheating', 'Game Trading',
                   'Account Abuse', 'Scamming', 'Manual Mute', 'Manual Ban'].includes(banInfo.type) && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Please provide a clear explanation of why you believe this ban should be reviewed.
                    </p>
                    
                    <Form {...generalViolationForm}>
                      <form onSubmit={generalViolationForm.handleSubmit(onAppealSubmit)} className="space-y-4">
                        {/* Common Fields */}
                        <FormField
                          control={generalViolationForm.control}
                          name="banId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ban ID</FormLabel>
                              <FormControl>
                                <Input {...field} readOnly disabled />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={generalViolationForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" placeholder="Your email for notifications" />
                              </FormControl>
                              <FormDescription>
                                We'll notify you when your appeal is processed
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Violation-specific Fields */}
                        <FormField
                          control={generalViolationForm.control}
                          name="punishmentError"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  I believe this punishment was issued in error
                                </FormLabel>
                                <FormDescription>
                                  Check this if you believe you were wrongfully punished
                                </FormDescription>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={generalViolationForm.control}
                          name="appealReason"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Appeal Reason</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  placeholder="Explain why you believe this ban should be reviewed"
                                  className="min-h-[120px]"
                                />
                              </FormControl>
                              <FormDescription>
                                Be honest and provide as much detail as possible
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={generalViolationForm.control}
                          name="evidence"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Evidence (Optional)</FormLabel>
                              <FormControl>
                                <div className="flex gap-2">
                                  <Input
                                    {...field}
                                    placeholder="Link to screenshots or evidence"
                                  />
                                  <Button type="button" size="icon" variant="outline">
                                    <Link2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </FormControl>
                              <FormDescription>
                                Provide a link to any evidence supporting your appeal
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <Button type="submit" className="w-full mt-6">
                          Submit Appeal
                        </Button>
                      </form>
                    </Form>
                  </>
                )}
                
                {/* Default Appeal Form (fallback) */}
                {!['Security Ban', 'Linked Ban', 'Bad Name', 'Bad Skin', 'Kick', 'Blacklist',
                   'Chat Abuse', 'Anti Social', 'Targeting', 'Bad Content', 
                   'Team Abuse', 'Game Abuse', 'Cheating', 'Game Trading',
                   'Account Abuse', 'Scamming', 'Manual Mute', 'Manual Ban'].includes(banInfo.type) && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Please provide a clear explanation of why you believe this ban should be reviewed.
                    </p>
                    
                    <Form {...appealForm}>
                      <form onSubmit={appealForm.handleSubmit(onAppealSubmit)} className="space-y-4">
                        <FormField
                          control={appealForm.control}
                          name="banId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ban ID</FormLabel>
                              <FormControl>
                                <Input {...field} readOnly disabled />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={appealForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" placeholder="Your email for notifications" />
                              </FormControl>
                              <FormDescription>
                                We'll notify you when your appeal is processed
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={appealForm.control}
                          name="reason"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Appeal Reason</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  placeholder="Explain why you believe this ban should be reviewed..."
                                  className="min-h-[120px]"
                                />
                              </FormControl>
                              <FormDescription>
                                Be honest and provide as much detail as possible
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <Button type="submit" className="w-full mt-6">
                          Submit Appeal
                        </Button>
                      </form>
                    </Form>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AppealsPage;