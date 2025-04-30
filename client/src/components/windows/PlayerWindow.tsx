import { useState, useEffect } from 'react';
import { Eye, TriangleAlert, Ban, RefreshCcw, Search, LockOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ResizableWindow from '@/components/layout/ResizableWindow';
import { recentLookups } from '@/data/mockData';

import { WindowPosition } from '@/lib/types';

interface PlayerWindowProps {
  playerId: string;
  isOpen: boolean;
  onClose: () => void;
  initialPosition?: WindowPosition;
}

const PlayerWindow = ({ playerId, isOpen, onClose, initialPosition }: PlayerWindowProps) => {
  const [playerInfo, setPlayerInfo] = useState({
    username: 'DragonSlayer123',
    status: 'Online',
    vip: true,
    level: 42,
    uuid: '12a3b456-7c89...',
    firstJoined: '2023-01-15',
    lastOnline: '2 hours ago',
    playtime: '342 hours',
    ip: '192.168.x.x',
    previousNames: 'Dragon55, SlayerXD',
    warnings: [
      { type: 'Warning', reason: 'Excessive caps in chat', date: '2023-04-12', by: 'Moderator2' },
      { type: 'Mute', reason: 'Inappropriate language in global chat', date: '2023-03-28', by: 'ServerAI (30 minutes)' },
    ]
  });

  useEffect(() => {
    if (playerId && isOpen) {
      // In a real app, fetch player data using the playerId
      console.log('Fetching data for player:', playerId);
      
      // Find the player in our mock data
      const player = recentLookups.find(p => p.uuid === playerId);
      if (player) {
        setPlayerInfo(prev => ({
          ...prev,
          username: player.username,
          uuid: player.uuid,
          lastOnline: player.lastOnline,
          status: player.status === 'Active' ? 'Online' : player.status
        }));
      }
    }
  }, [playerId, isOpen]);

  return (
    <ResizableWindow
      id={`player-${playerId}`} // Unique ID per player
      title={playerInfo.username} // Show username in title/tab when minimized
      isOpen={isOpen}
      onClose={onClose}
      initialPosition={initialPosition}
      initialSize={{ width: 650, height: 550 }}
    >
      <div className="space-y-4">
        <div className="pt-2">
          <div className="bg-background-lighter p-4 rounded-lg">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">{playerInfo.username.substring(0, 2)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="text-lg font-medium">{playerInfo.username}</h5>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                    {playerInfo.status}
                  </Badge>
                  {playerInfo.vip && (
                    <Badge variant="outline" className="bg-info/10 text-info border-info/20">
                      VIP
                    </Badge>
                  )}
                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                    Level {playerInfo.level}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">UUID:</span>
                    <span className="ml-1">{playerInfo.uuid}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">First Joined:</span>
                    <span className="ml-1">{playerInfo.firstJoined}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Online:</span>
                    <span className="ml-1">{playerInfo.lastOnline}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Playtime:</span>
                    <span className="ml-1">{playerInfo.playtime}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">IP (masked):</span>
                    <span className="ml-1">{playerInfo.ip}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Previous Names:</span>
                    <span className="ml-1">{playerInfo.previousNames}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <h4 className="font-medium">Moderation History</h4>
          {playerInfo.warnings.map((warning, index) => (
            <div 
              key={index} 
              className="bg-warning/10 border-l-4 border-warning p-3 rounded-r-lg"
            >
              <div className="flex justify-between items-start">
                <div>
                  <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                    {warning.type}
                  </Badge>
                  <p className="text-sm mt-1">{warning.reason}</p>
                </div>
                <span className="text-xs text-muted-foreground">{warning.date}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">By: {warning.by}</p>
            </div>
          ))}
        </div>
        
        <div className="pt-4 flex justify-end space-x-2">
          <Button variant="destructive" size="sm">
            <Ban className="h-4 w-4 mr-1" /> Ban Player
          </Button>
          <Button variant="default" size="sm" className="bg-warning text-white hover:bg-warning/90">
            <TriangleAlert className="h-4 w-4 mr-1" /> Warn
          </Button>
          <Button variant="default" size="sm" className="bg-info text-white hover:bg-info/90">
            <RefreshCcw className="h-4 w-4 mr-1" /> Mute
          </Button>
        </div>
      </div>
    </ResizableWindow>
  );
};

export default PlayerWindow;