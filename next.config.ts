import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Makes an internal link or redirect to a route that doesn't exist a type
  // error, caught by `npm run typecheck`.
  typedRoutes: true,
  // Approving an Organization applies the tenant migrations, which the
  // runner reads from disk at request time (src/lib/db/migrate.ts). File
  // tracing only follows imports, so ship the folder with that route's
  // function explicitly.
  outputFileTracingIncludes: {
    "/admin/signups": ["./db/migrations/tenant/**/*"],
  },
};

export default nextConfig;
