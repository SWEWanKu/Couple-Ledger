import type { Metadata } from "next";
import "animal-island-ui/style";
import "./globals.css";
import { IslandTransitionProvider } from "@/components/IslandTransitionProvider";

export const metadata: Metadata = {
  title: "Couple Ledger",
  description: "A desktop-first shared ledger skeleton for couples."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <IslandTransitionProvider>{children}</IslandTransitionProvider>
      </body>
    </html>
  );
}
