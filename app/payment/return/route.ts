import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function pickOrderReferenceFromObj(obj: any): string {
  if (!obj) return "";
  return (
    obj.orderReference ||
    obj.order_reference ||
    obj?.webhook?.orderReference ||
    obj?.webhook?.order_reference ||
    ""
  );
}

async function readBodyAny(req: Request): Promise<any> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();

  try {
    if (ct.includes("application/json")) {
      return await req.json();
    }

    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      const out: Record<string, any> = {};
      fd.forEach((v, k) => (out[k] = typeof v === "string" ? v : "[file]"));

      // иногда JSON лежит в одном поле
      if (out.data && typeof out.data === "string") {
        const t = out.data.trim();
        if (t.startsWith("{")) {
          try {
            return JSON.parse(t);
          } catch {}
        }
      }
      return out;
    }

    const text = await req.text().catch(() => "");
    const trimmed = text.trim();

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        return JSON.parse(trimmed);
      } catch {}
    }

    const params = new URLSearchParams(text);
    const obj: Record<string, any> = {};
    params.forEach((v, k) => (obj[k] = v));

    // кейс: тело = один ключ, который является JSON-строкой
    if (Object.keys(obj).length === 1) {
      const onlyKey = Object.keys(obj)[0];
      const maybeJson = onlyKey.trim();
      if (maybeJson.startsWith("{") && maybeJson.endsWith("}")) {
        try {
          return JSON.parse(maybeJson);
        } catch {}
      }
    }

    return obj;
  } catch {
    return {};
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderReference =
    url.searchParams.get("orderReference") ||
    url.searchParams.get("order_reference") ||
    "";

  console.log("[billing][return] GET", { orderReference });

  if (!orderReference) {
    return NextResponse.redirect(new URL("/payment/result?status=processing", url), 307);
  }

  return NextResponse.redirect(
    new URL(`/payment/result?orderReference=${encodeURIComponent(orderReference)}`, url),
    307
  );
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = await readBodyAny(req);
  const orderReference = pickOrderReferenceFromObj(body);

  console.log("[billing][return] POST", { orderReference });

  if (!orderReference) {
    return NextResponse.redirect(new URL("/payment/result?status=processing", url), 307);
  }

  return NextResponse.redirect(
    new URL(`/payment/result?orderReference=${encodeURIComponent(orderReference)}`, url),
    307
  );
}
