import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Orbitron } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Providers } from "./providers";
import "./globals.css";

// Inter is very similar to Suisse Intl (which is paid)
// Clean, modern sans-serif with excellent readability
const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Orbitron - Futuristic geometric font for branding
const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Flowsmith - Visual AI Workflow Builder",
  description: "Build powerful AI automations visually. Connect models, APIs, and data sources with drag-and-drop simplicity.",
  keywords: ["AI", "workflow", "automation", "GPT-4", "Claude", "visual builder"],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#06b6d4", // cyan-500
          colorBackground: "#101010", // custom dark
          colorInputBackground: "#18181b", // zinc-900
          colorInputText: "#fafafa", // zinc-50
          colorText: "#fafafa",
          colorTextSecondary: "#a1a1aa", // zinc-400
          borderRadius: "0.75rem",
          fontFamily: "var(--font-geist-sans)",
        },
        elements: {
          formButtonPrimary:
            "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border-2 border-blue-500/50 hover:border-blue-500/70 rounded-xl font-bold transition-all",
          card: "bg-zinc-900/80 backdrop-blur-xl border border-white/10 shadow-2xl",
          headerTitle: "text-2xl font-bold text-white",
          headerSubtitle: "text-zinc-400",
          socialButtonsBlockButton:
            "bg-zinc-800/50 border border-white/10 hover:bg-zinc-800 hover:border-white/20 text-white",
          socialButtonsBlockButtonText: "text-zinc-300 font-medium",
          dividerLine: "bg-white/10",
          dividerText: "text-zinc-500",
          formFieldLabel: "text-zinc-300 font-medium",
          formFieldInput:
            "bg-zinc-800/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-cyan-500/50 focus:ring-cyan-500/20",
          footerActionLink: "text-cyan-400 hover:text-cyan-300",
          identityPreviewText: "text-white",
          identityPreviewEditButton: "text-cyan-400 hover:text-cyan-300",
          formResendCodeLink: "text-cyan-400 hover:text-cyan-300",
          otpCodeFieldInput: "bg-zinc-800/50 border-white/10 text-white",
          alternativeMethodsBlockButton: "text-cyan-400 hover:text-cyan-300",
        },
      }}
    >
      <html lang="en" className="dark" suppressHydrationWarning>
        <head>
          {/* Theme initialization script - prevents flash of wrong theme */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  try {
                    var theme = localStorage.getItem('theme');
                    if (theme === 'light' || theme === 'dark') {
                      document.documentElement.classList.remove('light', 'dark');
                      document.documentElement.classList.add(theme);
                    }
                  } catch (e) {}
                })();
              `,
            }}
          />
        </head>
        <body
          className={`${inter.variable} ${jetbrainsMono.variable} ${orbitron.variable} antialiased bg-gray-100 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100`}
        >
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
