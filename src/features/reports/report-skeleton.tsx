/**
 * D 자리(구준휘 통합이 둠): 검토 보고서가 아직 없는 화면의 빈 보고서 본문. 보고서가 담을 칸(판정·검증 3겹·근거·과실비율·승인)을
 * 같은 순서로 늘어놓고 값은 비운다(Blank). 실제 본문(ReviewReport)을 붙이면 칸 이름과 순서를 함께 맞춘다. label은 머리 배지다.
 */
import { Badge, Blank, Card, DescriptionList, DescriptionRow } from "@/ui/controls";

const ITEMS = ["판정 상태", "적용 도표", "과실비율 A : B", "검증 3겹", "근거", "승인"] as const;

export function ReportSkeleton({ label }: { label: string }) {
  return (
    <Card title="보고서 본문" aside={<Badge dot>{label}</Badge>}>
      <DescriptionList>
        {ITEMS.map((item) => (
          <DescriptionRow key={item} term={item}>
            <Blank />
          </DescriptionRow>
        ))}
      </DescriptionList>
    </Card>
  );
}
