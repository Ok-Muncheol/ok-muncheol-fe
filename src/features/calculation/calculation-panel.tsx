/** D: 금액 표시 초안. TODO: 서류·약관 근거·입력/규칙 버전·재산정 연결. */
import type { CalculationResult } from "../../lib/api/types";
const states = { estimated: "추정", needs_documents: "자료 필요", confirmed: "확정" };
const money = (value: number | null) => value == null ? "미확정" : `${value.toLocaleString("ko-KR")}원`;
export function CalculationPanel({ result }: { result: CalculationResult | null }) {
  return <section aria-label="손해액·보험금"><h2>손해액·보험금</h2>
    {result == null ? <p>산정 전</p> : <>
      <p>{states[result.status]}</p><dl>
        <dt>인정 손해액</dt><dd>{money(result.recognized_damage)}</dd>
        <dt>보험금</dt><dd>{money(result.insurance_payment)}</dd>
        <dt>자기부담금</dt><dd>{money(result.deductible)}</dd>
      </dl>
    </>}
  </section>;
}
