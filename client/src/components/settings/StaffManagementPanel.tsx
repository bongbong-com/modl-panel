import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Button } from 'modl-shared-web/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'modl-shared-web/components/ui/card';
import ChangeRoleModal from './ChangeRoleModal'; // Import the new modal
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from 'modl-shared-web/components/ui/table';
import { useStaff } from '@/hooks/use-data';
import { Skeleton } from 'modl-shared-web/components/ui/skeleton';
import { MoreHorizontal, Plus, PlusIcon, RefreshCw } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from 'modl-shared-web/components/ui/dropdown-menu';
import InviteStaffModal from './InviteStaffModal';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from 'modl-shared-web/components/ui/alert-dialog';

interface StaffMember {
  _id: string;
  email: string;
  role: 'Super Admin' | 'Admin' | 'Moderator' | 'Helper';
  createdAt: string;
  status: string;
}

const StaffManagementPanel = () => {
  const { data: staff, isLoading, error } = useStaff();
  const { user: currentUser } = useAuth();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isRemoveAlertOpen, setIsRemoveAlertOpen] = useState(false);
  const [isChangeRoleModalOpen, setIsChangeRoleModalOpen] = useState(false);
  const [selectedStaffMember, setSelectedStaffMember] = useState<StaffMember | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleInviteSent = () => {
    queryClient.invalidateQueries({ queryKey: ['staff'] });
  };

  const openConfirmationDialog = (member: StaffMember) => {
    setSelectedStaffMember(member);
    setIsRemoveAlertOpen(true);
  };

  const openChangeRoleModal = (member: StaffMember) => {
    setSelectedStaffMember(member);
    setIsChangeRoleModalOpen(true);
  };

  const handleRemove = async () => {
    if (!selectedStaffMember) return;

    try {
      const response = await fetch(`/api/staff/${selectedStaffMember._id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove staff member');
      }

      queryClient.invalidateQueries({ queryKey: ['staff'] });
    } catch (error) {
      console.error(error);
    } finally {
      setIsRemoveAlertOpen(false);
      setSelectedStaffMember(null);
    }
  };

  const handleResendInvitation = async (staffId: string) => {
    try {
      const response = await fetch(`/api/staff/invitations/${staffId}/resend`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to resend invitation' }));
        throw new Error(errorData.message);
      }
      toast({
        title: 'Success',
        description: 'Invitation resent successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Staff Management</CardTitle>
            <div className="flex space-x-2">
              <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ['staff'] })}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button onClick={() => setIsInviteModalOpen(true)}>Invite</Button>
            </div>
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
                    <TableCell>{member.createdAt ? new Date(member.createdAt).toLocaleDateString() : 'N/A'}</TableCell>
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
                            <>
                              {currentUser && (currentUser.role === 'Super Admin' || (currentUser.role === 'Admin' && (member.role === 'Moderator' || member.role === 'Helper'))) && (
                                <DropdownMenuItem onSelect={() => openChangeRoleModal(member)}>
                                  Change Role
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onSelect={() => openConfirmationDialog(member)}>
                                Remove Staff Member
                              </DropdownMenuItem>
                            </>
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
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onInviteSent={handleInviteSent}
      />
      <ChangeRoleModal
        isOpen={isChangeRoleModalOpen}
        onClose={() => {
          setIsChangeRoleModalOpen(false);
          setSelectedStaffMember(null);
        }}
        staffMember={selectedStaffMember}
      />
      <AlertDialog open={isRemoveAlertOpen} onOpenChange={setIsRemoveAlertOpen}>
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