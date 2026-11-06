/** B 통합: 루트 레이아웃. 글꼴 · 색 토큰(globals.css) · 앱 틀(머리글)을 붙인다. TODO: 인증 상태 · 오류 경계. */
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Noto_Sans_KR } from "next/font/google";
import { AppShell } from "@/ui/app-shell";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({ subsets: ["latin"], variable: "--font-noto-sans-kr" });
// 사건 ID · 금액 · 버전처럼 자릿수를 맞춰 읽는 값에 쓴다.
const ibmPlexMono = IBM_Plex_Mono({ weight: ["400", "600"], subsets: ["latin"], variable: "--font-ibm-plex-mono" });

export const metadata: Metadata = {
  title: "옥문철",
  description: "AI 기반 자동차보험 보상 의사결정 지원 — 과실비율 검토 초안",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // /dev 메뉴는 운영 배포(VERCEL_ENV=production)에서 감춘다 — 페이지 자체도 notFound()다(src/app/dev/page.tsx).
  const showDev = process.env.VERCEL_ENV !== "production";
  return (
    <html lang="ko" className={`${notoSansKr.variable} ${ibmPlexMono.variable}`}>
      <body className="min-h-dvh bg-page font-sans text-body text-ink antialiased">
        <AppShell showDev={showDev}>{children}</AppShell>
      </body>
    </html>
  );
}
