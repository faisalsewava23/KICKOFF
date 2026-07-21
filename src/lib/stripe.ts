// Server-side Stripe client. Never import from client components — the
// secret key must not reach the browser.
import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  stripeSingleton ??= new Stripe(key);
  return stripeSingleton;
}
