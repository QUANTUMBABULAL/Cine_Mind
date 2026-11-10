import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CineMind — Story Exploration", template: "%s · CineMind" },
  description: "Explore fictional universes, characters, relationships, story events and character arcs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AuthProvider>
          <SiteHeader />
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
          <footer className="mt-8 border-t border-line/60 py-8 text-center text-xs text-muted">
            <p>
              <span className="heading text-sm">
                Cine<span className="text-accent">Mind</span>
              </span>{" "}
              2.0 · Next.js → Express → PostgreSQL · DBMS project
            </p>
            <p className="mt-1 text-muted/70">
              Posters and character images: Wikipedia, used for education. Sources in public/images/ATTRIBUTION.md.
            </p>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
