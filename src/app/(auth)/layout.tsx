// Shell for the signed-out pages (login, signup): one narrow card centered on
// the screen. Each page renders its own <Card> as the only child.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
