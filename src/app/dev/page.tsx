/** 전원·C 근거 미리보기: 개발 전용 비식별 견본·상태별 화면 미리보기. 운영 배포에서는 열리지 않는다. */
import { notFound } from "next/navigation";

export default function DevPage() {
  // Vercel 운영 배포에서는 없는 페이지로 둔다 — 견본 화면이 운영에 노출되지 않게 한다 (lumi /dev와 같은 방식)
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">개발 미리보기</h1>
      <p className="mt-2 text-neutral-600">
        준비 중 — src/fixtures/의 비식별 견본으로 정상·불명·불일치·질문·보류·실패·버전 충돌 화면을 확인합니다.
      </p>
    </main>
  );
}
