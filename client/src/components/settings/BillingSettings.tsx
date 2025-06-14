import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { loadStripe } from '@stripe/stripe-js';
import { useBillingStatus } from '@/hooks/use-data';
import { Skeleton } from '@/components/ui/skeleton';

// Initialize Stripe with the publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const BillingSettings = () => {
  const { data: billingStatus, isLoading: isBillingLoading } = useBillingStatus();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateCheckoutSession = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/billing/create-checkout-session', {
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
      const response = await fetch('/api/billing/create-portal-session', {
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

  const renderSubscriptionState = () => {
    if (isBillingLoading) {
      return (
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-10 w-32 mt-4" />
        </div>
      );
    }

    const { subscription_status, current_period_end } = billingStatus || {};

    if (!subscription_status || ['inactive', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid'].includes(subscription_status)) {
      return (
        <div>
          <CardDescription>You do not have an active subscription. Upgrade to unlock premium features.</CardDescription>
          <Button onClick={() => handleCreateCheckoutSession()} className="mt-4" disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Upgrade to Premium'}
          </Button>
        </div>
      );
    }

    if (subscription_status === 'active' || subscription_status === 'trialing') {
      return (
        <div>
          <CardDescription>You are currently on the <strong>premium</strong> plan.</CardDescription>
          <p className="text-sm text-muted-foreground mt-2">
            {subscription_status === 'trialing' ? 'Your trial ends on' : 'Your subscription will renew on'} {new Date(current_period_end).toLocaleDateString()}.
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
            Your access will end on {new Date(current_period_end).toLocaleDateString()}.
          </p>
          <Button onClick={() => handleCreateCheckoutSession()} className="mt-4" disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Resubscribe'}
          </Button>
        </div>
      );
    }

    return <p>Loading subscription details...</p>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>Manage your subscription and billing details.</CardDescription>
      </CardHeader>
      <CardContent>
        {renderSubscriptionState()}
      </CardContent>
    </Card>
  );
};

export default BillingSettings;