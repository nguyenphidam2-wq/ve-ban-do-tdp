import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"] });

export const metadata: Metadata = {
  title: "Vẽ bản đồ số Liên Chiểu | Hệ thống số hóa bản đồ",
  description: "Hệ thống số hóa bản đồ chuyên nghiệp địa bàn quận Liên Chiểu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
