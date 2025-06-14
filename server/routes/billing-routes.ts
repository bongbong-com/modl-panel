import express from 'express';
import Stripe from 'stripe';
import { Staff } from '../models/mongodb-schemas';
import { isAuthenticated } from '../middleware/auth-middleware';
import { checkPremiumAccess } from '../middleware/premium-access-middleware';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
});

router.post('/create-checkout-session', isAuthenticated, checkPremiumAccess, async (req, res) => {
  const { priceId } = req.body;
  const staffId = req.currentUser!.userId;

  try {
    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).send('Staff not found');
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer: staff.stripe_customer_id,
      success_url: `${process.env.CLIENT_URL}/settings?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/settings`,
    });

    res.send({ sessionId: session.id });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/create-portal-session', isAuthenticated, checkPremiumAccess, async (req, res) => {
  const staffId = req.currentUser!.userId;

  try {
    const staff = await Staff.findById(staffId);
    if (!staff || !staff.stripe_customer_id) {
      return res.status(404).send('Staff or customer ID not found');
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: staff.stripe_customer_id,
      return_url: `${process.env.CLIENT_URL}/settings`,
    });

    res.send({ url: portalSession.url });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/stripe-webhooks', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await Staff.findOneAndUpdate(
        { stripe_customer_id: session.customer as string },
        {
          stripe_subscription_id: session.subscription as string,
          subscription_status: 'active',
        }
      );
      break;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      await Staff.findOneAndUpdate(
        { stripe_subscription_id: subscription.id },
        {
          subscription_status: subscription.status,
          plan_type: subscription.items.data[0].price.lookup_key,
          current_period_end: new Date(subscription.current_period_end * 1000),
        }
      );
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await Staff.findOneAndUpdate(
        { stripe_subscription_id: subscription.id },
        {
          subscription_status: 'canceled',
        }
      );
      break;
    }
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.status(200).send();
});

export default router;