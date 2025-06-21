import { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import {
  MessageSquare,
  User,
  Calendar,
  Clock,
  Send,
  ArrowLeft,
  Loader2,
  Tag,
  Link2,
  Copy,
  CheckSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useTicket, useAddTicketReply, useSubmitTicketForm, useSettings } from '@/hooks/use-data';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

export interface TicketMessage {
  id: string;
  sender: string;
  senderType: 'user' | 'staff' | 'system';
  content: string;
  timestamp: string;
  staff?: boolean;
  attachments?: string[];
  closedAs?: string;
}

interface TicketDetails {
  id: string;
  subject: string;
  status: 'Unfinished' | 'Open' | 'Closed';
  reportedBy: string;
  date: string;
  category: string;
  type: 'bug' | 'player' | 'chat' | 'appeal' | 'staff' | 'support';
  messages: TicketMessage[];
  locked?: boolean;
}

interface FormField {
  fieldName: string;
  fieldLabel: string;
  fieldType: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio';
  required: boolean;
  options?: string[];
  helpText?: string;
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

const PlayerTicket = () => {
  const { id } = useParams();
  const [playerName, setPlayerName] = useState('');
  const [newReply, setNewReply] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubject, setFormSubject] = useState('');
  const [formData, setFormData] = useState<Record<string, string>>({});
  
  // Use React Query to fetch ticket data
  const { data: ticketData, isLoading, isError } = useTicket(id || '');
  
  // Fetch settings to get form templates
  const { data: settingsData, isLoading: isLoadingSettings } = useSettings();
    // Mutation hooks for public ticket operations
  const addReplyMutation = useAddTicketReply();
  const submitFormMutation = useSubmitTicketForm();
  
  const [ticketDetails, setTicketDetails] = useState<TicketDetails>({
    id: "",
    subject: "",
    status: "Open",
    reportedBy: "",
    date: "",
    category: "Player Report",
    type: "player",
    messages: []
  });

  const statusColors = {
    'Unfinished': 'bg-gray-50 text-gray-700 border-gray-200',
    'Open': 'bg-green-50 text-green-700 border-green-200', 
    'Closed': 'bg-gray-50 text-gray-700 border-gray-200'
  };

  // Update ticket details when data is fetched
  useEffect(() => {
    if (ticketData) {
      console.log('Received ticket data:', ticketData);
      
      // Map API data to our TicketDetails interface
      const status = ticketData.status || 'Unfinished';
      // Map the status to one of our three statuses: Unfinished, Open, or Closed
      const mappedStatus = status === 'Unfinished' 
        ? 'Unfinished' 
        : (status === 'Open' || status === 'In Progress') 
          ? 'Open' 
          : 'Closed';
          
      setTicketDetails({
        id: ticketData.id || ticketData._id,
        subject: ticketData.subject || 'No Subject',
        status: mappedStatus as 'Unfinished' | 'Open' | 'Closed',
        reportedBy: ticketData.creator || ticketData.reportedBy || 'Unknown',
        date: ticketData.created || ticketData.date || new Date().toISOString(),
        category: ticketData.category || 'Other',
        type: ticketData.type || 'bug',
        messages: (ticketData.replies || ticketData.messages || []),
        locked: ticketData.locked === true
      });
      
      // If creator is set, use it as the default playerName
      if ((ticketData.creator || ticketData.reportedBy) && !playerName) {
        const name = ticketData.creator || ticketData.reportedBy;
        setPlayerName(name);
        localStorage.setItem('playerName', name);
      }
    }
  }, [ticketData, playerName]);

  const handleSendReply = async () => {
    if (!newReply.trim() || !playerName.trim()) return;
    
    setIsSubmitting(true);
    
    // Generate a temporary ID for optimistic UI
    const tempId = Date.now().toString();
    const timestamp = new Date().toISOString();
    
    // Create new message for immediate display
    const newMessage: TicketMessage = {
      id: tempId,
      sender: playerName,
      senderType: 'user',
      content: newReply.trim(),
      timestamp: new Date().toISOString(),
      staff: false
    };
    
    // Update UI immediately with the new message
    setTicketDetails(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage]
    }));
    
    // Format the new reply for the API
    const reply = {
      name: playerName,
      type: 'user',
      content: newReply.trim(),
      created: timestamp,
      staff: false
    };
    
    // Clear the reply field
    setNewReply('');
    
    // Save player name to localStorage for future use
    localStorage.setItem('playerName', playerName);
      try {
      // Send the update to the API using the new public reply endpoint
      await addReplyMutation.mutateAsync({
        id: ticketDetails.id,
        reply: reply
      });
      
      // Manually invalidate the cache for background refresh
      queryClient.invalidateQueries({ queryKey: ['/api/public/tickets', ticketDetails.id] });
    } catch (error) {
      console.error('Error sending reply:', error);
      // If there was an error, we could show a toast message here
      // and potentially remove the optimistic update
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading ticket information...</p>
      </div>
    );
  }

  if (isError || !ticketData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-destructive/10 text-destructive rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-semibold mb-2">Ticket Not Found</h2>
          <p className="mb-4">Sorry, we couldn't find the ticket you're looking for. It may have been deleted or you may not have permission to view it.</p>
        </div>
      </div>
    );
  }



  // Handle form submissions for unfinished tickets
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // For staff applications, auto-generate the subject
    const finalSubject = ticketDetails.type === 'staff' 
      ? `${playerName || ticketDetails.reportedBy}'s Staff Application` 
      : formSubject.trim();
    
    // Check if subject is required for non-staff applications
    if (ticketDetails.type !== 'staff' && !finalSubject) {
      toast({
        title: "Subject Required",
        description: "Please provide a subject for your ticket.",
        variant: "destructive"
      });
      return;
    }
    
    // Check if any required fields are missing
    let missingRequired = false;
    const fields = [];
    
    try {
      // Try to get fields from settings (if available)
      if (settingsData?.settings) {
        const formTemplates = settingsData.settings.get('ticketForms');
        if (formTemplates && formTemplates[ticketDetails.type]) {
          fields.push(...formTemplates[ticketDetails.type]);
        }
      }
      
      // If formTemplates processing fails or returns empty fields, check formTemplates array
      if (fields.length === 0 && settingsData?.formTemplates) {
        const template = settingsData.formTemplates.find((t: any) => t.ticketType === ticketDetails.type);
        if (template && template.fields) {
          fields.push(...template.fields.map((f: any) => ({
            fieldName: f.id,
            fieldLabel: f.label,
            fieldType: f.type,
            required: f.required,
            options: f.options
          })));
        }
      }
    } catch (error) {
      console.error('Error processing form templates:', error);
    }
    
    // If no fields found in settings, use defaults
    if (fields.length === 0) {
      fields.push(...getDefaultFormFields(ticketDetails.type));
    }
    
    // Check required fields
    for (const field of fields) {
      if (field.required && (!formData[field.fieldName] || formData[field.fieldName].trim() === '')) {
        toast({
          title: "Required Field Missing",
          description: `Please complete the "${field.fieldLabel}" field.`,
          variant: "destructive"
        });
        return;
      }
    }
    
    // Validation already completed above
    
    setIsSubmitting(true);
      try {
      // Submit the form to complete the ticket using the new public endpoint
      await submitFormMutation.mutateAsync({
        id: ticketDetails.id,
        formData: {
          subject: finalSubject,
          formData: formData
        }
      });
      
      // Fetch the updated ticket data
      queryClient.invalidateQueries({ queryKey: ['/api/public/tickets', ticketDetails.id] });
      
      toast({
        title: "Ticket Submitted Successfully",
        description: "Your ticket is now open for staff review.",
        variant: "default"
      });

      window.location.reload();
    } catch (error) {
      console.error('Error submitting ticket form:', error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your ticket. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle form field changes
  const handleFormFieldChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Define default form templates based on ticket type
  const getDefaultFormFields = (type: string): FormField[] => {
    const defaultTemplates: Record<string, FormField[]> = {
      'bug': [
        { fieldName: 'description', fieldLabel: 'Bug Description', fieldType: 'textarea', required: true },
        { fieldName: 'steps', fieldLabel: 'Steps to Reproduce', fieldType: 'textarea', required: true },
        { fieldName: 'expected', fieldLabel: 'Expected Behavior', fieldType: 'textarea', required: true },
        { fieldName: 'actual', fieldLabel: 'Actual Behavior', fieldType: 'textarea', required: true },
        { fieldName: 'server', fieldLabel: 'Server', fieldType: 'text', required: true },
        { fieldName: 'version', fieldLabel: 'Game Version', fieldType: 'text', required: false }
      ],
      'player': [
        { fieldName: 'description', fieldLabel: 'Describe the Incident', fieldType: 'textarea', required: true },
        { fieldName: 'serverName', fieldLabel: 'Server Name', fieldType: 'text', required: true },
        { fieldName: 'when', fieldLabel: 'When did this happen?', fieldType: 'text', required: true },
        { fieldName: 'evidence', fieldLabel: 'Evidence (screenshots, videos, etc.)', fieldType: 'textarea', required: false }
      ],
      'chat': [
        { fieldName: 'description', fieldLabel: 'Describe the Issue', fieldType: 'textarea', required: true },
        { fieldName: 'serverName', fieldLabel: 'Server Name', fieldType: 'text', required: true },
        { fieldName: 'when', fieldLabel: 'When did this happen?', fieldType: 'text', required: true },
        { fieldName: 'chatlog', fieldLabel: 'Copy & Paste Chat Log', fieldType: 'textarea', required: true }
      ],
      'staff': [
        { fieldName: 'email', fieldLabel: 'Your email', fieldType: 'text', required: true,
          helpText: 'Please monitor this as replies will be sent here.' },
        { fieldName: 'introduction', fieldLabel: 'Introduce yourself.', fieldType: 'textarea', required: true,
          helpText: 'Who are you? Tell us about your hobbies, education, environment, schedule, and world view' },
        { fieldName: 'server_perspective', fieldLabel: 'Introduce the server.', fieldType: 'textarea', required: true,
          helpText: 'From your point of view, what is the server about and why do you enjoy it?' },
        { fieldName: 'passion', fieldLabel: 'Describe in detail something you are passionate about.', fieldType: 'textarea', required: true,
          helpText: 'This does not have to be about the server and could be about literally anything, we want to hear it!' },
        { fieldName: 'additional', fieldLabel: 'Anything else?', fieldType: 'textarea', required: false,
          helpText: 'Use this space to reflect/explain on any punishments on the server, talk about past experience, or disclose other information relevant to your application.' },
        { fieldName: 'age_check', fieldLabel: 'I am 16 years of age or older', fieldType: 'checkbox', required: true },
        { fieldName: 'microphone_check', fieldLabel: 'I have a working microphone and am able to use recording software', fieldType: 'checkbox', required: true },
        { fieldName: 'english_check', fieldLabel: 'I can speak english fluently', fieldType: 'checkbox', required: true },
        { fieldName: 'interview_check', fieldLabel: 'I am willing to participate in a voice-call interview if I am chosen to move forward in the process', fieldType: 'checkbox', required: true },
        { fieldName: 'wait_check', fieldLabel: 'I understand that it may take several weeks to process this application and I agree to not open additional tickets regarding the status of my application', fieldType: 'checkbox', required: true }
      ],
      'support': [
        { fieldName: 'description', fieldLabel: 'How can we help you?', fieldType: 'textarea', required: true },
        { fieldName: 'category', fieldLabel: 'Support Category', fieldType: 'select', 
          options: ['Account Issues', 'Technical Help', 'Purchases', 'Other'],
          required: true 
        },
        { fieldName: 'priority', fieldLabel: 'Priority', fieldType: 'select', 
          options: ['Low', 'Medium', 'High'],
          required: true 
        }
      ]
    };
    
    return defaultTemplates[type] || [];
  };

  // Render form based on ticket type
  const renderTicketForm = () => {
    if (isLoadingSettings) {
      return (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading form...</p>
        </div>
      );
    }
    
    // Get form fields - attempt to fetch from settings, but fall back to defaults
    let fields = [];
    
    try {
      // Try to get fields from settings (if available)
      if (settingsData?.settings) {
        const formTemplates = settingsData.settings.get('ticketForms');
        if (formTemplates && formTemplates[ticketDetails.type]) {
          fields = formTemplates[ticketDetails.type];
        }
      }
      
      // If formTemplates processing fails or returns empty fields, check formTemplates array
      if (fields.length === 0 && settingsData?.formTemplates) {
        const template = settingsData.formTemplates.find((t: any) => t.ticketType === ticketDetails.type);
        if (template && template.fields) {
          fields = template.fields.map((f: any) => ({
            fieldName: f.id,
            fieldLabel: f.label,
            fieldType: f.type as 'text' | 'textarea' | 'select' | 'checkbox' | 'radio',
            required: f.required,
            options: f.options,
            helpText: f.helpText
          }));
        }
      }
    } catch (error) {
      console.error('Error processing form templates:', error);
    }
    
    // If no fields found in settings, use defaults
    if (fields.length === 0) {
      fields = getDefaultFormFields(ticketDetails.type);
      console.log('Using default form template for', ticketDetails.type);
    }
    
    return (
      <form onSubmit={handleFormSubmit} className="space-y-6">
        <div className="space-y-4">
          {ticketDetails.type !== 'staff' && (
            <div>
              <Label htmlFor="subject" className="font-medium">Ticket Subject</Label>
              <Input
                id="subject"
                type="text"
                placeholder="Enter a subject for your ticket"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                className="mt-1"
                required
              />
            </div>
          )}
          
          {fields.map((field: FormField) => (
            <div key={field.fieldName} className="space-y-1">

              {field.fieldType !== 'checkbox' ?
                <Label htmlFor={field.fieldName} className="font-medium">
                  {field.fieldLabel}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label> : null
              }
              
              {field.helpText && (
                <p className="text-sm text-muted-foreground mb-1">{field.helpText}</p>
              )}
              
              {field.fieldType === 'textarea' ? (
                <Textarea
                  id={field.fieldName}
                  placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
                  value={formData[field.fieldName] || ''}
                  onChange={(e) => handleFormFieldChange(field.fieldName, e.target.value)}
                  className={ticketDetails.type === 'staff' ? 
                    (field.fieldName === 'introduction' || field.fieldName === 'server_perspective' || field.fieldName === 'passion') ? 
                      "min-h-[180px]" : "min-h-[120px]" 
                    : "min-h-[120px]"}
                  required={field.required}
                />
              ) : field.fieldType === 'select' ? (
                <Select
                  value={formData[field.fieldName] || ''}
                  onValueChange={(value) => handleFormFieldChange(field.fieldName, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${field.fieldLabel.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.fieldType === 'checkbox' ? (
                <div className="flex items-start space-x-2 mt-2">
                  <Checkbox 
                    id={field.fieldName}
                    checked={formData[field.fieldName] === "true"}
                    onCheckedChange={(checked: boolean) => handleFormFieldChange(field.fieldName, checked ? "true" : "false")}
                    required={field.required}
                    className="mt-1"
                  />
                  <label 
                    htmlFor={field.fieldName}
                    className="text-sm font-normal leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {field.fieldLabel}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </label>
                </div>
              ) : (
                <Input
                  id={field.fieldName}
                  type="text"
                  placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
                  value={formData[field.fieldName] || ''}
                  onChange={(e) => handleFormFieldChange(field.fieldName, e.target.value)}
                  required={field.required}
                />
              )}
            </div>
          ))}
        </div>
        
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckSquare className="mr-2 h-4 w-4" />
                Submit Ticket
              </>
            )}
          </Button>
        </div>
      </form>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        {/* Security Disclaimer */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="text-yellow-600 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-yellow-800">Security Notice</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Do not share sensitive information, personal data, or passwords over tickets. The six digit ticket ID is the only authentication on this page; anyone with this ticket ID can view and reply to this ticket as you.
              </p>
            </div>
          </div>
        </div>
        
        {/* Check if the ticket is unfinished and needs a form */}
        {ticketDetails.status === 'Unfinished' ? (
          <Card className="mb-6">
            <CardHeader>
              {ticketDetails.type === 'staff' ? (
                <>
                  <CardTitle>Staff Application</CardTitle>
                  <CardDescription className="mt-2">
                    Thank you for your interest in becoming a volunteer moderator. Please complete the form with honesty and showcase your personality.
                  </CardDescription>
                </>
              ) : ticketDetails.type === 'bug' ? (
                <>
                  <CardTitle>Complete Your Bug Report</CardTitle>
                  <CardDescription>Please provide detailed information about the bug you've encountered</CardDescription>
                </>
              ) : ticketDetails.type === 'player' ? (
                <>
                  <CardTitle>Complete Your Player Report</CardTitle>
                  <CardDescription>Please provide details about the player and the incident</CardDescription>
                </>
              ) : ticketDetails.type === 'chat' ? (
                <>
                  <CardTitle>Complete Your Chat Report</CardTitle>
                  <CardDescription>Please provide information about the chat incident</CardDescription>
                </>
              ) : ticketDetails.type === 'support' ? (
                <>
                  <CardTitle>Complete Your Support Request</CardTitle>
                  <CardDescription>Please tell us how we can help you</CardDescription>
                </>
              ) : (
                <>
                  <CardTitle>Complete Your {ticketDetails.type.charAt(0).toUpperCase() + ticketDetails.type.slice(1)} Ticket</CardTitle>
                  <CardDescription>Please provide the required information below to submit your ticket</CardDescription>
                </>
              )}
            </CardHeader>
            <CardContent>
              {renderTicketForm()}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Regular ticket view for non-unfinished tickets */}
            <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden mb-6">
              <div className="p-4 bg-muted/30">
                <div className="flex justify-between items-start">
                  <h1 className="text-xl font-semibold">{ticketDetails.subject}</h1>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="border-border bg-background flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {ticketDetails.category}
                    </Badge>
                    <Badge className={`text-xs px-2 py-1 font-medium border ${statusColors[ticketDetails.status]}`}>
                      {ticketDetails.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    <span>Created by {ticketDetails.reportedBy}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{formatDate(ticketDetails.date)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>{ticketDetails.messages.length} messages</span>
                  </div>
                </div>
              </div>

              {/* Messages section */}
              <div className="p-4 max-h-[600px] overflow-y-auto">
                {ticketDetails.messages.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {ticketDetails.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${
                          message.senderType === 'staff' || message.staff
                            ? 'bg-primary/5 p-3 rounded-lg'
                            : message.senderType === 'system'
                            ? 'bg-muted/20 p-3 rounded-lg italic text-muted-foreground'
                            : ''
                        }`}
                      >
                        <Avatar className={message.senderType === 'system' ? 'bg-muted border-muted-foreground/20' : message.senderType === 'staff' || message.staff ? 'bg-primary/20 border-primary' : 'bg-muted border-muted-foreground/50'}>
                          <AvatarFallback>
                            {message.senderType === 'system' 
                              ? 'SYS' 
                              : message.sender 
                                ? message.sender.substring(0, 2).toUpperCase() 
                                : 'UN'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <div className="font-medium flex items-center gap-2">
                              {message.sender}
                              {(message.senderType === 'staff' || message.staff) && (
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] py-0 h-4">
                                  Staff
                                </Badge>
                              )}
                              {message.closedAs && (
                                <Badge variant="outline" className="bg-muted text-muted-foreground border-muted/50 text-[10px] py-0 h-4">
                                  {message.closedAs}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDate(message.timestamp)}
                            </div>
                          </div>
                          <div className="text-sm whitespace-pre-wrap">
                            {message.content}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No messages yet.
                  </div>
                )}
              </div>
            </div>

            {/* Reply section - only show for non-unfinished tickets */}
            {!ticketDetails.locked ? (
              <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
                <div className="p-4">
                  <div className="mb-4">
                    <Textarea
                      placeholder="Type your reply here..."
                      className="min-h-[120px]"
                      value={newReply}
                      onChange={(e) => setNewReply(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleSendReply} 
                      disabled={!newReply.trim() || !playerName.trim() || isSubmitting}
                      className="flex items-center"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Send Reply
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg p-4 text-center text-muted-foreground border border-border">
                <p>This ticket is locked and no further replies can be sent.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PlayerTicket;