/**
 * A·B: 사실 카드가 아직 없는 화면의 빈 틀. 아직 오지 않은 단계(접수·영상 분석)거나, 지난 단계인데 카드를 읽지 못했을 때(합성 견본에 없음·조회 연결 전) 쓴다.
 * 실제 카드(FactCardPanel)와 같은 칸을 같은 순서로 늘어놓고 값은 비운다(Blank). 입력·저장·확정은 두지 않는다.
 */
import { CHART_FIELD_KEYS, fieldLabel } from "@/lib/api/chart-scope";
import { Card, DescriptionList, DescriptionRow, Blank } from "@/ui/controls";

export function FactCardSkeleton() {
  return (
    <Card title="사고 사실">
      <DescriptionList>
        {CHART_FIELD_KEYS.map((key) => (
          <DescriptionRow key={key} term={fieldLabel(key)}>
            <Blank />
          </DescriptionRow>
        ))}
      </DescriptionList>
    </Card>
  );
}
