import type { Metadata } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

// latin-ext acoperă ș și ț cu virgulă dedesubt.
const firaSans = Fira_Sans({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], variable: "--font-fira-sans" });
const firaCode = Fira_Code({ subsets: ["latin", "latin-ext"], variable: "--font-fira-code" });

export const metadata: Metadata = {
  title: { default: "Mini ERP", template: "%s · Mini ERP" },
  description: "Comenzi, stocuri și clienți pentru un atelier de confecții metalice",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ro" className={`${firaSans.variable} ${firaCode.variable}`}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
