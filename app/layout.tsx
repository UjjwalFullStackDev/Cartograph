import {
  ClerkProvider,
  OrganizationSwitcher,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeSwitcher } from "@/components/theme-switcher";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cartograph",
  description: "Codebase dependency map",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('cartograph_theme') || 'system';
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var isDark = stored === 'dark' || (stored === 'system' && prefersDark);
                  var root = document.documentElement;
                  if (isDark) {
                    root.classList.add('dark');
                    root.setAttribute('data-theme', 'dark');
                  } else {
                    root.classList.remove('dark');
                    root.setAttribute('data-theme', 'light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="flex h-full flex-col bg-[var(--background)] text-[var(--foreground)] font-sans text-xs">
        <ClerkProvider>
          <header className="flex h-11 w-full shrink-0 items-center justify-between border-b border-zinc-200 px-3 bg-white/50 backdrop-blur-xs dark:border-zinc-800 dark:bg-zinc-950/50">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                cartograph
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">/</span>
              <Suspense fallback={<div className="h-6 w-24 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />}>
                <Show when="signed-in">
                  <OrganizationSwitcher
                    hidePersonal={true}
                    afterCreateOrganizationUrl="/"
                    afterLeaveOrganizationUrl="/"
                    afterSelectOrganizationUrl="/"
                    appearance={{
                      elements: {
                        rootBox: "flex items-center",
                        organizationSwitcherTrigger:
                          "flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors",
                      },
                    }}
                  />
                </Show>
              </Suspense>
            </div>

            <div className="flex items-center gap-2">
              <ThemeSwitcher />
              <Suspense fallback={null}>
                <Show when="signed-out">
                  <SignInButton mode="modal">
                    <button className="rounded px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                      Sign in
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="rounded bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
                      Sign up
                    </button>
                  </SignUpButton>
                </Show>
                <Show when="signed-in">
                  <UserButton
                    appearance={{
                      elements: {
                        userButtonAvatarBox: "h-6 w-6",
                      },
                    }}
                  />
                </Show>
              </Suspense>
            </div>
          </header>
          <div className="flex flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </ClerkProvider>
      </body>
    </html>
  );
}
