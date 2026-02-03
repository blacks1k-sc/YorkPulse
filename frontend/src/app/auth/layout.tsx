import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Auth Header */}
      <header className="p-4">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-coral-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">YP</span>
          </div>
          <span className="font-semibold text-lg">YorkPulse</span>
        </Link>
      </header>

      {/* Auth Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">{children}</div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-sm text-zinc-500">
        <p>Exclusively for York University students</p>
      </footer>
    </div>
  );
}
