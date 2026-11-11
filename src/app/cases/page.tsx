/**
 * B: 담당 사건 — 요약 수치와 사건마다 한 줄인 보드(왼쪽 사건 칸, 오른쪽 접수·판단·검토 보고서 열 — src/features/cases/case-board.tsx).
 * 고정은 담당자 브라우저 쿠키라(src/features/cases/pin-source.ts) 이 화면은 요청마다 그린다. TODO: GET /cases 연결(src/features/cases/case-source.ts).
 */
import { CaseBoard } from "@/features/cases/case-board";
import { isSampleSource, listCases } from "@/features/cases/case-source";
import { getPinnedCaseIds } from "@/features/cases/pin-source";
import { Badge, Notice } from "@/ui/controls";

const SAMPLE_NOTE = "사건 조회 API 연결 전이라 src/fixtures/case-board.json의 합성 사건을 보여 준다. 운영 배포에서는 비어 있다.";

export default async function CasesPage() {
  const [cases, pinned] = await Promise.all([listCases(), getPinnedCaseIds()]);
  const sample = isSampleSource();
  return (
    <>
      {/* 보이는 제목은 두지 않는다 — 주 메뉴의 현재 탭이 대신한다. 사건은 담당자에게 배정돼 들어오므로 접수 버튼도 두지 않는다. 화면 낭독기용 제목만 남긴다. */}
      <h1 className="sr-only">담당 사건</h1>
      {!sample && cases.length === 0 && (
        <div className="mb-6">
          <Notice tone="info">담당 사건이 없다. 사건이 배정되면 여기에 보인다.</Notice>
        </div>
      )}
      {/* 견본은 큰 안내 대신 요약 줄 끝의 배지로만 알린다. 출처 설명은 배지에 마우스를 올리면 보인다. */}
      <CaseBoard
        cases={cases}
        pinned={pinned}
        summaryAside={
          sample && (
            <span title={SAMPLE_NOTE}>
              <Badge>합성 견본</Badge>
            </span>
          )
        }
      />
    </>
  );
}
