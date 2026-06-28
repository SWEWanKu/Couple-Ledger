import type { Metadata } from "next";
import { PersistentPrivateNav } from "@/components/layout/PersistentPrivateNav";
import "animal-island-ui/style";
import "./globals.css";

export const metadata: Metadata = {
  title: "小岛账本",
  description: "只属于两个人的私密小岛账本。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <PersistentPrivateNav />
        {children}
      </body>
    </html>
  );
}
