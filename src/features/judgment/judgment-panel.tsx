/** B: 판정/검증 표시 초안. TODO: 작업 조회·재개·진행/판정 분리·근거 이동. */
import type { JudgmentResult } from "../../lib/api/types";
import { StatusLabel } from "../../components/status-label";

const layers = { evidence: "근거 체크", rebuttal: "반박 검토", numerical: "코드 계산 검증" };
export function JudgmentPanel({ result }: { result: JudgmentResult }) {
  return <section aria-label="판단 결과">
    <h2>판단 결과</h2><StatusLabel status={result.status} />
    <ul>{result.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
    <ul>{result.checks.map((check) => <li key={check.layer}>
      {layers[check.layer]}: {check.passed ? "통과" : "확인 필요"}
    </li>)}</ul>
  </section>;
}
