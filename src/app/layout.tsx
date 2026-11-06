/** D 통합: 루트 레이아웃. TODO: 공통 UI(머리글·내비게이션)·인증 상태·오류 경계. */
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "옥문철",
  description: "AI 기반 자동차보험 보상 의사결정 지원 — 과실비율 검토 초안",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
