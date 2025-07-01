import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from 'modl-shared-web/components/ui/card';
import { Button } from 'modl-shared-web/components/ui/button';
import { Badge } from 'modl-shared-web/components/ui/badge';
import { useToast } from 'modl-shared-web/hooks/use-toast';
import { loadStripe } from '@stripe/stripe-js';
import { useBillingStatus } from '@/hooks/use-data';
import { useQueryClient } from '@tanstack/react-query';
import { Skeleton } from 'modl-shared-web/components/ui/skeleton';
import { 
  RefreshCw, 
  Check, 
  Crown, 
  Zap, 
  Shield, 
  Users, 
  HardDrive,
  Headphones,
  Brain,
  Calendar,
  DollarSign,
  AlertTriangle
} from 'lucide-react';
import { Alert, AlertDescription } from 'modl-shared-web/components/ui/alert';

// Initialize Stripe with the publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface PlanFeature {
  text: string;
  included: boolean;
  icon?: React.ReactNode;
}

interface Plan {
  id: 'free' | 'premium';
  name: string;
  price: number;
  period: string;
  description: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  features: PlanFeature[];
  buttonText: string;
  buttonVariant: 'default' | 'outline';
  popular?: boolean;
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'forever',
    description: 'Perfect for small communities getting started',
    features: [
      { text: 'Up to 50 players', included: true, icon: <Users className="h-4 w-4" /> },
      { text: 'Basic ticket system', included: true, icon: <Shield className="h-4 w-4" /> },
      { text: '1GB storage', included: true, icon: <HardDrive className="h-4 w-4" /> },
      { text: 'Community support', included: true, icon: <Headphones className="h-4 w-4" /> },
      { text: 'AI moderation', included: false, icon: <Brain className="h-4 w-4" /> },
      { text: 'Priority support', included: false, icon: <Zap className="h-4 w-4" /> },
      { text: 'Custom domain', included: false, icon: <Crown className="h-4 w-4" /> }
    ],
    buttonText: 'Current Plan',
    buttonVariant: 'outline'
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 19.99,
    period: 'per month',
    description: 'For growing communities that need advanced features',
    badge: 'Most Popular',
    badgeVariant: 'default',
    features: [
      { text: 'Unlimited players', included: true, icon: <Users className="h-4 w-4" /> },
      { text: 'Advanced ticket system', included: true, icon: <Shield className="h-4 w-4" /> },
      { text: '10GB storage', included: true, icon: <HardDrive className="h-4 w-4" /> },
      { text: 'Priority support', included: true, icon: <Headphones className="h-4 w-4" /> },
      { text: 'AI moderation', included: true, icon: <Brain className="h-4 w-4" /> },
      { text: 'Custom domain', included: true, icon: <Crown className="h-4 w-4" /> },
      { text: 'Advanced analytics', included: true, icon: <Zap className="h-4 w-4" /> }
    ],
    buttonText: 'Upgrade Now',
    buttonVariant: 'default',
    popular: true
  }
];

