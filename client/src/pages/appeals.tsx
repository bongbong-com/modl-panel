import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, SearchIcon, ShieldCheck, ShieldX } from 'lucide-react';
import { Label } from "modl-shared-web/components/ui/label";
import { Button } from "modl-shared-web/components/ui/button";
import { Input } from "modl-shared-web/components/ui/input";
import { Checkbox } from "modl-shared-web/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "modl-shared-web/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "modl-shared-web/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "modl-shared-web/components/ui/card";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "modl-shared-web/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Separator } from 'modl-shared-web/components/ui/separator';
import { Textarea } from 'modl-shared-web/components/ui/textarea';
import { Badge } from 'modl-shared-web/components/ui/badge';
import { useSettings, useCreateAppeal } from '@/hooks/use-data';

// Appeal form field interfaces
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

// Format date to MM/dd/yy HH:mm in browser's timezone
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (e) {
    return dateString; // Return original string if formatting fails
  }
};

// Define the search form schema
const searchSchema = z.object({
  banId: z.string().min(6, { message: "Ban ID must be at least 6 characters" }),
});

type SearchFormValues = z.infer<typeof searchSchema>;

// Interface for punishment/ban information
interface BanInfo {
  id: string;
  reason: string;
  date: string;
  staffMember: string;
  status: 'Active' | 'Expired' | 'Pardoned';
  expiresIn?: string;
  type: string;
  playerUuid?: string;
  isAppealable?: boolean; // Whether this punishment type can be appealed
}

// Interface for appeal messages
interface AppealMessage {
  id: string;
  sender: 'player' | 'staff' | 'system';
  senderName: string;
  content: string;
  timestamp: string;
  isStaffNote?: boolean;
}

// Interface for appeal information
interface AppealInfo {
  id: string;
  banId: string;
  submittedOn: string;
  status: 'Pending Review' | 'Under Review' | 'Rejected' | 'Approved' | 'Open' | 'Closed';
  lastUpdate?: string;
  messages: AppealMessage[];
}

