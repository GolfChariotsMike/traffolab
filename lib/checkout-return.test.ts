import assert from "node:assert/strict";
import { DESIGN_STORAGE_KEY, ORDER_STORAGE_KEY } from "./label-design";
import { SHIPPING_STORAGE_KEY } from "./pricing";
import {
  CHECKOUT_EMAIL_STORAGE_KEY,
  applyCheckoutOutcome,
  readCheckoutEmail,
  writeCheckoutEmail,
  type DraftStorage,
} from "./order-draft";
import {
  allowCheckoutOrigin,
  checkoutReturnUrls,
  resolveCheckoutReturnOrigin,
  shouldClearOrderDraft,
} from "./checkout-return";

/**
 * Live session cs_live_b1e3… (22 Sep 2026) stored plates on
 * www.trafflabels.com.au and sent cancel_url to the deployment host.
 * Those origins do not share localStorage.
 */
const DEPLOYMENT_HOST =
  "traffolab-8j1lix2dr-golfchariotsmikes-projects.vercel.app";

{
  const origin = resolveCheckoutReturnOrigin({
    originHeader: "https://www.trafflabels.com.au",
    requestedOrigin: "https://www.trafflabels.com.au",
    forwardedHost: DEPLOYMENT_HOST,
    host: DEPLOYMENT_HOST,
    forwardedProto: "https",
  });
  assert.equal(origin, "https://www.trafflabels.com.au");
  const urls = checkoutReturnUrls(origin);
  assert.equal(
    urls.cancelUrl,
    "https://www.trafflabels.com.au/order/?mode=checkout&cancelled=1"
  );
  assert.equal(
    urls.successUrl,
    "https://www.trafflabels.com.au/order/success/?session_id={CHECKOUT_SESSION_ID}"
  );
  assert.equal(urls.cancelUrl.includes(DEPLOYMENT_HOST), false);
}

{
  // Apex 308s to www before any page script runs, so the draft lives on www.
  assert.equal(
    resolveCheckoutReturnOrigin({ originHeader: "https://trafflabels.com.au" }),
    "https://www.trafflabels.com.au"
  );
}

{
  // Someone actually shopping on the deployment URL should return there.
  assert.equal(
    resolveCheckoutReturnOrigin({
      originHeader: `https://${DEPLOYMENT_HOST}`,
      forwardedHost: DEPLOYMENT_HOST,
    }),
    `https://${DEPLOYMENT_HOST}`
  );
}

{
  assert.equal(
    resolveCheckoutReturnOrigin({
      originHeader: "https://evil.example",
      requestedOrigin: "https://evil.example/phish",
      forwardedHost: "evil.example",
      host: "evil.example",
    }),
    "https://www.trafflabels.com.au"
  );
  assert.equal(allowCheckoutOrigin("https://www.trafflabels.com.au.evil.com"), null);
  assert.equal(allowCheckoutOrigin("javascript:alert(1)"), null);
}

{
  assert.equal(
    resolveCheckoutReturnOrigin({ originHeader: "http://localhost:3000" }),
    "http://localhost:3000"
  );
  assert.equal(
    resolveCheckoutReturnOrigin({
      host: "127.0.0.1:3000",
      forwardedProto: "http",
    }),
    "http://127.0.0.1:3000"
  );
}

{
  assert.equal(shouldClearOrderDraft("paid"), true);
  assert.equal(shouldClearOrderDraft("unpaid"), false);
  assert.equal(shouldClearOrderDraft("no_payment_required"), false);
  assert.equal(shouldClearOrderDraft(null), false);
  assert.equal(shouldClearOrderDraft(undefined), false);
}

function memoryStorage(): DraftStorage & { dump(): Map<string, string> } {
  const data = new Map<string, string>();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key)! : null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
    dump() {
      return data;
    },
  };
}

{
  const storage = memoryStorage();
  const plates = JSON.stringify([
    { id: "plate-1", qty: 2, legend: "MAIN" },
  ]);
  storage.setItem(ORDER_STORAGE_KEY, plates);
  storage.setItem(SHIPPING_STORAGE_KEY, "express");
  writeCheckoutEmail(storage, "info@stikstickers.com");
  storage.setItem(DESIGN_STORAGE_KEY, "{\"widthMm\":70}");

  // Cancel / back from Stripe is not a paid session. Draft stays.
  applyCheckoutOutcome(storage, null);
  applyCheckoutOutcome(storage, "unpaid");
  assert.equal(storage.getItem(ORDER_STORAGE_KEY), plates);
  assert.equal(storage.getItem(SHIPPING_STORAGE_KEY), "express");
  assert.equal(readCheckoutEmail(storage), "info@stikstickers.com");
  assert.equal(storage.getItem(DESIGN_STORAGE_KEY), "{\"widthMm\":70}");

  applyCheckoutOutcome(storage, "paid");
  assert.equal(storage.getItem(ORDER_STORAGE_KEY), null);
  assert.equal(storage.getItem(SHIPPING_STORAGE_KEY), null);
  assert.equal(storage.getItem(CHECKOUT_EMAIL_STORAGE_KEY), null);
  assert.equal(storage.getItem(DESIGN_STORAGE_KEY), "{\"widthMm\":70}");
}

console.log("checkout-return tests ok");
