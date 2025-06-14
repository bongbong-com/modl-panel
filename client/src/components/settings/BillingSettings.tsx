import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe with the publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const BillingSettings = () => {
  const { user, refreshSession } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Refresh session when component mounts to get latest subscription status
    refreshSession();
  }, []);

  const handleCreateCheckoutSession = async (priceId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
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
    // Assuming the user object from useAuth contains the subscription details
    const { plan_type, subscription_status, current_period_end } = user || {};

    if (!subscription_status || subscription_status === 'incomplete' || subscription_status === 'incomplete_expired' || subscription_status === 'past_due' || subscription_status === 'unpaid') {
      return (
        <div>
          <CardDescription>You do not have an active subscription. Upgrade to unlock premium features.</CardDescription>
          <Button onClick={() => handleCreateCheckoutSession('price_1PZd6JRxp65QJvYg5tQyZk5r')} className="mt-4" disabled={isLoading}>
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
          <Button onClick={() => handleCreateCheckoutSession('price_1PZd6JRxp65QJvYg5tQyZk5r')} className="mt-4" disabled={isLoading}>
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