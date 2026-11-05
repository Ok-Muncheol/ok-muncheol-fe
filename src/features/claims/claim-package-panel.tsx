/** D: 구상 금액 표시 초안. TODO: 승인 게이트·필수 서류·PDF/JSON 다운로드 연결. */
import type { RecoveryAmounts } from "../../lib/api/types";
export function ClaimPackagePanel({ amounts }: { amounts: RecoveryAmounts | null }) {
  const money = (value: number | null) => value == null ? "미확정" : `${value.toLocaleString("ko-KR")}원`;
  return <section aria-label="구상 청구 패키지"><h2>구상 청구 패키지</h2>
    {amounts == null ? <p>작성 전</p> : <dl>
      <dt>구상 예정액</dt><dd>{money(amounts.planned)}</dd>
      <dt>실제 청구액</dt><dd>{money(amounts.claimed)}</dd>
      <dt>회수액</dt><dd>{money(amounts.recovered)}</dd>
      <dt>고객 자기부담금 검토액</dt><dd>{money(amounts.customer_deductible_review)}</dd>
    </dl>}
  </section>;
}
