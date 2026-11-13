import { ImageResponse } from "next/og";

// The site icon for browser tabs, search results and phone home screens: a gold "O" on the brand green.
export function generateImageMetadata() {
  return [32, 192, 512].map((size) => ({ id: String(size), size: { width: size, height: size }, contentType: "image/png" }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const size = Number(await id);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#14532d", color: "#c5a047", fontSize: size * 0.62, fontWeight: 800, borderRadius: size * 0.22 }}>
        O
      </div>
    ),
    { width: size, height: size },
  );
}