const BillingSettings = () => {
  const { data: billingStatus, isLoading: isBillingLoading } = useBillingStatus();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
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
    setIsSpinning(true);
    
    try {
      // Ensure minimum spin duration of 800ms
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/panel/billing/status'] }),
        new Promise(resolve => setTimeout(resolve, 800))
      ]);
      
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
      setIsSpinning(false);
    }
  };

  const getCurrentPlan = () => {
    if (!billingStatus) return 'free';
    const { subscription_status } = billingStatus;
    
    if (['active', 'trialing', 'canceled'].includes(subscription_status)) {
      return 'premium';
    }
    return 'free';
  };

  const isCurrentPlan = (planId: string) => {
    return getCurrentPlan() === planId;
  };

  const getSubscriptionAlert = () => {
    if (isBillingLoading || !billingStatus) return null;

    const { subscription_status, current_period_end } = billingStatus;

    // Special handling for cancelled subscriptions that haven't ended yet
    if (subscription_status === 'canceled' && current_period_end) {
      const endDate = new Date(current_period_end);
      const today = new Date();
      
      if (endDate > today) {
        return (
          <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              <strong>Subscription Cancelled:</strong> Your premium access will end on{' '}
              <strong>{endDate.toLocaleDateString()}</strong>. You can still use all premium features until then.
            </AlertDescription>
          </Alert>
        );
      }
    }

    // Handle other problematic statuses
    if (['past_due', 'unpaid'].includes(subscription_status)) {
      return (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Payment Issue:</strong> There's an issue with your payment method. Please update it to continue using premium features.
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  };

  const getNextBillingInfo = () => {
    if (isBillingLoading || !billingStatus) return null;

    const { subscription_status, current_period_end } = billingStatus;

    if (!['active', 'trialing'].includes(subscription_status) || !current_period_end) {
      return null;
    }

    const renewalDate = new Date(current_period_end);
    const isTrialing = subscription_status === 'trialing';

    return (
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              {isTrialing ? <Calendar className="h-5 w-5 text-blue-600" /> : <DollarSign className="h-5 w-5 text-blue-600" />}
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                {isTrialing ? 'Trial Ends' : 'Next Billing'}
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {isTrialing ? 'Your trial ends on' : '$19.99 will be charged on'}{' '}
                <strong>{renewalDate.toLocaleDateString()}</strong>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const PlanCard: React.FC<{ plan: Plan }> = ({ plan }) => {
    const isCurrent = isCurrentPlan(plan.id);
    const canUpgrade = plan.id === 'premium' && getCurrentPlan() === 'free';
    
    return (
      <Card className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''} ${isCurrent ? 'ring-2 ring-primary' : ''}`}>
        {plan.badge && (
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <Badge variant={plan.badgeVariant}>{plan.badge}</Badge>
          </div>
        )}
        {isCurrent && (
          <div className="absolute -top-3 right-4">
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
              <Check className="h-3 w-3 mr-1" />
              Current Plan
            </Badge>
          </div>
        )}
        
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl">{plan.name}</CardTitle>
          <div className="text-3xl font-bold">
            ${plan.price}
            <span className="text-sm font-normal text-muted-foreground">/{plan.period}</span>
          </div>
          <CardDescription>{plan.description}</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {plan.features.map((feature, index) => (
              <div key={index} className={`flex items-center gap-3 ${!feature.included ? 'opacity-50' : ''}`}>
                {feature.included ? (
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                ) : (
                  <div className="h-4 w-4 flex-shrink-0" />
                )}
                {feature.icon && (
                  <div className={feature.included ? 'text-foreground' : 'text-muted-foreground'}>
                    {feature.icon}
                  </div>
                )}
                <span className={`text-sm ${feature.included ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                  {feature.text}
                </span>
              </div>
            ))}
          </div>
          
          <div className="pt-4">
            {isCurrent ? (
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleCreatePortalSession}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Manage Billing'}
              </Button>
            ) : canUpgrade ? (
              <Button 
                variant={plan.buttonVariant} 
                className="w-full" 
                onClick={handleCreateCheckoutSession}
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : plan.buttonText}
              </Button>
            ) : (
              <Button variant="outline" className="w-full" disabled>
                {plan.buttonText}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isBillingLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold mb-2">Billing & Subscription</h2>
          <p className="text-muted-foreground">Manage your subscription and billing details.</p>
        </div>
        
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Billing & Subscription</h2>
          <p className="text-muted-foreground">Manage your subscription and billing details.</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={handleRefreshBillingStatus}
          disabled={isSpinning || isBillingLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isSpinning ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Subscription Alert */}
      {getSubscriptionAlert()}

      {/* Next Billing Info */}
      {getNextBillingInfo()}

      {/* Plan Comparison */}
      <div>
        <h3 className="text-xl font-semibold mb-6">Choose Your Plan</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default BillingSettings;