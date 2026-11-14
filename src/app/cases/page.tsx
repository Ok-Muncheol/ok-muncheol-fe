/**
 * B: 담당 사건 — 사건마다 한 줄인 진행 보드(왼쪽 사건, 오른쪽 접수·판단·검토 보고서를 지나는 진행 선 — src/features/cases/case-board.tsx).
 * 보기(단계 탭 · 정렬 · 확인 필요만)는 주소 검색어이고, 고정은 담당자 브라우저 쿠키라(src/features/cases/pin-source.ts) 이 화면은 요청마다 그린다. TODO: GET /cases 연결(src/features/cases/case-source.ts).
 */
import { redirect } from "next/navigation";
import { CaseBoard } from "@/features/cases/case-board";
import { listCases } from "@/features/cases/case-source";
import { getCurrentProfile } from "@/features/profile/profile-source";
import { parseBoardView } from "@/lib/cases/stages";
import { getPinnedCaseIds } from "@/features/cases/pin-source";

export default async function CasesPage(props: PageProps<"/cases">) {
  const [cases, pinned, params, profile] = await Promise.all([listCases(), getPinnedCaseIds(), props.searchParams, getCurrentProfile()]);
  // 관리자에게는 사건이 배정되지 않아(BE는 담당자에게만 배정한다) 이 보드가 늘 빈다 — 사건 관제로 보낸다.
  // 로그인 전에 이 화면에서 로그인으로 간 관리자(?next=/cases)도 로그인 뒤 여기를 거쳐 사건 관제로 간다.
  if (profile?.staffRole === "admin") redirect("/admin");
  // 사건은 담당자에게 배정돼 들어오므로 접수 버튼은 두지 않는다. 사건이 없으면 보드가 「배정된 사건이 없어요」를 보인다.
  return (
    <>
      <h1 className="mb-6 text-title font-bold tracking-tight">담당 사건</h1>
      <CaseBoard cases={cases} pinned={pinned} view={parseBoardView(params)} />
    </>
  );
}
