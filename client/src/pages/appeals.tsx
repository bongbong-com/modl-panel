import { useState } from 'react';
import { useLocation } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, SearchIcon, ShieldCheck, ShieldX } from 'lucide-react';
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

// Define the search form schema
const searchSchema = z.object({
  banId: z.string().min(6, { message: "Ban ID must be at least 6 characters" }),
});

type SearchFormValues = z.infer<typeof searchSchema>;

// Define the appeal form schema
const appealSchema = z.object({
  banId: z.string().min(6, { message: "Ban ID must be at least 6 characters" }),
  playerName: z.string().min(3, { message: "Player name must be at least 3 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  reason: z.string().min(20, { message: "Please provide a detailed explanation (min 20 characters)" }),
});

type AppealFormValues = z.infer<typeof appealSchema>;

// Mock data for demonstration
interface BanInfo {
  id: string;
  playerName: string;
  reason: string;
  date: string;
  staffMember: string;
  status: 'Active' | 'Expired' | 'Pardoned';
  expiresIn?: string;
}

interface AppealInfo {
  id: string;
  banId: string;
  playerName: string;
  submittedOn: string;
  status: 'Pending Review' | 'Under Review' | 'Rejected' | 'Approved';
  lastUpdate?: string;
  staffNotes?: string;
}

const MockBans: Record<string, BanInfo> = {
  'BAN123456': {
    id: 'BAN123456',
    playerName: 'MinecraftPlayer123',
    reason: 'Using cheats/hacks (Movement)',
    date: '2023-12-15',
    staffMember: 'AdminUser42',
    status: 'Active',
    expiresIn: '28 days',
  },
  'BAN654321': {
    id: 'BAN654321',
    playerName: 'GameMaster99',
    reason: 'Harassment and abusive language',
    date: '2023-11-30',
    staffMember: 'ModeratorX',
    status: 'Active',
    expiresIn: '7 days',
  },
  'BAN789012': {
    id: 'BAN789012',
    playerName: 'ProGamer2000',
    reason: 'Griefing protected builds',
    date: '2023-12-01',
    staffMember: 'SeniorMod',
    status: 'Pardoned',
  },
};

const MockAppeals: Record<string, AppealInfo> = {
  'APP123456': {
    id: 'APP123456',
    banId: 'BAN654321',
    playerName: 'GameMaster99',
    submittedOn: '2023-12-01',
    status: 'Under Review',
    lastUpdate: '2023-12-05',
    staffNotes: 'Player has a history of similar behavior. Checking previous records.',
  },
};

const AppealsPage = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [banInfo, setBanInfo] = useState<BanInfo | null>(null);
  const [appealInfo, setAppealInfo] = useState<AppealInfo | null>(null);
  const [showAppealForm, setShowAppealForm] = useState(false);

  // Search form
  const searchForm = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      banId: "",
    },
  });

  // Appeal form
  const appealForm = useForm<AppealFormValues>({
    resolver: zodResolver(appealSchema),
    defaultValues: {
      banId: "",
      playerName: "",
      email: "",
      reason: "",
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
    
    // Prefill the appeal form if ban was found
    if (foundBan) {
      appealForm.setValue('banId', normalizedBanId);
      appealForm.setValue('playerName', foundBan.playerName);
    }
    
    // Show/hide appeal form based on whether an appeal already exists
    setShowAppealForm(!foundAppeal && foundBan?.status === 'Active');
  };

  // Handle appeal form submission
  const onAppealSubmit = (values: AppealFormValues) => {
    // In a real application, this would submit to backend and create an appeal
    toast({
      title: "Appeal Submitted",
      description: `Your appeal for ban ${values.banId} has been submitted and will be reviewed by our staff.`,
    });
    
    // Create mock appeal
    const newAppeal: AppealInfo = {
      id: `APP${Math.floor(100000 + Math.random() * 900000)}`,
      banId: values.banId,
      playerName: values.playerName,
      submittedOn: new Date().toISOString().split('T')[0],
      status: 'Pending Review',
    };
    
    // Update UI to show the new appeal
    setAppealInfo(newAppeal);
    setShowAppealForm(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="max-w-md w-full">
        {/* Header section */}
        <div className="flex flex-col space-y-2 mb-8 text-center">
          <h1 className="text-3xl font-bold">Ban Appeal System</h1>
          <p className="text-muted-foreground">
            Check the status of your ban or submit an appeal for review
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Check Ban Status</CardTitle>
            <CardDescription>
              Enter your Ban ID to check its status or submit an appeal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...searchForm}>
              <form onSubmit={searchForm.handleSubmit(onSearchSubmit)} className="space-y-4">
                <FormField
                  control={searchForm.control}
                  name="banId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ban ID</FormLabel>
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
                        Enter the Ban ID you received in the ban notification
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
                    <span className="text-sm font-medium">Ban ID:</span>
                    <Badge variant="outline">{banInfo.id}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Player:</span>
                    <span className="text-sm">{banInfo.playerName}</span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-medium">Reason:</span>
                    <span className="text-sm text-right max-w-[250px]">{banInfo.reason}</span>
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
              </div>
            )}
            
            {/* Appeal Form */}
            {showAppealForm && (
              <div className="mt-8 space-y-4">
                <Separator />
                <h3 className="text-lg font-semibold mt-6">Submit Appeal</h3>
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
                      name="playerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Player Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
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
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-center border-t pt-4">
            <Button variant="link" onClick={() => setLocation('/auth')}>
              Return to login
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default AppealsPage;