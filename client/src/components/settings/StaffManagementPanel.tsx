import React, { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStaff } from '@/hooks/use-data';
import { Skeleton } from '@/components/ui/skeleton';
import { MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import InviteStaffModal from './InviteStaffModal';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface StaffMember {
  _id: string;
  email: string;
  role: 'Super Admin' | 'Admin' | 'Moderator' | 'Helper';
  createdAt: string;
  status: string;
}

const StaffManagementPanel = () => {
  const { data: staff, isLoading, error } = useStaff();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedStaffMember, setSelectedStaffMember] = useState<StaffMember | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleInviteSent = () => {
    queryClient.invalidateQueries({ queryKey: ['staff'] });
  };

  const { mutate: removeStaff } = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/staff/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Success', description: 'Staff member has been removed.' });
      setIsAlertOpen(false);
      setSelectedStaffMember(null);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to remove staff member.', variant: 'destructive' });
      setIsAlertOpen(false);
      setSelectedStaffMember(null);
    }
  });

  const { mutate: resendInvitation } = useMutation({
      mutationFn: (staffId: string) => axios.post(`/api/staff/invitations/${staffId}/resend`),
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['staff'] });
          toast({
              title: 'Success',
              description: 'Invitation resent successfully.',
          });
      },
      onError: (error: any) => {
          toast({
              title: 'Error',
              description: error?.response?.data?.message || 'Failed to resend invitation.',
              variant: 'destructive',
          });
      },
  });

  const openConfirmationDialog = (member: StaffMember) => {
    setSelectedStaffMember(member);
    setIsAlertOpen(true);
  };

  const handleRemove = () => {
    if (!selectedStaffMember) return;
    removeStaff(selectedStaffMember._id);
  };

  const handleResendInvitation = (staffId: string) => {
    resendInvitation(staffId);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Staff Management</CardTitle>
            <Button onClick={() => setIsModalOpen(true)}>Invite New Staff Member</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
            <div className="text-center text-red-500">Failed to load staff members.</div>
          ) : staff && staff.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member: StaffMember) => (
                  <TableRow key={member._id}>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>{member.role}</TableCell>
                    <TableCell>{member.status}</TableCell>
                    <TableCell>{member.createdAt}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {member.status === 'Pending Invitation' ? (
                            <>
                              <DropdownMenuItem onSelect={() => handleResendInvitation(member._id)}>
                                Resend Invitation
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => openConfirmationDialog(member)}>
                                Cancel Invitation
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem onSelect={() => openConfirmationDialog(member)}>
                              Remove Staff Member
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-gray-500">No staff members found.</div>
          )}
        </CardContent>
      </Card>
      <InviteStaffModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onInviteSent={handleInviteSent}
      />
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedStaffMember?.status === 'Pending Invitation'
                ? `Are you sure you want to cancel the invitation for ${selectedStaffMember?.email}?`
                : `Are you sure you want to remove ${selectedStaffMember?.email}? This will revoke all their access immediately and cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedStaffMember(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>
              {selectedStaffMember?.status === 'Pending Invitation' ? 'Confirm' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default StaffManagementPanel;