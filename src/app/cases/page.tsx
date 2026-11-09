/** B: 담당 사건 보드 — 요약 수치 + 아키텍처 단계별 열. TODO: GET /cases 연결(src/features/cases/case-source.ts). */
import { CaseBoard } from "@/features/cases/case-board";
import { isSampleSource, listCases } from "@/features/cases/case-source";
import { ButtonLink, Notice, PageHeader } from "@/ui/controls";

export default async function CasesPage() {
  const cases = await listCases();
  // 머리글 56px + 본문 여백 64px을 뺀 높이를 채워 보드 열이 화면 아래까지 닿게 한다.
  return (
    <div className="flex min-h-[calc(100dvh-7.5rem)] flex-col">
      <PageHeader
        title="담당 사건"
        description="단계별로 사건이 어디까지 왔는지 본다. 카드를 누르면 그 사건의 현재 단계 화면으로 간다."
        actions={<ButtonLink href="/cases/new">사건 접수</ButtonLink>}
      />
      {isSampleSource() ? (
        <div className="mb-6">
          <Notice tone="info" title="비식별 견본">
            사건 조회 API 연결 전이라 src/fixtures/case-board.json의 합성 사건을 보여 준다. 운영 배포에서는 비어 있다.
          </Notice>
        </div>
      ) : (
        cases.length === 0 && (
          <div className="mb-6">
            <Notice tone="info">담당 사건이 없다. 사건 접수에서 새 사건을 만든다.</Notice>
          </div>
        )
      )}
      <CaseBoard cases={cases} className="flex-1" />
    </div>
  );
}
