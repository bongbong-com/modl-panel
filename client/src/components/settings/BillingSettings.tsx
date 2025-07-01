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
  AlertTriangle,
  CreditCard,
  Settings,
  CheckCircle,
  Clock
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
  features: PlanFeature[];
  buttonText: string;
  buttonVariant: 'default' | 'outline';
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
      { text: 'Up to 5 staff members', included: true, icon: <Users className="h-4 w-4" /> },
      { text: '100k API requests per month', included: true, icon: <Zap className="h-4 w-4" /> },
      { text: 'Community support', included: true, icon: <Headphones className="h-4 w-4" /> },
      { text: 'CDN storage', included: false, icon: <HardDrive className="h-4 w-4" /> },
      { text: 'AI moderation', included: false, icon: <Brain className="h-4 w-4" /> }
    ],
    buttonText: 'Current Plan',
    buttonVariant: 'outline'
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 20,
    period: 'per month',
    description: 'For growing communities that need advanced features',
    features: [
      { text: 'Unlimited players', included: true, icon: <Users className="h-4 w-4" /> },
      { text: 'Advanced ticket system', included: true, icon: <Shield className="h-4 w-4" /> },
      { text: 'Unlimited staff members', included: true, icon: <Users className="h-4 w-4" /> },
      { text: '500k API requests per month', included: true, icon: <Zap className="h-4 w-4" /> },
      { text: 'CDN storage', included: true, icon: <HardDrive className="h-4 w-4" /> },
      { text: 'AI moderation', included: true, icon: <Brain className="h-4 w-4" /> },
      { text: 'Priority support', included: true, icon: <Crown className="h-4 w-4" /> }
    ],
    buttonText: 'Upgrade Now',
    buttonVariant: 'default'
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

  const isPremiumUser = () => {
    return getCurrentPlan() === 'premium';
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

  const getSubscriptionStatusBadge = () => {
    if (!billingStatus) return null;
    
    const { subscription_status } = billingStatus;
    
    switch (subscription_status) {
      case 'active':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'trialing':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"><Clock className="h-3 w-3 mr-1" />Trial</Badge>;
      case 'canceled':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100"><AlertTriangle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      case 'past_due':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Past Due</Badge>;
      default:
        return <Badge variant="outline">{subscription_status}</Badge>;
    }
  };

  const PlanCard: React.FC<{ plan: Plan }> = ({ plan }) => {
    const isCurrent = getCurrentPlan() === plan.id;
    const canUpgrade = plan.id === 'premium' && getCurrentPlan() === 'free';
    
    return (
      <Card className={`relative ${isCurrent && plan.id === 'premium' ? 'ring-2 ring-primary' : ''}`}>
        {isCurrent && plan.id === 'premium' && (
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
              <Button variant="outline" className="w-full" disabled>
                {plan.buttonText}
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

  const PremiumBillingView = () => {
    const { subscription_status, current_period_end } = billingStatus || {};
    
    return (
      <div className="space-y-6">
        {/* Current Subscription Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-600" />
                  Premium Subscription
                </CardTitle>
                <CardDescription>You're currently on the Premium plan</CardDescription>
              </div>
              {getSubscriptionStatusBadge()}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Plan Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Plan:</span>
                      <span className="font-medium">Premium</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Price:</span>
                      <span className="font-medium">$20/month</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className="font-medium capitalize">{subscription_status}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Billing Information</h4>
                  <div className="space-y-2">
                    {current_period_end && (
                      <div className="flex justify-between">
                        <span>{subscription_status === 'trialing' ? 'Trial ends:' : subscription_status === 'canceled' ? 'Access ends:' : 'Next billing:'}</span>
                        <span className="font-medium">{new Date(current_period_end).toLocaleDateString()}</span>
                      </div>
                    )}
                    {subscription_status === 'active' && (
                      <div className="flex justify-between">
                        <span>Next charge:</span>
                        <span className="font-medium">$20</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button 
                onClick={handleCreatePortalSession}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <CreditCard className="h-4 w-4" />
                {isLoading ? 'Loading...' : 'Manage Billing'}
              </Button>
              
              {subscription_status === 'canceled' && (
                <Button 
                  variant="outline"
                  onClick={handleCreateCheckoutSession}
                  disabled={isLoading}
                >
                  {isLoading ? 'Processing...' : 'Resubscribe'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Features Card */}
        <Card>
          <CardHeader>
            <CardTitle>Premium Features</CardTitle>
            <CardDescription>Everything included in your Premium subscription</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plans.find(p => p.id === 'premium')?.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                  {feature.icon && (
                    <div className="text-foreground">
                      {feature.icon}
                    </div>
                  )}
                  <span className="text-sm">{feature.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const FreePlanView = () => {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-semibold mb-2">Choose Your Plan</h3>
          <p className="text-muted-foreground">Select the plan that best fits your community's needs</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </div>
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

      {/* Conditional rendering based on plan */}
      {isPremiumUser() ? <PremiumBillingView /> : <FreePlanView />}
    </div>
  );
};

export default BillingSettings;