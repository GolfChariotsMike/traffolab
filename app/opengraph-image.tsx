import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logo = await readFile(
    join(process.cwd(), "public/brand/trafflabels-logo.png")
  );
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#12151A",
          color: "#F4F5F7",
          padding: 64,
        }}
      >
        <div style={{ display: "flex", height: 10, width: 220, background: "#FEE100" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <img src={logoSrc} width={420} height={85} alt="TraffLabels" />
          <div style={{ fontSize: 56, fontWeight: 600, lineHeight: 1.1 }}>
            Traffolyte labels
          </div>
          <div style={{ fontSize: 30, color: "rgba(244,245,247,0.72)" }}>
            Design online. Engraved in WA.
          </div>
        </div>
        <div style={{ fontSize: 22, color: "rgba(244,245,247,0.5)" }}>
          Perth · Stik Stickers group
        </div>
      </div>
    ),
    size
  );
}
