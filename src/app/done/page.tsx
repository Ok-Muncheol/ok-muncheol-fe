/**
 * B 통합: 완료 사건 — 검토 보고서를 승인해 끝난 사건만 모아 본다. 담당 사건 보드(/cases)에는 승인한 사건이 보이지 않는다.
 * 보드와 같은 진행 선(src/features/cases/case-board.tsx)이고, 도구 줄에는 정렬만 있다(?sort=).
 */
import { CaseBoard } from "@/features/cases/case-board";
import { isSampleSource, listCases } from "@/features/cases/case-source";
import { getPinnedCaseIds } from "@/features/cases/pin-source";
import { parseBoardView } from "@/lib/cases/stages";
import { Badge } from "@/ui/controls";

export default async function DonePage(props: PageProps<"/done">) {
  const [cases, pinned, params] = await Promise.all([listCases(), getPinnedCaseIds(), props.searchParams]);
  const view = { ...parseBoardView(params), stage: "done" as const, turn: false };
  return (
    <>
      <h1 className="mb-6 text-title font-bold tracking-tight">완료 사건</h1>
      <CaseBoard
        cases={cases}
        pinned={pinned}
        view={view}
        aside={
          isSampleSource() && (
            <span className="mr-2">
              <Badge>합성 견본</Badge>
            </span>
          )
        }
      />
    </>
  );
}
