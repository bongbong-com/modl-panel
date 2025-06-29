import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from 'modl-shared-web/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'modl-shared-web/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'modl-shared-web/components/ui/form';
import { Input } from 'modl-shared-web/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'modl-shared-web/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

const inviteSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  role: z.enum(['Admin', 'Moderator', 'Helper']),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface InviteStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteSent: () => void;
}

const InviteStaffModal: React.FC<InviteStaffModalProps> = ({ isOpen, onClose, onInviteSent }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'Helper',
    },
  });

  const onSubmit = async (values: InviteFormValues) => {
    try {
      const response = await fetch('/api/panel/staff/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send invitation.');
      }

      toast({
        title: 'Success',
        description: 'Invitation sent successfully.',
      });
      onInviteSent();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite New Staff Member</DialogTitle>
          <DialogDescription>
            Enter the email address and select a role for the new staff member.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="name@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {user?.role === 'Super Admin' && <SelectItem value="Admin">Admin</SelectItem>}
                      <SelectItem value="Moderator">Moderator</SelectItem>
                      <SelectItem value="Helper">Helper</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Send Invitation</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default InviteStaffModal;