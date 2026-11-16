/**
 * 사건 번호 — 사건 ID(UUID)는 앞 8자리만 보이고(caseNo), 마우스를 올리면 전체 ID가 보인다.
 * 사건 머리 · 사건 보드 · 접수 화면 사건 정보 · 구상 청구서 번호가 같이 쓴다. 주소·API에는 전체 ID를 그대로 넘긴다.
 */
import { caseNo } from "@/lib/cases/intake";

export function CaseNo({ id }: { id: string }) {
  const shown = caseNo(id);
  return (
    <span className="font-mono tabular-nums" title={shown === id ? undefined : id}>
      {shown}
    </span>
  );
}
