import React, { useState, useEffect } from 'react';
import { Save, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

const ProfileSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [profileUsername, setProfileUsername] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (user?.username) {
      setProfileUsername(user.username);
    }
    if (user?.profilePicture) {
      setProfilePictureUrl(user.profilePicture);
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: profileUsername,
          profilePicture: profilePictureUrl
        })
      });
      
      if (response.ok) {
        toast({
          title: "Profile Updated",
          description: "Your profile information has been successfully updated."
        });
        // Refresh the page to update the user context
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }
    } catch (error) {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "There was an error updating your profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Profile Information</h3>
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={profileUsername}
                onChange={(e) => setProfileUsername(e.target.value)}
                placeholder="Enter your username"
              />
              <p className="text-sm text-muted-foreground">
                This name will appear in ticket conversations and other interactions.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="profile-picture">Profile Picture URL</Label>
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center overflow-hidden">
                  {profilePictureUrl ? (
                    <img 
                      src={profilePictureUrl} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to initials if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-full h-full rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium ${profilePictureUrl ? 'hidden' : 'flex'}`}
                  >
                    {profileUsername ? profileUsername.substring(0, 2).toUpperCase() : 'ST'}
                  </div>
                </div>
                <div className="flex-1">
                  <Input
                    id="profile-picture"
                    type="url"
                    value={profilePictureUrl}
                    onChange={(e) => setProfilePictureUrl(e.target.value)}
                    placeholder="https://example.com/your-avatar.jpg"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter a URL for your profile picture. Leave empty to use initials.
                  </p>
                </div>
              </div>
            </div>
            
            <Button
              onClick={handleSaveProfile}
              disabled={isUpdating}
            >
              <Save className="h-4 w-4 mr-2" />
              {isUpdating ? 'Saving...' : 'Save Profile Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
