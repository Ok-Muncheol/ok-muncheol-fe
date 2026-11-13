/**
 * B: 담당 사건 — 사건마다 한 줄인 진행 보드(왼쪽 사건, 오른쪽 접수·판단·검토 보고서를 지나는 진행 선 — src/features/cases/case-board.tsx).
 * 보기(단계 탭 · 정렬 · 확인 필요만)는 주소 검색어이고, 고정은 담당자 브라우저 쿠키라(src/features/cases/pin-source.ts) 이 화면은 요청마다 그린다. TODO: GET /cases 연결(src/features/cases/case-source.ts).
 */
import { CaseBoard } from "@/features/cases/case-board";
import { listCases } from "@/features/cases/case-source";
import { parseBoardView } from "@/lib/cases/stages";
import { getPinnedCaseIds } from "@/features/cases/pin-source";

export default async function CasesPage(props: PageProps<"/cases">) {
  const [cases, pinned, params] = await Promise.all([listCases(), getPinnedCaseIds(), props.searchParams]);
  // 사건은 담당자에게 배정돼 들어오므로 접수 버튼은 두지 않는다. 사건이 없으면 보드가 「배정된 사건이 없어요」를 보인다.
  return (
    <>
      <h1 className="mb-6 text-title font-bold tracking-tight">담당 사건</h1>
      <CaseBoard cases={cases} pinned={pinned} view={parseBoardView(params)} />
    </>
  );
}
