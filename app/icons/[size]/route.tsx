import { ImageResponse } from "next/og";

// PWA icons, rendered once at build time: a green tile with a white rupee coin
// dropping into a slot — the sweep, in one picture.

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }, { size: "maskable" }];
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = size === "192" ? 192 : 512;
  const maskable = size === "maskable";
  const coin = Math.round(px * (maskable ? 0.42 : 0.56));
  return new ImageResponse(
    (
      <div
        style={{
          width: px,
          height: px,
          background: "#0E5C36",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: maskable ? 0 : px * 0.22,
        }}
      >
        <div
          style={{
            width: coin,
            height: coin,
            borderRadius: coin,
            background: "#ffffff",
            color: "#0E5C36",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={coin * 0.58} height={coin * 0.58} viewBox="0 0 24 24" fill="none" stroke="#0E5C36" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12" /><path d="M6 8h12" /><path d="m6 13 8.5 8" /><path d="M6 13h3" /><path d="M9 13c6.667 0 6.667-10 0-10" /></svg>
        </div>
        <div
          style={{
            marginTop: px * 0.05,
            width: coin * 0.9,
            height: px * 0.05,
            borderRadius: px,
            background: "#f8cb46",
          }}
        />
      </div>
    ),
    { width: px, height: px },
  );
}
