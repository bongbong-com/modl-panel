import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from 'modl-shared-web/components/ui/card';
import { Badge } from 'modl-shared-web/components/ui/badge';
import { Button } from 'modl-shared-web/components/ui/button';
import { Shield, Clock, User, AlertTriangle } from 'lucide-react';
import { usePlayerWindow } from '@/contexts/PlayerWindowContext';

export interface RecentPunishment {
  id: string;
  type: 'ban' | 'kick' | 'mute' | 'warn' | 'tempban';
  playerName: string;
  playerUuid: string;
  reason: string;
  duration?: string;
  issuedBy: string;
  issuedAt: string;
  active: boolean;
}

interface RecentPunishmentsSectionProps {
  punishments: RecentPunishment[];
  loading: boolean;
}

const punishmentColors = {
  ban: 'bg-red-500/20 text-red-500',
  tempban: 'bg-orange-500/20 text-orange-500',
  kick: 'bg-yellow-500/20 text-yellow-500',
  mute: 'bg-blue-500/20 text-blue-500',
  warn: 'bg-purple-500/20 text-purple-500'
};

const punishmentIcons = {
  ban: '🔨',
  tempban: '⏰',
  kick: '👢',
  mute: '🔇',
  warn: '⚠️'
};

export function RecentPunishmentsSection({ punishments, loading }: RecentPunishmentsSectionProps) {
  const { openPlayerWindow } = usePlayerWindow();

  const handlePlayerClick = (playerUuid: string) => {
    openPlayerWindow(playerUuid);
  };

  const truncateReason = (reason: string, maxLength: number = 80) => {
    if (reason.length <= maxLength) return reason;
    return reason.substring(0, maxLength) + '...';
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const formatDuration = (duration?: string) => {
    if (!duration) return 'Permanent';
    
    // Parse duration like "30d", "2h", "1w"
    const match = duration.match(/^(\d+)([dhm])$/);
    if (!match) return duration;
    
    const [, amount, unit] = match;
    const unitNames = { d: 'day', h: 'hour', m: 'minute' };
    const unitName = unitNames[unit as keyof typeof unitNames];
    
    return `${amount} ${unitName}${parseInt(amount) > 1 ? 's' : ''}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Recently Issued Punishments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-3 border border-border rounded-lg">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-2/3 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-full mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Recently Issued Punishments
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {punishments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No recent punishments to display
            </div>
          ) : (
            punishments.map((punishment) => (
              <div
                key={punishment.id}
                className="p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{punishmentIcons[punishment.type]}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${punishmentColors[punishment.type]}`}
                        >
                          {punishment.type.toUpperCase()}
                        </Badge>
                        {!punishment.active && (
                          <Badge variant="outline" className="text-xs">
                            EXPIRED
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatTimeAgo(punishment.issuedAt)}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    variant="link"
                    className="p-0 h-auto font-medium text-sm"
                    onClick={() => handlePlayerClick(punishment.playerUuid)}
                  >
                    {punishment.playerName}
                  </Button>
                  {punishment.duration && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatDuration(punishment.duration)}</span>
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground mb-2">
                  <span className="font-medium">Reason:</span> {truncateReason(punishment.reason)}
                </p>
                
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>Issued by {punishment.issuedBy}</span>
                  </div>
                  {punishment.active && (
                    <div className="flex items-center gap-1 text-red-500">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Active</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        {punishments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => window.location.href = '/panel/punishments'}
            >
              View All Punishments
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}