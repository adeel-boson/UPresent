import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Makes an internal link or redirect to a route that doesn't exist a type
  // error, caught by `npm run typecheck`.
  typedRoutes: true,
};

export default nextConfig;
