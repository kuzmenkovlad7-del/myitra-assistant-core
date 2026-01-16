"use client";

const normalizeSrc = (raw?: string) => {
  const v = (raw || "").trim();
  if (!v) return "/icon.png";

  // если кто-то случайно положил "components/logo.tsx:/icon.png" -> берём "/icon.png"
  const idx = v.lastIndexOf(":/");
  if (!v.startsWith("/") && idx >= 0) return v.slice(idx + 1);

  if (v.startsWith("/") || v.startsWith("http://") || v.startsWith("https://")) return v;

  return "/icon.png";
};

export function BrandMark({ size = 32 }: { size?: number }) {
  const src = normalizeSrc(process.env.NEXT_PUBLIC_BRAND_LOGO_SRC);
  return (
    <img
      src={src}
      alt="TurbotaAI"
      width={size}
      height={size}
      draggable={false}
      onError={(e) => {
        const img = e.currentTarget as HTMLImageElement;
        if (img.src.includes("/favicon.ico")) return;
        img.src = "/favicon.ico";
      }}
      style={{ width: size, height: size }}
    />
  );
}