const AppealsPage = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [banInfo, setBanInfo] = useState<BanInfo | null>(null);
  const [appealInfo, setAppealInfo] = useState<AppealInfo | null>(null);
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [isLoadingPunishment, setIsLoadingPunishment] = useState(false);

  // Fetch settings to get appeal form configuration
  const { data: settings } = useSettings();
  const appealFormSettings = settings?.appealForm as AppealFormSettings | undefined;

  // API mutations
  const createAppealMutation = useCreateAppeal();

  // Create dynamic form schema based on appeal form settings
  const createDynamicSchema = () => {
    if (!appealFormSettings?.fields) {
      // Fallback to basic schema if no settings
      return z.object({
        banId: z.string().min(6, { message: "Ban ID must be at least 6 characters" }),
        email: z.string().email({ message: "Please enter a valid email address" }),
        reason: z.string().min(20, { message: "Please provide a detailed explanation (min 20 characters)" }),
      });
    }

    const schemaFields: Record<string, any> = {
      banId: z.string().min(6, { message: "Ban ID must be at least 6 characters" }),
      email: z.string().email({ message: "Please enter a valid email address" }),
    };

    appealFormSettings.fields.forEach(field => {
      switch (field.type) {
        case 'text':
          schemaFields[field.id] = field.required 
            ? z.string().min(1, { message: `${field.label} is required` })
            : z.string().optional();
          break;
        case 'textarea':
          schemaFields[field.id] = field.required 
            ? z.string().min(10, { message: `${field.label} must be at least 10 characters` })
            : z.string().optional();
          break;
        case 'checkbox':
          schemaFields[field.id] = field.required 
            ? z.boolean().refine(val => val === true, { message: `${field.label} must be checked` })
            : z.boolean().optional();
          break;
        case 'dropdown':
          schemaFields[field.id] = field.required 
            ? z.string().min(1, { message: `${field.label} is required` })
            : z.string().optional();
          break;
      }
    });

    return z.object(schemaFields);
  };

  const dynamicSchema = createDynamicSchema();
  type DynamicFormValues = z.infer<typeof dynamicSchema>;

  // Dynamic form
  const appealForm = useForm<DynamicFormValues>({
    resolver: zodResolver(dynamicSchema),
    defaultValues: {
      banId: "",
      email: "",
      // Add default values for dynamic fields
      ...Object.fromEntries(
        (appealFormSettings?.fields || []).map(field => [
          field.id, 
          field.type === 'checkbox' ? false : ''
        ])
      ),
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
  const onSearchSubmit = async (values: SearchFormValues) => {
    const normalizedBanId = values.banId.toUpperCase().replace(/\s/g, '');
    setIsLoadingPunishment(true);

    try {
      // Fetch punishment information from public API
      const response = await fetch(`/api/public/punishment/${normalizedBanId}/appeal-info`);
      
      if (!response.ok) {
        if (response.status === 400) {
          // Check if it's an unstarted punishment error
          const errorData = await response.json();
          if (errorData.error?.includes('not been started yet')) {
            toast({
              title: "Cannot Appeal Unstarted Punishment",
              description: "This punishment has not been started yet and cannot be appealed at this time.",
              variant: "destructive"
            });
            return;
          }
        }
        throw new Error('Punishment not found');
      }

      const punishment = await response.json();
        // Transform punishment data to BanInfo format
      const banInfo: BanInfo = {
        id: punishment.id,
        reason: 'Punishment details are not available publicly', // Reason is no longer provided by public API
        date: formatDate(punishment.issued),
        staffMember: 'Staff', // Public API doesn't expose staff member names
        status: punishment.active ? 'Active' : 'Expired',
        expiresIn: punishment.expires ? formatDate(punishment.expires) : 'Permanent', // Use the expires field from API
        type: punishment.type,
        playerUuid: punishment.playerUsername, // Use username instead of UUID for public API
        isAppealable: punishment.appealable, // Use the appealable field from public API
      };

      setBanInfo(banInfo);

      // Check for existing appeals from the public API response
      if (punishment.existingAppeal) {
        const appealInfo: AppealInfo = {
          id: punishment.existingAppeal.id,
          banId: punishment.id,
          submittedOn: punishment.existingAppeal.submittedDate,
          status: punishment.existingAppeal.status,
          lastUpdate: punishment.existingAppeal.submittedDate,
          messages: [] // Public API doesn't expose appeal messages for security
        };
        setAppealInfo(appealInfo);
        setShowAppealForm(false);
      } else {        // Show appeal form if no existing appeal and punishment is active and appealable
        const canAppeal = banInfo.status === 'Active' && 
                          banInfo.isAppealable !== false;
        setShowAppealForm(canAppeal);
        setAppealInfo(null);
      }

      // Prefill form with punishment ID
      appealForm.setValue('banId', normalizedBanId);

    } catch (error) {
      console.error('Error fetching punishment:', error);
      setBanInfo(null);
      setAppealInfo(null);
      setShowAppealForm(false);
      toast({
        title: "Punishment not found",
        description: `No punishment found with ID: ${normalizedBanId}`,
        variant: "destructive"
      });
    } finally {
      setIsLoadingPunishment(false);
    }
  };

  // Handle appeal form submission
  const onAppealSubmit = async (values: DynamicFormValues) => {
    if (!banInfo) return;

    try {
      const appealData = {
        punishmentId: values.banId,
        playerUuid: banInfo.playerUuid,
        email: values.email,
        reason: values.reason || '', // Fallback for basic schema
        additionalData: Object.fromEntries(
          Object.entries(values).filter(([key]) => 
            !['banId', 'email', 'reason'].includes(key)
          )
        ),
      };

      await createAppealMutation.mutateAsync(appealData);

      toast({
        title: "Appeal Submitted",
        description: `Your appeal for punishment ${values.banId} has been submitted and will be reviewed by our staff.`,
      });

      // Refresh the page data
      setShowAppealForm(false);
      onSearchSubmit({ banId: values.banId });

    } catch (error) {
      console.error('Error submitting appeal:', error);
      toast({
        title: "Error",
        description: "Failed to submit appeal. Please try again.",
        variant: "destructive"
      });
    }
  };


  // Render dynamic form field
  const renderFormField = (field: AppealFormField) => {
    switch (field.type) {
      case 'text':
        return (
          <FormField
            key={field.id}
            control={appealForm.control}
            name={field.id as any}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>{field.label}</FormLabel>
                <FormControl>
                  <Input {...formField} placeholder={field.description} />
                </FormControl>
                {field.description && (
                  <FormDescription>{field.description}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'textarea':
        return (
          <FormField
            key={field.id}
            control={appealForm.control}
            name={field.id as any}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>{field.label}</FormLabel>
                <FormControl>
                  <Textarea 
                    {...formField} 
                    placeholder={field.description}
                    className="min-h-[100px]"
                  />
                </FormControl>
                {field.description && (
                  <FormDescription>{field.description}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'checkbox':
        return (
          <FormField
            key={field.id}
            control={appealForm.control}
            name={field.id as any}
            render={({ field: formField }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={formField.value}
                    onCheckedChange={formField.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>{field.label}</FormLabel>
                  {field.description && (
                    <FormDescription>{field.description}</FormDescription>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'dropdown':
        return (
          <FormField
            key={field.id}
            control={appealForm.control}
            name={field.id as any}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel>{field.label}</FormLabel>
                <Select onValueChange={formField.onChange} defaultValue={formField.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={field.description || "Select an option"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {field.description && (
                  <FormDescription>{field.description}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        );

      default:
        return null;
    }
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
          <CardContent className="pt-6">
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
                            disabled={isLoadingPunishment}
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

                <Button type="submit" className="w-full mt-6" disabled={isLoadingPunishment}>
                  {isLoadingPunishment ? "Searching..." : "Check Status"}
                </Button>
              </form>
            </Form>
            
            {/* Ban Information Section */}
            {banInfo && (
              <div className="mt-8 space-y-4">
                <h3 className="text-lg font-semibold">Punishment Information</h3>
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
                    <span className="text-sm font-medium">Reason:</span>
                    <span className="text-sm text-right max-w-[200px] break-words">{banInfo.reason}</span>
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
                      {banInfo.expiresIn && ` (Expires: ${banInfo.expiresIn})`}
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
                    <span className="text-sm">{formatDate(appealInfo.submittedOn)}</span>
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
                      <span className="text-sm">{formatDate(appealInfo.lastUpdate)}</span>
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
                      Your appeal has been approved! Your punishment has been lifted or reduced.
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Note about communication */}
                <div className="mt-6 space-y-4">
                  <Separator />
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Communication</AlertTitle>
                    <AlertDescription>
                      For any questions or additional information regarding your appeal, please contact our support team directly.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            )}
            
            {/* Dynamic Appeal Form */}
            {showAppealForm && banInfo && (
              <div className="mt-8 space-y-4">
                <Separator />
                <h3 className="text-lg font-semibold mt-6">Submit Appeal</h3>
                  {/* Unavailable punishment type notice */}
                {banInfo.isAppealable === false && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Appeal Not Available</AlertTitle>
                    <AlertDescription>
                      This punishment type is not appealable. If you believe this is in error, please contact support directly.
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Dynamic Appeal Form */}
                {banInfo.isAppealable !== false && (
                  <Form {...appealForm}>
                    <form onSubmit={appealForm.handleSubmit(onAppealSubmit)} className="space-y-4">
                      {/* Punishment ID Field (Read-only) */}
                      <FormField
                        control={appealForm.control}
                        name="banId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Punishment ID</FormLabel>
                            <FormControl>
                              <Input {...field} readOnly disabled />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Email Field */}
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
                      
                      {/* Dynamic Fields */}
                      {appealFormSettings?.fields
                        ?.sort((a, b) => a.order - b.order)
                        .map(field => renderFormField(field))}
                      
                      {/* Fallback reason field if no dynamic fields */}
                      {(!appealFormSettings?.fields || appealFormSettings.fields.length === 0) && (
                        <FormField
                          control={appealForm.control}
                          name="reason"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Appeal Reason</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  placeholder="Explain why you believe this punishment should be reviewed..."
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
                      )}
                      
                      <Button 
                        type="submit" 
                        className="w-full mt-6" 
                        disabled={createAppealMutation.isPending}
                      >
                        {createAppealMutation.isPending ? "Submitting..." : "Submit Appeal"}                      </Button>
                    </form>
                  </Form>
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
