// Whether the server this deployment talks to is really selling Premium.
//
// The build flag (PREMIUM_ON_SALE) says whether the EDITION has a payment
// provider at all. An edition whose only provider is Stripe is on sale only once
// the server has Stripe configured, and the server says so in GET /billing/config
// (`available: false` when it is not). Until the answer arrives the screen behaves
// as the build flag says (an edition through Razorpay, Apple or Google never
// says `available: false`, so it never changes); a server that answers
// "not available" turns every purchase line into the plain not-on-sale sentence.
import { useEffect, useState } from 'react';
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';
import { PREMIUM_ON_SALE } from '../platform/nativeBilling.js';

/** true / false once known, null while unknown (or when there is nothing to ask). */
export function useSaleAvailable() {
  const [available, setAvailable] = useState(null);
  useEffect(() => {
    let live = true;
    if (!PREMIUM_ON_SALE || !cloudAvailable()) return () => { live = false; };
    cloud.billingConfig()
      .then(config => { if (live) setAvailable(config?.available !== false); })
      .catch(() => { /* unknown: keep the build flag's answer */ });
    return () => { live = false; };
  }, []);
  return available;
}

/** The edition sells Premium and (as far as is known) the server does too. */
export const sellsPremium = available => PREMIUM_ON_SALE && available !== false;
