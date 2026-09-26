import Link from "next/link";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";

// Shell for the signed-in pages: a header with the product name and Log out,
// then the page content. It shows no user data, so it needs no guard; each
// page still guards itself (CODING_STANDARDS §5).
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <Link href="/dashboard" className="font-heading text-lg font-semibold">
            UPresent
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="outline" size="lg" className="h-11">
              Log out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
