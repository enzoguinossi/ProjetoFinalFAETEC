import type { Metadata } from "next";
import "./globals.css";
import AvisoProvider from "@/components/AvisoProvider";

export const metadata: Metadata = {
  title: "Nexus — Sistema Logístico",
  description: "Controle de Estoque e Logística de Remessas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <AvisoProvider>{children}</AvisoProvider>
      </body>
    </html>
  );
}