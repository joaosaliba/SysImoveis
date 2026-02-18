import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SysImóveis — Gerenciamento de Aluguéis",
  description: "Sistema completo para gerenciamento de imóveis, inquilinos e contratos de aluguel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
