import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/language-context";

export const metadata: Metadata = {
  title: "INRA Ration Calculator — Calculateur de rations bovines",
  description:
    "Calculez les besoins nutritionnels (UFL & PDI) de vos vaches laitières selon le système INRA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
