import type { Route } from "next";
import Link from "next/link";

import { cn } from "@/lib/utils";

type TextLinkProps<T extends string> = {
  href: Route<T>;
  className?: string;
  children: React.ReactNode;
};

// An inline text link in the accent color. Generic over the route so a typo in
// `href` still fails the typecheck (typedRoutes).
export function TextLink<T extends string>({ href, className, children }: TextLinkProps<T>) {
  return (
    <Link
      href={href}
      className={cn("font-medium text-primary underline-offset-4 hover:underline", className)}
    >
      {children}
    </Link>
  );
}
