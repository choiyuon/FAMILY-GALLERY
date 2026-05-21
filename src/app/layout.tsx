import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, Noto_Serif_KR } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSerifKr = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-serif-kr",
  display: "swap",
});

const pretendardVar = "--font-pretendard";

export const metadata: Metadata = {
  title: "가족 갤러리",
  description: "우리 가족 사진과 영상",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${cormorant.variable} ${inter.variable} ${notoSerifKr.variable}`}
      style={{ [pretendardVar]: "Pretendard, sans-serif" } as React.CSSProperties}
    >
      <body>{children}</body>
    </html>
  );
}
