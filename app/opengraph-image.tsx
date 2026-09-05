import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#1C1914",
          color: "#F6F1E6",
          padding: 64,
        }}
      >
        <div
          style={{
            height: 10,
            width: 220,
            background: "#E8C14A",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 28,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#E8C14A",
            }}
          >
            TraffLabels · Perth · WA
          </div>
          <div style={{ fontSize: 72, fontWeight: 600, lineHeight: 1.05 }}>
            Traffolyte labels
          </div>
          <div style={{ fontSize: 32, color: "rgba(246,241,230,0.72)" }}>
            Design online. Engraved in WA.
          </div>
        </div>
        <div style={{ fontSize: 22, color: "rgba(246,241,230,0.5)" }}>
          Stik Stickers group
        </div>
      </div>
    ),
    size
  );
}
