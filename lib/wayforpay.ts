import { createHmac } from "crypto";

export function hmacMd5Hex(secret: string, payload: string) {
  return createHmac("md5", secret).update(payload, "utf8").digest("hex");
}

export function makeInvoiceSignature(params: {
  merchantAccount: string;
  merchantDomainName: string;
  orderReference: string;
  orderDate: number;
  amount: number;
  currency: string;
  productName: string[];
  productCount: number[];
  productPrice: number[];
  secretKey: string;
}) {
  // WayForPay signature string: fields joined by ';' in UTF-8, then HMAC_MD5 with SecretKey
  // merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;productName...;productCount...;productPrice...
  const s = [
    params.merchantAccount,
    params.merchantDomainName,
    params.orderReference,
    String(params.orderDate),
    String(params.amount),
    params.currency,
    ...params.productName,
    ...params.productCount.map(String),
    ...params.productPrice.map(String),
  ].join(";");

  return hmacMd5Hex(params.secretKey, s);
}

export function makeWebhookSignature(params: {
  orderReference: string;
  status: string;
  time: number;
  secretKey: string;
}) {
  // WayForPay webhook signature usually based on: orderReference;status;time
  const s = [params.orderReference, params.status, String(params.time)].join(";");
  return hmacMd5Hex(params.secretKey, s);
}
