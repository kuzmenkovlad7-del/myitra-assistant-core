import { NextResponse } from "next/server";
import { makeWebhookSignature } from "@/lib/wayforpay";

/**
 * Webhook stub:
 * - verifies signature if possible
 * - logs payload for now
 * Next step: map orderReference -> user, store payment status + recToken for recurring
 */
export async function POST(req: Request) {
  const secretKey = process.env.WAYFORPAY_SECRET_KEY;

  const payload = await req.json().catch(() => ({} as any));

  // payload fields vary by integration mode; try common ones
  const orderReference = payload?.orderReference;
  const status = payload?.transactionStatus || payload?.status;
  const time = Number(payload?.createdDate || payload?.time || 0);
  const receivedSignature = payload?.merchantSignature;

  let signatureOk: boolean | null = null;

  if (secretKey && orderReference && status && time && receivedSignature) {
    const expected = makeWebhookSignature({ orderReference, status, time, secretKey });
    signatureOk = expected === receivedSignature;
  }

  console.log("WayForPay webhook:", {
    signatureOk,
    orderReference,
    status,
    time,
    recToken: payload?.recToken,
    payload,
  });

  // always respond 200 to prevent retries while we're testing locally
  return NextResponse.json({ ok: true, signatureOk });
}
