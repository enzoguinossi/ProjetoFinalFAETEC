import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AvisoProvider from "@/components/AvisoProvider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Nexus — Sistema Logístico",
  description: "Controle de Estoque e Logística de Entregas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        <AvisoProvider>{children}</AvisoProvider>
      </body>
    </html>
  );
}