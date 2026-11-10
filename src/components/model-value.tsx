/**
 * 모델 원값·확신도 배지(model 톤). 사실 카드와 구분 질문이 같이 쓴다.
 * 원값은 담당자가 값을 고쳤을 때만 따로 적는다 — 같으면 지금 값이 곧 모델 값이다. 모델 값이 없는 칸(직접 입력·진술)은 그리지 않는다.
 * 배지 둘로 나눠 좁은 화면에서는 줄을 바꾼다. 부모가 flex-wrap이어야 한다.
 */
import { optionLabel } from "@/lib/api/chart-scope";
import type { FactField } from "@/lib/api/types";
import { Badge } from "@/ui/controls";

export function ModelValue({ fieldKey, field }: { fieldKey: string; field: FactField }) {
  if (field.model_value === null) return null;
  return (
    <>
      {String(field.model_value) !== String(field.value) && <Badge tone="model">모델 원값 {optionLabel(fieldKey, field.model_value)}</Badge>}
      {field.model_confidence !== null && (
        <Badge tone="model">
          <span>
            모델 확신도 <span className="font-mono tabular-nums">{field.model_confidence.toFixed(2)}</span>
          </span>
        </Badge>
      )}
    </>
  );
}
