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
          console.log(`[BILLING STATUS] Stripe subscription status: ${subscription.status}, DB status: ${server.subscription_status}`);

          // If there's a discrepancy, update our database
          if (subscription.status !== server.subscription_status) {
            console.log(`[BILLING STATUS] Status mismatch detected. Updating ${server.customDomain} from ${server.subscription_status} to ${subscription.status}`);

            const globalDb = await connectToGlobalModlDb();
            const Server = globalDb.model('ModlServer', ModlServerSchema);

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
              subscription_status: subscription.status,
            };

            if (periodEndDate) {
              updateData.current_period_end = periodEndDate;
            } else if (subscription.status === 'canceled') {
              // For canceled subscriptions, set current_period_end to null
              updateData.current_period_end = null;
            }

            await Server.findOneAndUpdate(
              { _id: server._id },
              updateData
            );
            currentStatus = subscription.status;
            if (periodEndDate) {
              currentPeriodEnd = periodEndDate;
            } else if (subscription.status === 'canceled') {
              currentPeriodEnd = undefined;
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

// Mock endpoint for testing when Stripe is not configured
router.post('/debug-status/:customDomain', async (req, res) => {
  try {
    const { customDomain } = req.params;
    const globalDb = await connectToGlobalModlDb();
    const Server = globalDb.model('ModlServer', ModlServerSchema);

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
    const Server = globalDb.model('ModlServer', ModlServerSchema);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`[WEBHOOK] Processing checkout.session.completed for customer: ${session.customer}`);

        if (session.customer && session.subscription) {
          const server = await Server.findOne({ stripe_customer_id: session.customer });
          if (server) {
            await Server.findOneAndUpdate(
              { _id: server._id },
              {
                stripe_subscription_id: session.subscription,
                subscription_status: 'active',
                plan: 'premium' // Assuming checkout means premium plan
              }
            );
            console.log(`[WEBHOOK] Updated server ${server.customDomain} - checkout completed`);
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
        console.log(`[WEBHOOK] Processing subscription.updated: ${subscription.id}, status: ${subscription.status}`);

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

          const updateData: any = {
            subscription_status: subscription.status,
          };          // Only update current_period_end if we have a valid date
          if (periodEndDate) {
            updateData.current_period_end = periodEndDate;
          } else if (subscription.status === 'canceled') {
            // For canceled subscriptions, set current_period_end to null
            updateData.current_period_end = null;
          }

          await Server.findOneAndUpdate(
            { _id: server._id },
            updateData
          );

          console.log(`[WEBHOOK] Updated server ${server.customDomain} - subscription status: ${subscription.status}`);
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