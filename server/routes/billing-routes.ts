import express from 'express';
import Stripe from 'stripe';
import { isAuthenticated } from '../middleware/auth-middleware';
import { connectToGlobalModlDb } from '../db/connectionManager';
import { ModlServerSchema } from 'modl-shared-web';

const router = express.Router();

// Initialize Stripe only if keys are available
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
} else {
  console.warn('STRIPE_SECRET_KEY not found. Billing features will be disabled.');
}

router.post('/create-checkout-session', isAuthenticated, async (req, res) => {
  if (!stripe) {
    return res.status(503).send('Billing service unavailable. Stripe not configured.');
  }

  const server = req.modlServer;

  if (!server) {
    return res.status(400).send('Server context not found in request.');
  }

  try {
    let customerId = server.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: server.adminEmail,
        name: server.serverName,
        metadata: {
          serverName: server.customDomain,
        },
      });
      customerId = customer.id;
      server.stripe_customer_id = customerId;
      await server.save();
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      customer: customerId,
      success_url: `https://${server.customDomain}.${process.env.DOMAIN}/panel/settings?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://${server.customDomain}.${process.env.DOMAIN}/panel/settings`,
    });

    res.send({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/create-portal-session', isAuthenticated, async (req, res) => {
  if (!stripe) {
    return res.status(503).send('Billing service unavailable. Stripe not configured.');
  }

  const server = req.modlServer;

  if (!server) {
    return res.status(400).send('Server context not found in request.');
  }

  try {
    if (!server.stripe_customer_id) {
      return res.status(404).send('Customer ID not found for server');
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: server.stripe_customer_id,
      return_url: `https://${server.customDomain}.${process.env.DOMAIN}/panel/settings`,
    });

    res.send({ url: portalSession.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/cancel-subscription', isAuthenticated, async (req, res) => {
  if (!stripe) {
    return res.status(503).send('Billing service unavailable. Stripe not configured.');
  }

  const server = req.modlServer;

  if (!server) {
    return res.status(400).send('Server context not found in request.');
  }

  try {
    if (!server.stripe_subscription_id) {
      return res.status(404).send('No active subscription found to cancel');
    }

    // Cancel the subscription at period end (so user keeps access until billing period ends)
    const canceledSubscription = await stripe.subscriptions.update(server.stripe_subscription_id, {
      cancel_at_period_end: true
    }) as any;

    console.log(`[CANCEL SUBSCRIPTION] Subscription ${server.stripe_subscription_id} for server ${server.customDomain} set to cancel at period end`);

    // Update our database to reflect the cancellation
    const globalDb = await connectToGlobalModlDb();
    const Server = globalDb.models.ModlServer || globalDb.model('ModlServer', ModlServerSchema);

    await Server.findOneAndUpdate(
      { _id: server._id },
      { 
        subscription_status: 'canceled'
        // Note: We keep current_period_end as is, since user keeps access until then
      }
    );

    res.json({ 
      success: true, 
      message: 'Subscription cancelled successfully. Access will continue until the end of your current billing period.',
      cancels_at: canceledSubscription.current_period_end ? new Date(canceledSubscription.current_period_end * 1000) : null
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).send('Failed to cancel subscription. Please try again or contact support.');
  }
});

router.get('/status', isAuthenticated, async (req, res) => {
  const server = req.modlServer;

  if (!server) {
    return res.status(400).send('Server context not found in request.');
  }

  try {
    // If we have a Stripe subscription ID, fetch the latest status directly from Stripe as a fallback
    let currentStatus = server.subscription_status;
    let currentPeriodEnd = server.current_period_end;

    if (server.stripe_subscription_id && (!currentStatus || currentStatus === 'active')) {
      if (!stripe) {
        console.warn('[BILLING STATUS] Cannot sync with Stripe - Stripe not configured');
      } else {
        try {
          const subscription = await stripe.subscriptions.retrieve(server.stripe_subscription_id) as any;
          console.log(`[BILLING STATUS] Stripe subscription status: ${subscription.status}, cancel_at_period_end: ${subscription.cancel_at_period_end}, DB status: ${server.subscription_status}`);

          // Determine effective status - if cancel_at_period_end is true, treat as canceled
          let effectiveStatus = subscription.status;
          if (subscription.cancel_at_period_end === true && subscription.status === 'active') {
            effectiveStatus = 'canceled';
            console.log(`[BILLING STATUS] Subscription marked for cancellation at period end, treating as canceled`);
          }

          // If there's a discrepancy, update our database
          if (effectiveStatus !== server.subscription_status) {
            console.log(`[BILLING STATUS] Status mismatch detected. Updating ${server.customDomain} from ${server.subscription_status} to ${effectiveStatus}`);

            const globalDb = await connectToGlobalModlDb();
            const Server = globalDb.models.ModlServer || globalDb.model('ModlServer', ModlServerSchema);

            // Validate current_period_end before creating Date object
            let periodEndDate = null;
            if (subscription.current_period_end && typeof subscription.current_period_end === 'number') {
              periodEndDate = new Date(subscription.current_period_end * 1000);
              // Validate the date is valid
              if (isNaN(periodEndDate.getTime())) {
                console.error(`[BILLING STATUS] Invalid date from Stripe timestamp: ${subscription.current_period_end}`);
                periodEndDate = null;
              }
            }
            const updateData: any = {
              subscription_status: effectiveStatus,
            };

            if (periodEndDate) {
              updateData.current_period_end = periodEndDate;
            }

            await Server.findOneAndUpdate(
              { _id: server._id },
              updateData
            );
            currentStatus = effectiveStatus;
            if (periodEndDate) {
              currentPeriodEnd = periodEndDate;
            }
            
            // Special logging for cancelled subscriptions
            if (effectiveStatus === 'canceled') {
              console.log(`[BILLING STATUS] CANCELLATION DETECTED: Server ${server.customDomain} has cancelled subscription. Access ends: ${periodEndDate ? periodEndDate.toISOString() : 'No end date'}`);
            }
          }
        } catch (stripeError) {
          console.error('Error fetching subscription from Stripe:', stripeError);
          // Continue with database values if Stripe API fails
        }
      }
    }

    res.send({
      plan: server.plan,
      subscription_status: currentStatus,
      current_period_end: currentPeriodEnd,
    });
  } catch (error) {
    console.error('Error fetching billing status:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Get usage statistics for CDN and AI
router.get('/usage', isAuthenticated, async (req, res) => {
  const server = req.modlServer;

  if (!server) {
    return res.status(400).send('Server context not found in request.');
  }

  try {
    const globalDb = await connectToGlobalModlDb();
    const Server = globalDb.models.ModlServer || globalDb.model('ModlServer', ModlServerSchema);

    // Fetch fresh server data from database to get latest usage billing settings
    const freshServer = await Server.findById(server._id);
    if (!freshServer) {
      return res.status(404).send('Server not found in database.');
    }

    console.log(`[USAGE] Fetching usage data for ${freshServer.customDomain}, usage_billing_enabled: ${freshServer.usage_billing_enabled}`);

    // Get current billing period start and end dates
    const currentPeriodStart = freshServer.current_period_start || new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)); // Default to 30 days ago
    const currentPeriodEnd = freshServer.current_period_end || new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)); // Default to 30 days from now

    // For now, return mock data since nothing tracks usage yet
    // TODO: Replace with actual usage tracking from your CDN and AI service logs
    const cdnUsageGB = freshServer.cdn_usage_current_period || 0;
    const aiRequestsUsed = freshServer.ai_requests_current_period || 0;

    // Premium limits
    const CDN_LIMIT_GB = 200;
    const AI_LIMIT_REQUESTS = 10000;
    const CDN_OVERAGE_RATE = 0.05; // $0.05 per GB
    const AI_OVERAGE_RATE = 0.01; // $0.01 per request

    // Calculate overages
    const cdnOverageGB = Math.max(0, cdnUsageGB - CDN_LIMIT_GB);
    const aiOverageRequests = Math.max(0, aiRequestsUsed - AI_LIMIT_REQUESTS);

    // Calculate overage costs
    const cdnOverageCost = cdnOverageGB * CDN_OVERAGE_RATE;
    const aiOverageCost = aiOverageRequests * AI_OVERAGE_RATE;
    const totalOverageCost = cdnOverageCost + aiOverageCost;

    res.json({
      period: {
        start: currentPeriodStart,
        end: currentPeriodEnd
      },
      cdn: {
        used: cdnUsageGB,
        limit: CDN_LIMIT_GB,
        overage: cdnOverageGB,
        overageRate: CDN_OVERAGE_RATE,
        overageCost: cdnOverageCost,
        percentage: Math.min(100, (cdnUsageGB / CDN_LIMIT_GB) * 100)
      },
      ai: {
        used: aiRequestsUsed,
        limit: AI_LIMIT_REQUESTS,
        overage: aiOverageRequests,
        overageRate: AI_OVERAGE_RATE,
        overageCost: aiOverageCost,
        percentage: Math.min(100, (aiRequestsUsed / AI_LIMIT_REQUESTS) * 100)
      },
      totalOverageCost,
      usageBillingEnabled: freshServer.usage_billing_enabled || false
    });
  } catch (error) {
    console.error('Error fetching usage statistics:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Enable/disable usage billing and setup automatic payments
router.post('/usage-billing-settings', isAuthenticated, async (req, res) => {
  if (!stripe) {
    return res.status(503).send('Billing service unavailable. Stripe not configured.');
  }

  const server = req.modlServer;
  const { enabled } = req.body;

  if (!server) {
    return res.status(400).send('Server context not found in request.');
  }

  console.log(`[USAGE BILLING] Updating usage billing for ${server.customDomain}: enabled=${enabled}`);

  try {
    const globalDb = await connectToGlobalModlDb();
    const Server = globalDb.models.ModlServer || globalDb.model('ModlServer', ModlServerSchema);

    if (enabled && !server.stripe_customer_id) {
      return res.status(400).send('No Stripe customer ID found. Please ensure you have an active subscription.');
    }

    // Update the server's usage billing setting
    const updateResult = await Server.findOneAndUpdate(
      { _id: server._id },
      { 
        $set: {
          usage_billing_enabled: enabled,
          usage_billing_updated_at: new Date()
        }
      },
      { 
        new: true, // Return the updated document
        upsert: false // Don't create if not found
      }
    );

    console.log(`[USAGE BILLING] Database update result for ${server.customDomain}:`, {
      updated: !!updateResult,
      usage_billing_enabled: updateResult?.usage_billing_enabled
    });

    // If enabling usage billing, we could set up Stripe metering here
    // For now, we'll just track the setting in our database
    
    res.json({ 
      success: true, 
      message: enabled 
        ? 'Usage billing has been enabled. You will be charged for overages at the end of each billing period.'
        : 'Usage billing has been disabled. Overages will not be charged.',
      usageBillingEnabled: enabled
    });
  } catch (error) {
    console.error('Error updating usage billing settings:', error);
    res.status(500).send('Failed to update usage billing settings. Please try again.');
  }
});

// Mock endpoint for testing when Stripe is not configured
router.post('/debug-status/:customDomain', async (req, res) => {
  try {
    const { customDomain } = req.params;
    const globalDb = await connectToGlobalModlDb();
    const Server = globalDb.models.ModlServer || globalDb.model('ModlServer', ModlServerSchema);

    const server = await Server.findOne({ customDomain });
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json({
      customDomain: server.customDomain,
      subscription_status: server.subscription_status,
      current_period_end: server.current_period_end,
      stripe_customer_id: server.stripe_customer_id,
      stripe_subscription_id: server.stripe_subscription_id,
      plan: server.plan
    });
  } catch (error) {
    console.error('Error fetching debug status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test endpoint to manually trigger subscription status update
router.post('/debug-sync/:customDomain', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  try {
    const { customDomain } = req.params;
    const globalDb = await connectToGlobalModlDb();
    const Server = globalDb.models.ModlServer || globalDb.model('ModlServer', ModlServerSchema);

    const server = await Server.findOne({ customDomain });
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (!server.stripe_subscription_id) {
      return res.status(400).json({ error: 'No subscription ID found' });
    }

    const subscription = await stripe.subscriptions.retrieve(server.stripe_subscription_id) as any;
    
    let periodEndDate = null;
    if (subscription.current_period_end) {
      periodEndDate = new Date(subscription.current_period_end * 1000);
    }

    // Determine effective status - if cancel_at_period_end is true, treat as canceled
    let effectiveStatus = subscription.status;
    if (subscription.cancel_at_period_end === true && subscription.status === 'active') {
      effectiveStatus = 'canceled';
    }

    const updateData: any = {
      subscription_status: effectiveStatus,
    };

    if (periodEndDate) {
      updateData.current_period_end = periodEndDate;
    }

    await Server.findOneAndUpdate(
      { _id: server._id },
      updateData
    );

    console.log(`[DEBUG SYNC] Updated ${customDomain}: status=${effectiveStatus}, period_end=${periodEndDate}, cancel_at_period_end=${subscription.cancel_at_period_end}`);

    res.json({
      message: 'Sync completed',
      stripe_status: subscription.status,
      stripe_cancel_at_period_end: subscription.cancel_at_period_end,
      effective_status: effectiveStatus,
      stripe_period_end: periodEndDate,
      updated: updateData
    });
  } catch (error) {
    console.error('Error syncing subscription status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to check for and update expired cancelled subscriptions
router.post('/debug-check-expired', async (req, res) => {
  try {
    const globalDb = await connectToGlobalModlDb();
    const Server = globalDb.models.ModlServer || globalDb.model('ModlServer', ModlServerSchema);

    // Find all servers with cancelled subscriptions that have a period end date
    const cancelledServers = await Server.find({
      subscription_status: 'canceled',
      current_period_end: { $exists: true, $ne: null }
    });

    const now = new Date();
    const expiredServers: any[] = [];
    
    for (const server of cancelledServers) {
      const endDate = new Date(server.current_period_end);
      if (endDate <= now) {
        // This subscription has expired, update it to free
        await Server.findOneAndUpdate(
          { _id: server._id },
          { 
            subscription_status: 'inactive',
            plan: 'free',
            current_period_end: null
          }
        );
        
        expiredServers.push({
          customDomain: server.customDomain,
          endDate: endDate.toISOString()
        });
        
        console.log(`[EXPIRED CHECK] Updated ${server.customDomain} - expired on ${endDate.toISOString()}`);
      }
    }

    res.json({
      message: 'Expired subscription check completed',
      total_cancelled: cancelledServers.length,
      expired_count: expiredServers.length,
      expired_servers: expiredServers
    });
  } catch (error) {
    console.error('Error checking for expired subscriptions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Debug endpoint for usage billing settings
router.get('/debug-usage/:customDomain', async (req, res) => {
  try {
    const { customDomain } = req.params;
    const globalDb = await connectToGlobalModlDb();
    const Server = globalDb.models.ModlServer || globalDb.model('ModlServer', ModlServerSchema);

    const server = await Server.findOne({ customDomain });
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json({
      customDomain: server.customDomain,
      usage_billing_enabled: server.usage_billing_enabled,
      usage_billing_updated_at: server.usage_billing_updated_at,
      cdn_usage_current_period: server.cdn_usage_current_period,
      ai_requests_current_period: server.ai_requests_current_period,
      subscription_status: server.subscription_status,
      plan: server.plan,
      raw_usage_billing_field: server.get('usage_billing_enabled') // Direct field access
    });
  } catch (error) {
    console.error('Error fetching usage debug info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Function to check for and update expired cancelled subscriptions
async function checkExpiredSubscriptions() {
  try {
    const globalDb = await connectToGlobalModlDb();
    const Server = globalDb.models.ModlServer || globalDb.model('ModlServer', ModlServerSchema);

    // Find all servers with cancelled subscriptions that have a period end date
    const cancelledServers = await Server.find({
      subscription_status: 'canceled',
      current_period_end: { $exists: true, $ne: null }
    });

    const now = new Date();
    let expiredCount = 0;
    
    for (const server of cancelledServers) {
      const endDate = new Date(server.current_period_end);
      if (endDate <= now) {
        // This subscription has expired, update it to free
        await Server.findOneAndUpdate(
          { _id: server._id },
          { 
            subscription_status: 'inactive',
            plan: 'free',
            current_period_end: null
          }
        );
        
        expiredCount++;
        console.log(`[AUTO EXPIRED CHECK] Updated ${server.customDomain} - expired on ${endDate.toISOString()}`);
      }
    }

    if (expiredCount > 0) {
      console.log(`[AUTO EXPIRED CHECK] Processed ${expiredCount} expired subscriptions out of ${cancelledServers.length} cancelled subscriptions`);
    }
  } catch (error) {
    console.error('[AUTO EXPIRED CHECK] Error checking for expired subscriptions:', error);
  }
}

// Start periodic check for expired subscriptions (every hour)
const expiredCheckInterval = setInterval(checkExpiredSubscriptions, 60 * 60 * 1000); // 1 hour

// Run initial check after 30 seconds to allow server to fully start
setTimeout(checkExpiredSubscriptions, 30 * 1000);

export default router;

// Stripe webhook handler - this needs to be separate from the authenticated routes
const webhookRouter = express.Router();

// Webhook handler for Stripe events
webhookRouter.post('/stripe-webhooks', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe) {
    console.warn('[WEBHOOK] Stripe not configured, ignoring webhook');
    return res.status(503).send('Stripe not configured');
  }

  if (!webhookSecret) {
    console.error('[WEBHOOK] STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).send('Webhook secret not configured');
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);
    console.log(`[WEBHOOK] Received Stripe event: ${event.type}`);
  } catch (err: any) {
    console.error('[WEBHOOK] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const globalDb = await connectToGlobalModlDb();
    const Server = globalDb.models.ModlServer || globalDb.model('ModlServer', ModlServerSchema);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`[WEBHOOK] Processing checkout.session.completed for customer: ${session.customer}`);

        if (session.customer && session.subscription) {
          const server = await Server.findOne({ stripe_customer_id: session.customer });
          if (server) {
            // Fetch the subscription details to get period information
            const subscription = await stripe.subscriptions.retrieve(session.subscription as string) as any;
            
            let periodStartDate = null;
            let periodEndDate = null;
            if (subscription.current_period_start && typeof subscription.current_period_start === 'number') {
              periodStartDate = new Date(subscription.current_period_start * 1000);
              if (isNaN(periodStartDate.getTime())) {
                console.error(`[WEBHOOK] Invalid start date from Stripe timestamp: ${subscription.current_period_start}`);
                periodStartDate = null;
              }
            }
            if (subscription.current_period_end && typeof subscription.current_period_end === 'number') {
              periodEndDate = new Date(subscription.current_period_end * 1000);
              if (isNaN(periodEndDate.getTime())) {
                console.error(`[WEBHOOK] Invalid end date from Stripe timestamp: ${subscription.current_period_end}`);
                periodEndDate = null;
              }
            }

            const updateData: any = {
              stripe_subscription_id: session.subscription,
              subscription_status: 'active',
              plan: 'premium' // Assuming checkout means premium plan
            };
            
            if (periodStartDate) {
              updateData.current_period_start = periodStartDate;
            }
            if (periodEndDate) {
              updateData.current_period_end = periodEndDate;
            }

            await Server.findOneAndUpdate(
              { _id: server._id },
              updateData
            );
            console.log(`[WEBHOOK] Updated server ${server.customDomain} - checkout completed with periods: ${periodStartDate?.toISOString()} to ${periodEndDate?.toISOString()}`);
          } else {
            console.warn(`[WEBHOOK] No server found for customer: ${session.customer}`);
          }
        }
        break;
      }
      
      case 'customer.subscription.created': {
        const subscription = event.data.object as any; // Stripe.Subscription
        console.log(`[WEBHOOK] Processing subscription.created: ${subscription.id}, status: ${subscription.status}, customer: ${subscription.customer}`);

        const server = await Server.findOne({ stripe_customer_id: subscription.customer });
        if (server) {
          let periodEndDate = null;
          if (subscription.current_period_end && typeof subscription.current_period_end === 'number') {
            periodEndDate = new Date(subscription.current_period_end * 1000);
            if (isNaN(periodEndDate.getTime())) {
              console.error(`[WEBHOOK] Invalid date from Stripe timestamp for created subscription: ${subscription.current_period_end}`);
              periodEndDate = null;
            }
          }

          const updateData: any = {
            stripe_subscription_id: subscription.id,
            subscription_status: subscription.status, // Use status from the event
            plan: 'premium', // Assume new subscriptions are premium
          };
          if (periodEndDate) {
            updateData.current_period_end = periodEndDate;
          }

          await Server.findOneAndUpdate(
            { _id: server._id },
            updateData
          );
          console.log(`[WEBHOOK] Updated server ${server.customDomain} - subscription created/linked: ${subscription.id}, status: ${subscription.status}`);
        } else {
          console.warn(`[WEBHOOK] No server found for customer: ${subscription.customer} during subscription.created event for subscription ${subscription.id}`);
        }
        break;
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object as any; // Stripe.Subscription
        console.log(`[WEBHOOK] Processing subscription.updated: ${subscription.id}, status: ${subscription.status}, cancel_at_period_end: ${subscription.cancel_at_period_end}`);

        const server = await Server.findOne({ stripe_subscription_id: subscription.id });
        if (server) {
          // Validate and convert current_period_end
          let periodEndDate = null;
          if (subscription.current_period_end && typeof subscription.current_period_end === 'number') {
            periodEndDate = new Date(subscription.current_period_end * 1000);
            // Validate the date is valid
            if (isNaN(periodEndDate.getTime())) {
              console.error(`[WEBHOOK] Invalid date from Stripe timestamp: ${subscription.current_period_end}`);
              periodEndDate = null;
            }
          }

          // Determine effective status - if cancel_at_period_end is true, treat as canceled
          let effectiveStatus = subscription.status;
          if (subscription.cancel_at_period_end === true && subscription.status === 'active') {
            effectiveStatus = 'canceled';
            console.log(`[WEBHOOK] Subscription marked for cancellation at period end, treating as canceled`);
          }

          const updateData: any = {
            subscription_status: effectiveStatus,
          };

          // Always update current_period_end if we have a valid date, even for canceled subscriptions
          // This is important for canceled subscriptions so users know when access ends
          if (periodEndDate) {
            updateData.current_period_end = periodEndDate;
          }

          await Server.findOneAndUpdate(
            { _id: server._id },
            updateData
          );

          console.log(`[WEBHOOK] Updated server ${server.customDomain} - subscription status: ${effectiveStatus}, period_end: ${periodEndDate}`);
          
          // Special logging for cancelled subscriptions
          if (effectiveStatus === 'canceled') {
            console.log(`[WEBHOOK] CANCELLATION DETECTED: Server ${server.customDomain} subscription cancelled. Access ends: ${periodEndDate ? periodEndDate.toISOString() : 'No end date'}`);
          }
        } else {
          console.warn(`[WEBHOOK] No server found for subscription: ${subscription.id}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any; // Use any to access Stripe properties
        console.log(`[WEBHOOK] Processing subscription.deleted: ${subscription.id}`);

        const server = await Server.findOne({ stripe_subscription_id: subscription.id });
        if (server) {
          await Server.findOneAndUpdate(
            { _id: server._id },
            {
              subscription_status: 'canceled',
              plan: 'free',
              current_period_end: null
            }
          );
          console.log(`[WEBHOOK] Updated server ${server.customDomain} - subscription deleted`);
        } else {
          console.warn(`[WEBHOOK] No server found for deleted subscription: ${subscription.id}`);
        }
        break;
      } 
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object as any; // Use any to access Stripe properties
        console.log(`[WEBHOOK] Processing payment_failed for customer: ${invoice.customer}`);

        if (invoice.subscription) {
          const server = await Server.findOne({ stripe_subscription_id: invoice.subscription });
          if (server) {
            await Server.findOneAndUpdate(
              { _id: server._id },
              { subscription_status: 'past_due' }
            );
            console.log(`[WEBHOOK] Updated server ${server.customDomain} - payment failed`);
          }
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as any;
        console.log(`[WEBHOOK] Processing trial_will_end for subscription: ${subscription.id}`);
        // Could send notification email here
        break;
      }

      default:
        console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[WEBHOOK] Error processing webhook:', error);
    res.status(500).send('Webhook processing error');
  }
});

export { webhookRouter };