import React, { useState } from 'react';
import { Button } from 'modl-shared-web/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from 'modl-shared-web/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'modl-shared-web/components/ui/select';
import { Badge } from 'modl-shared-web/components/ui/badge';
import { useToast } from 'modl-shared-web/hooks/use-toast';
import { useAvailablePlayers, useAssignMinecraftPlayer } from '@/hooks/use-data';
import { Loader2, User, X } from 'lucide-react';

interface StaffMember {
  _id: string;
  email: string;
  username: string;
  role: string;
  assignedMinecraftUuid?: string;
  assignedMinecraftUsername?: string;
}

interface AssignMinecraftPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffMember: StaffMember | null;
}

const AssignMinecraftPlayerModal: React.FC<AssignMinecraftPlayerModalProps> = ({
  isOpen,
  onClose,
  staffMember
}) => {
  const [selectedPlayerUuid, setSelectedPlayerUuid] = useState<string>('');
  const { toast } = useToast();
  
  const { data: playersData, isLoading: playersLoading } = useAvailablePlayers();
  const assignPlayerMutation = useAssignMinecraftPlayer();

  const availablePlayers = playersData?.players || [];

  const handleAssign = async () => {
    if (!staffMember) return;

    if (!selectedPlayerUuid) {
      toast({
        title: 'No Player Selected',
        description: 'Please select a Minecraft player to assign.',
        variant: 'destructive'
      });
      return;
    }

    const selectedPlayer = availablePlayers.find((p: any) => p.uuid === selectedPlayerUuid);
    if (!selectedPlayer) return;

    try {
      await assignPlayerMutation.mutateAsync({
        username: staffMember.username,
        minecraftUuid: selectedPlayer.uuid,
        minecraftUsername: selectedPlayer.username
      });

      toast({
        title: 'Player Assigned',
        description: `${selectedPlayer.username} has been assigned to ${staffMember.username}.`
      });

      onClose();
      setSelectedPlayerUuid('');
    } catch (error) {
      toast({
        title: 'Assignment Failed',
        description: error instanceof Error ? error.message : 'Failed to assign player',
        variant: 'destructive'
      });
    }
  };

  const handleClearAssignment = async () => {
    if (!staffMember) return;

    try {
      await assignPlayerMutation.mutateAsync({
        username: staffMember.username,
        minecraftUuid: undefined,
        minecraftUsername: undefined
      });

      toast({
        title: 'Assignment Cleared',
        description: `Minecraft player assignment cleared for ${staffMember.username}.`
      });

      onClose();
    } catch (error) {
      toast({
        title: 'Clear Failed',
        description: error instanceof Error ? error.message : 'Failed to clear assignment',
        variant: 'destructive'
      });
    }
  };

  const handleClose = () => {
    setSelectedPlayerUuid('');
    onClose();
  };

  if (!staffMember) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Minecraft Player</DialogTitle>
          <DialogDescription>
            Assign a Minecraft player to <strong>{staffMember.email}</strong> ({staffMember.role})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Assignment */}
          {staffMember.assignedMinecraftUuid && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="text-sm font-medium">Currently Assigned:</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAssignment}
                  disabled={assignPlayerMutation.isPending}
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="mt-1">
                <Badge variant="secondary">
                  {staffMember.assignedMinecraftUsername}
                </Badge>
              </div>
            </div>
          )}

          {/* Player Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Minecraft Player</label>
            {playersLoading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading available players...</span>
              </div>
            ) : availablePlayers.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No available players found. All players may already be assigned to staff members.
              </div>
            ) : (
              <Select value={selectedPlayerUuid} onValueChange={setSelectedPlayerUuid}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a player..." />
                </SelectTrigger>
                <SelectContent>
                  {availablePlayers.map((player: any) => (
                    <SelectItem key={player.uuid} value={player.uuid}>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-500 rounded-sm" />
                        {player.username}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            Only Minecraft players that are not currently assigned to other staff members are shown.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={assignPlayerMutation.isPending}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign} 
            disabled={!selectedPlayerUuid || assignPlayerMutation.isPending || availablePlayers.length === 0}
          >
            {assignPlayerMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              'Assign Player'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignMinecraftPlayerModal;