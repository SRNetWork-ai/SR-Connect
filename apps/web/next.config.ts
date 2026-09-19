import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  transpilePackages: ["@sr/protocol"],
  // پکیج مشترک با پسوند .js ایمپورت می‌شود تا برای Node ESM (گیت‌وی) درست باشد؛
  // وبپک باید همان مسیر را به فایل .ts نگاشت کند.
  webpack(config) {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
  turbopack: {
    resolveExtensions: [".ts", ".tsx", ".mdx", ".js", ".jsx", ".mjs", ".json"],
  },
  async headers() {
    return [
      {
        // نسخه و بسته‌ها هیچ‌وقت کش نمی‌شوند؛ وگرنه آپدیت گیر می‌کند.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "microphone=(self), camera=(self), display-capture=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
