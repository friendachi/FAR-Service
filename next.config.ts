import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // trailer photos uploaded by staff live in the public "trailer-photos" Supabase bucket
  images: {
    remotePatterns: [new URL("https://*.supabase.co/storage/v1/object/public/trailer-photos/**")],
  },
  // Company-profile site: online booking, payment and customer accounts are retired; send visitors to the quote form.
  async redirects() {
    return [
      { source: "/booking/:path*", destination: "/quote", permanent: false },
      { source: "/register", destination: "/quote", permanent: false },
      { source: "/me", destination: "/quote", permanent: false },
      { source: "/me/:path*", destination: "/quote", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
