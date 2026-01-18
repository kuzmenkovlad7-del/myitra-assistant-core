import { NextRequest, NextResponse } from "next/server";

async function extractOrderReference(req: NextRequest): Promise<string> {
  const url = new URL(req.url);

  // 1) Querystring
  const fromQs =
    url.searchParams.get("orderReference") ||
    url.searchParams.get("order_reference") ||
    "";
  if (fromQs) return fromQs;

  // 2) POST formData
  try {
    const form = await req.formData();
    const fromForm =
      (form.get("orderReference") as string) ||
      (form.get("order_reference") as string) ||
      "";
    if (fromForm) return fromForm;
  } catch {
    // ignore
  }

  // 3) Raw body: JSON or urlencoded
  try {
    const text = (await req.text())?.trim();
    if (!text) return "";

    if (text.startsWith("{") && text.endsWith("}")) {
      const obj: any = JSON.parse(text);
      return obj.orderReference || obj.order_reference || "";
    }

    const params = new URLSearchParams(text);
    return params.get("orderReference") || params.get("order_reference") || "";
  } catch {
    return "";
  }
}

function redirectToResult(req: NextRequest, orderReference?: string) {
  const base = new URL(req.url);
  const target = new URL("/payment/result", base.origin);

  if (orderReference) {
    target.searchParams.set("orderReference", orderReference);
  }

  // 303 = правильный редирект после POST
  return NextResponse.redirect(target, 303);
}

export async function POST(req: NextRequest) {
  const orderReference = await extractOrderReference(req);
  return redirectToResult(req, orderReference);
}

export async function GET(req: NextRequest) {
  const orderReference = await extractOrderReference(req);
  return redirectToResult(req, orderReference);
}
