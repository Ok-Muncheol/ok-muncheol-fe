/** A: 카드 표시 초안. TODO: 영상/프레임·편집·매핑·이력·저장/확정·버전 충돌. */
import type { FactCard } from "../../lib/api/types";

export function FactCardPanel({ card }: { card: FactCard }) {
  return <section aria-label="사고 사실 카드">
    <h2>사고 사실 카드 · v{card.version}</h2>
    <p>{card.status === "confirmed" ? "담당자 확인 완료" : "담당자 확인 필요"}</p>
    <dl>{Object.entries(card.fields).map(([key, field]) => <div key={key}>
      <dt>{key}</dt><dd>{field.value == null ? "불명" : String(field.value)}</dd>
      <dd>모델 원값: {field.model_value == null ? "없음" : String(field.model_value)}</dd>
      <dd>모델 확신도: {field.model_confidence == null ? "해당 없음" : field.model_confidence}</dd>
      <dd>확인 상태: {field.verification_status}</dd>
    </div>)}</dl>
  </section>;
}
