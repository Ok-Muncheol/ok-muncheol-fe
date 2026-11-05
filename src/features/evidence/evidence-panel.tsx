/** C: 세 코퍼스 근거 표시 초안. TODO: 권한 있는 원문/페이지·선택/제외 이유 연결. */
import type { Corpus, EvidenceHit } from "../../lib/api/types";
const corpora: Record<Corpus, string> = {
  fault_standards: "과실 인정기준", dispute_cases: "분쟁심의 결정례", policy_terms: "약관·보상 지침",
};
export function EvidencePanel({ hits }: { hits: EvidenceHit[] }) {
  return <section aria-label="판단 근거"><h2>근거</h2>
    {hits.length === 0 && <p>확인된 근거 없음</p>}
    <ul>{hits.map(({ chunk }) => <li key={chunk.chunk_id}>
      {corpora[chunk.document.corpus]} · {chunk.parent_id} · {chunk.document.edition} ·
      {chunk.page_start}~{chunk.page_end}쪽
    </li>)}</ul>
  </section>;
}
