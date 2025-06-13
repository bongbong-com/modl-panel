import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
  } from "@/components/ui/dialog";
  import { Button } from "@/components/ui/button";
  
  interface WelcomeModalProps {
    isOpen: boolean;
    onClose: () => void;
  }
  
  export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Welcome to modl-panel!</DialogTitle>
            <DialogDescription>
              It looks like this is your first time here. Here are some tips to get you started.
            </DialogDescription>
          </DialogHeader>
          <div>
            <p>This is where the welcome message and quick start guide will go.</p>
          </div>
          <DialogFooter>
            <Button onClick={onClose}>Got it!</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }