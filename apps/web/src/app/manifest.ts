import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — گفت‌وگو و صوت روی سرور خودت`,
    short_name: APP_NAME,
    description: "کلاینت متن و صوت با میزبانی شخصی",
    start_url: "/",
    display: "standalone",
    background_color: "#111214",
    theme_color: "#1e1f22",
    dir: "rtl",
    lang: "fa",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
