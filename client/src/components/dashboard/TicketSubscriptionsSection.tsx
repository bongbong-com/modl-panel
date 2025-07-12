import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from 'modl-shared-web/components/ui/card';
import { Badge } from 'modl-shared-web/components/ui/badge';
import { Button } from 'modl-shared-web/components/ui/button';
import { Bell, Clock, User, MessageSquare, X } from 'lucide-react';
import { useLocation } from 'wouter';
import { useToast } from 'modl-shared-web/hooks/use-toast';

export interface TicketSubscriptionUpdate {
  id: string;
  ticketId: string;
  ticketTitle: string;
  replyContent: string;
  replyBy: string;
  replyAt: string;
  isStaffReply: boolean;
  isRead: boolean;
}

export interface TicketSubscription {
  ticketId: string;
  ticketTitle: string;
  subscribedAt: string;
}

interface TicketSubscriptionsSectionProps {
  updates: TicketSubscriptionUpdate[];
  subscriptions: TicketSubscription[];
  loading: boolean;
  onUnsubscribe: (ticketId: string) => Promise<void>;
  onMarkAsRead: (updateId: string) => Promise<void>;
}

export function TicketSubscriptionsSection({ 
  updates, 
  subscriptions, 
  loading, 
  onUnsubscribe, 
  onMarkAsRead 
}: TicketSubscriptionsSectionProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleTicketClick = (ticketId: string) => {
    setLocation(`/panel/tickets/${ticketId}`);
  };

  const handleUnsubscribe = async (ticketId: string, ticketTitle: string) => {
    try {
      await onUnsubscribe(ticketId);
      toast({
        title: "Unsubscribed",
        description: `You've been unsubscribed from "${ticketTitle}"`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to unsubscribe from ticket",
        variant: "destructive",
      });
    }
  };

  const handleMarkAsRead = async (updateId: string) => {
    try {
      await onMarkAsRead(updateId);
    } catch (error) {
      console.error('Error marking update as read:', error);
    }
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Ticket Subscription Updates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-3 border border-border rounded-lg">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-full mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const unreadUpdates = updates.filter(update => !update.isRead);
  const hasUnreadUpdates = unreadUpdates.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Ticket Subscription Updates
            {hasUnreadUpdates && (
              <Badge variant="destructive" className="text-xs">
                {unreadUpdates.length} new
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Recent Updates */}
          <div>
            <h4 className="text-sm font-medium mb-3">Recent Replies</h4>
            <div className="space-y-3">
              {updates.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No recent updates to your subscribed tickets
                </div>
              ) : (
                updates.slice(0, 5).map((update) => (
                  <div
                    key={update.id}
                    className={`p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer ${
                      !update.isRead ? 'bg-blue-500/5 border-blue-500/20' : ''
                    }`}
                    onClick={() => {
                      handleTicketClick(update.ticketId);
                      if (!update.isRead) {
                        handleMarkAsRead(update.id);
                      }
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="font-medium text-sm line-clamp-1">
                        {update.ticketTitle}
                      </h5>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        {!update.isRead && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${
                            update.isStaffReply 
                              ? 'bg-green-500/20 text-green-500' 
                              : 'bg-blue-500/20 text-blue-500'
                          }`}
                        >
                          {update.isStaffReply ? 'STAFF' : 'PLAYER'}
                        </Badge>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {truncateContent(update.replyContent)}
                    </p>
                    
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{update.replyBy}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimeAgo(update.replyAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>Reply</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Subscriptions */}
          {subscriptions.length > 0 && (
            <>
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-medium mb-3">Active Subscriptions ({subscriptions.length})</h4>
                <div className="space-y-2">
                  {subscriptions.slice(0, 3).map((subscription) => (
                    <div
                      key={subscription.ticketId}
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {subscription.ticketTitle}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Subscribed {formatTimeAgo(subscription.subscribedAt)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleUnsubscribe(subscription.ticketId, subscription.ticketTitle)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {subscriptions.length > 3 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      And {subscriptions.length - 3} more...
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}