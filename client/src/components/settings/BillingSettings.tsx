import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from 'modl-shared-web/components/ui/card';
import { Button } from 'modl-shared-web/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { loadStripe } from '@stripe/stripe-js';
import { useBillingStatus } from '@/hooks/use-data';
import { useQueryClient } from '@tanstack/react-query';
import { Skeleton } from 'modl-shared-web/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';

// Initialize Stripe with the publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const BillingSettings = () => {
  const { data: billingStatus, isLoading: isBillingLoading } = useBillingStatus();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');

    if (sessionId) {
      toast({
        title: 'Payment Successful!',
        description: 'Your subscription has been activated.',
        variant: 'default',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/panel/billing/status'] });
      
      // Clean up the URL by removing the session_id query parameter
      urlParams.delete('session_id');
      const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ''}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [queryClient, toast]);

  const handleCreateCheckoutSession = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/panel/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { sessionId } = await response.json();
      const stripe = await stripePromise;
      if (stripe) {
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) {
          toast({
            title: 'Error',
            description: error.message || 'Failed to redirect to Stripe Checkout.',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Could not create checkout session. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePortalSession = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/panel/billing/create-portal-session', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Could not open billing portal. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshBillingStatus = async () => {
    setIsLoading(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['/api/panel/billing/status'] });
      toast({
        title: 'Billing Status Refreshed',
        description: 'Your billing information has been updated.',
        variant: 'default',
      });
    } catch (error) {
      console.error('Error refreshing billing status:', error);
      toast({
        title: 'Error',
        description: 'Could not refresh billing status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderSubscriptionState = () => {
    if (isBillingLoading) {
      return (
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-10 w-32 mt-4" />
        </div>
      );
    }    const { subscription_status, current_period_end } = billingStatus || {};

    if (!subscription_status || ['inactive', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid'].includes(subscription_status)) {
      return (
        <div>
          <CardDescription>You do not have an active subscription. Upgrade to unlock premium features.</CardDescription>
          <Button onClick={() => handleCreateCheckoutSession()} className="mt-4" disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Upgrade to Premium'}
          </Button>
        </div>
      );
    }    if (subscription_status === 'active' || subscription_status === 'trialing') {
      return (
        <div>
          <CardDescription>You are currently on the <strong>premium</strong> plan.</CardDescription>
          <p className="text-sm text-muted-foreground mt-2">
            {current_period_end && current_period_end !== 'null' ? (
              <>
                {subscription_status === 'trialing' ? 'Your trial ends on' : 'Your subscription will renew on'} {new Date(current_period_end).toLocaleDateString()}.
              </>
            ) : (
              'Your subscription is active.'
            )}
          </p>
          <Button onClick={handleCreatePortalSession} className="mt-4" disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Manage Billing'}
          </Button>
        </div>
      );
    }

    if (subscription_status === 'canceled') {
      return (
        <div>
          <CardDescription>Your <strong>premium</strong> plan is canceled.</CardDescription>
          <p className="text-sm text-muted-foreground mt-2">
            {current_period_end && current_period_end !== 'null' ? (
              <>Your access will end on {new Date(current_period_end).toLocaleDateString()}.</>
            ) : (
              'Your subscription has been canceled.'
            )}
          </p>
          <Button onClick={() => handleCreateCheckoutSession()} className="mt-4" disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Resubscribe'}
          </Button>
        </div>
      );
    }

    // Handle other Stripe statuses that might indicate cancellation or issues
    if (['paused', 'unpaid'].includes(subscription_status)) {
      return (
        <div>
          <CardDescription>Your <strong>premium</strong> plan has an issue.</CardDescription>
          <p className="text-sm text-muted-foreground mt-2">
            Status: {subscription_status}. Please update your payment method or contact support.
          </p>
          <Button onClick={handleCreatePortalSession} className="mt-4" disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Manage Billing'}
          </Button>
        </div>
      );
    }

    return <p>Loading subscription details...</p>;
  };
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Billing</CardTitle>
            <CardDescription>Manage your subscription and billing details.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshBillingStatus}
            disabled={isLoading || isBillingLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {renderSubscriptionState()}
      </CardContent>
    </Card>
  );
};

export default BillingSettings;