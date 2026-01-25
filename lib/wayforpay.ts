import crypto from "crypto"

function norm(v: any) {
  return String(v ?? "").trim()
}

// WayForPay signature line:
// merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode
export function makeServiceWebhookSignature(secretKey: string, payload: any) {
  const merchantAccount = norm(payload?.merchantAccount ?? payload?.merchant_account)
  const orderReference = norm(payload?.orderReference ?? payload?.order_reference)
  const amount = norm(payload?.amount)
  const currency = norm(payload?.currency)
  const authCode = norm(payload?.authCode ?? payload?.auth_code)
  const cardPan = norm(payload?.cardPan ?? payload?.card_pan)
  const transactionStatus = norm(payload?.transactionStatus ?? payload?.transaction_status)
  const reasonCode = norm(payload?.reasonCode ?? payload?.reason_code)

  const signLine = [
    merchantAccount,
    orderReference,
    amount,
    currency,
    authCode,
    cardPan,
    transactionStatus,
    reasonCode,
  ].join(";")

  return crypto.createHmac("md5", secretKey).update(signLine, "utf8").digest("hex")
}

export function makeServiceResponseSignature(secretKey: string, orderReference: string, status: string, time: number) {
  const line = `${orderReference};${status};${time}`
  return crypto.createHmac("md5", secretKey).update(line, "utf8").digest("hex")
}
