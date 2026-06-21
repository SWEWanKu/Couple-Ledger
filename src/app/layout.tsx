import type { Metadata } from "next";
import "animal-island-ui/style";
import "./globals.css";
import { IslandTransitionProvider } from "@/components/IslandTransitionProvider";

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
        <IslandTransitionProvider>{children}</IslandTransitionProvider>
      </body>
    </html>
  );
}
