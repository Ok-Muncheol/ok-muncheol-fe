/** B 통합: 루트 레이아웃. 글꼴 · 색 토큰(globals.css) · 앱 틀(머리글)을 붙인다. TODO: 인증 상태 · 오류 경계. */
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import localFont from "next/font/local";
import { getCurrentProfile, isCurrentAdmin } from "@/features/profile/profile-source";
import { AppShell } from "@/ui/app-shell";
import { SIDEBAR_SCRIPT } from "@/ui/sidebar";
import "./globals.css";

// 본문 글꼴은 Pretendard 하나다(가변 굵기 45~920). 숫자는 tabular-nums로 자릿수를 맞춘다.
const pretendard = localFont({ src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2", weight: "45 920", variable: "--font-pretendard", display: "swap" });
// 사건 번호에만 쓴다.
const ibmPlexMono = IBM_Plex_Mono({ weight: ["400", "600"], subsets: ["latin"], variable: "--font-ibm-plex-mono" });

export const metadata: Metadata = {
  title: "OK문철",
  description: "AI 기반 자동차보험 보상 의사결정 지원 — 과실비율 검토 초안",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // /dev 메뉴는 운영 배포(VERCEL_ENV=production)에서 감춘다 — 페이지 자체도 notFound()다(src/app/dev/page.tsx).
  const showDev = process.env.VERCEL_ENV !== "production";
  // 머리글 오른쪽 담당자 이름. 로그인 전에는 개발 배포의 합성 견본만 있다.
  const [profile, showAdmin] = await Promise.all([getCurrentProfile(), isCurrentAdmin()]);
  return (
    // data-sidebar는 첫 그림 전에 SIDEBAR_SCRIPT가 붙인다(왼쪽 메뉴 접힘) — 서버 HTML과 달라도 되는 속성이라 경고를 끈다.
    <html lang="ko" className={`${pretendard.variable} ${ibmPlexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-page font-sans text-body text-ink antialiased">
        <AppShell showDev={showDev} showAdmin={showAdmin} accountName={profile?.name ?? null}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
