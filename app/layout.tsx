import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'MLB Stats Tracker',
  description: 'Track MLB The Show stats for B, Greg, and Andrew',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-screen bg-zinc-950 text-white">
          <nav className="border-b border-zinc-800 bg-zinc-900">
            <div className="mx-auto max-w-4xl px-4">
              <div className="flex h-14 items-center justify-between">
                <Link href="/" className="text-lg font-bold text-white">
                  MLB Stats
                </Link>
                <div className="flex gap-6">
                  <Link
                    href="/"
                    className="text-sm text-zinc-400 hover:text-white transition-colors"
                  >
                    New Game
                  </Link>
                  <Link
                    href="/stats"
                    className="text-sm text-zinc-400 hover:text-white transition-colors"
                  >
                    Career Stats
                  </Link>
                  <Link
                    href="/history"
                    className="text-sm text-zinc-400 hover:text-white transition-colors"
                  >
                    History
                  </Link>
                </div>
              </div>
            </div>
          </nav>
          <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
