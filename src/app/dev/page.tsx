/**
 * 전원·C 근거 미리보기: 개발 전용. 운영 배포에서는 열리지 않는다(합성 견본 화면이 운영에 노출되지 않게 — lumi /dev와 같은 방식).
 * src/fixtures/의 비식별 견본으로 화면을 미리 본다. 디자인 시스템(토큰·공통 컨트롤)은 운영에서도 여는 /design으로 옮겼다.
 * 담당 화면이 생기면 아래에 정상·불명·불일치·질문·보류·실패·버전 충돌 미리보기를 더한다.
 */
import { notFound } from "next/navigation";
import { CaseBoard } from "@/features/cases/case-board";
import sample from "@/fixtures/case-board.json";
import type { CaseSummary } from "@/lib/api/types";
import { ButtonLink, PageHeader } from "@/ui/controls";

export default function DevPage() {
  if (process.env.VERCEL_ENV === "production") notFound();

  return (
    <>
      <PageHeader
        eyebrow="개발 전용"
        title="개발 미리보기"
        description="합성 견본(src/fixtures/)으로 화면을 미리 본다. 운영 배포에서는 열리지 않는다."
        actions={
          <>
            <ButtonLink href="/design" variant="secondary">
              디자인 시스템
            </ButtonLink>
            <ButtonLink href="/dev/corpora" variant="secondary">
              코퍼스 미리보기
            </ButtonLink>
          </>
        }
      />
      <h2 className="mb-1 text-heading font-semibold">담당 사건 보드</h2>
      <p className="mb-3 text-caption text-ink-muted">
        사건마다 한 줄(접수 순)이고 카드는 그 사건이 있는 열(접수·판단·검토 보고서) 칸에만 놓인다. 카드의 굵은 글자는 그 안의 단계, 배지는 그 단계 안의 상태다(src/lib/cases/stages.ts). 손댈 사건은 카드 왼쪽 선이 warning이다. 고정 버튼은 /cases에만 있다. 견본은 src/fixtures/case-board.json.
      </p>
      <CaseBoard cases={sample.cases as CaseSummary[]} />
    </>
  );
}
