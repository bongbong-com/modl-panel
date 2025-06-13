import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStaff } from '@/hooks/use-data';
import { Skeleton } from '@/components/ui/skeleton';
import { MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import InviteStaffModal from './InviteStaffModal';

interface StaffMember {
  _id: string;
  email: string;
  role: 'Super Admin' | 'Admin' | 'Moderator' | 'Helper';
  createdAt: string;
}

const StaffManagementPanel = () => {
  const { data: staff, isLoading, error } = useStaff();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleInviteSent = () => {
    queryClient.invalidateQueries('staff');
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
                  <TableCell>Active</TableCell> {/* Placeholder */}
                  <TableCell>{new Date(member.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Remove Staff Member</DropdownMenuItem>
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
    </>
  );
};

export default StaffManagementPanel;