import express from 'express';
import Stripe from 'stripe';
import { isAuthenticated } from '../middleware/auth-middleware';
import { connectToGlobalModlDb } from '../db/connectionManager';
import { ModlServerSchema } from '../models/modl-global-schemas';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

router.post('/create-checkout-session', isAuthenticated, async (req, res) => {
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
      success_url: `https://${server.customDomain}.${process.env.DOMAIN}/settings?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://${server.customDomain}.${process.env.DOMAIN}/settings`,
    });

    res.send({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/create-portal-session', isAuthenticated, async (req, res) => {
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
      return_url: `https://${server.customDomain}.${process.env.DOMAIN}/settings`,
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
      try {
        const subscription = await stripe.subscriptions.retrieve(server.stripe_subscription_id);
        console.log(`[BILLING STATUS] Stripe subscription status: ${subscription.status}, DB status: ${server.subscription_status}`);
        
        // If there's a discrepancy, update our database
        if (subscription.status !== server.subscription_status) {
          console.log(`[BILLING STATUS] Status mismatch detected. Updating ${server.customDomain} from ${server.subscription_status} to ${subscription.status}`);
          
          const globalDb = await connectToGlobalModlDb();
          const Server = globalDb.model('ModlServer', ModlServerSchema);
          
          await Server.findOneAndUpdate(
            { _id: server._id },
            {
              subscription_status: subscription.status,
              current_period_end: new Date(subscription.current_period_end * 1000),
            }
          );
          
          currentStatus = subscription.status;
          currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        }
      } catch (stripeError) {
        console.error('Error fetching subscription from Stripe:', stripeError);
        // Continue with database values if Stripe API fails
      }
    }

    res.send({
      plan_type: server.plan_type,
      subscription_status: currentStatus,
      current_period_end: currentPeriodEnd,
    });
  } catch (error) {
    console.error('Error fetching billing status:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/stripe-webhooks', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[STRIPE WEBHOOK] Received event: ${event.type}`);

  const globalDb = await connectToGlobalModlDb();
  const Server = globalDb.model('ModlServer', ModlServerSchema);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(`[STRIPE WEBHOOK] Checkout completed for customer: ${session.customer}`);
      const updateResult = await Server.findOneAndUpdate(
        { stripe_customer_id: session.customer as string },
        {
          stripe_subscription_id: session.subscription as string,
          subscription_status: 'active',
        },
        { new: true }
      );
      console.log(`[STRIPE WEBHOOK] Updated server:`, updateResult?.customDomain);
      break;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      console.log(`[STRIPE WEBHOOK] Subscription updated:`, {
        id: subscription.id,
        status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end,
        current_period_end: subscription.current_period_end
      });
      
      const updateResult = await Server.findOneAndUpdate(
        { stripe_subscription_id: subscription.id },
        {
          subscription_status: subscription.status,
          plan_type: subscription.items.data[0]?.price?.lookup_key || 'premium',
          current_period_end: new Date(subscription.current_period_end * 1000),
        },
        { new: true }
      );
      console.log(`[STRIPE WEBHOOK] Updated server subscription status to: ${subscription.status} for server: ${updateResult?.customDomain}`);
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      console.log(`[STRIPE WEBHOOK] Subscription deleted: ${subscription.id}`);
      const updateResult = await Server.findOneAndUpdate(
        { stripe_subscription_id: subscription.id },
        {
          subscription_status: 'canceled',
        },
        { new: true }
      );
      console.log(`[STRIPE WEBHOOK] Marked subscription as canceled for server: ${updateResult?.customDomain}`);
      break;
    }
    default:
      console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
  }

  res.status(200).send();
});

export default router;