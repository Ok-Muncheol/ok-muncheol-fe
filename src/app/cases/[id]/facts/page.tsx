/** A·B: 영상·근거 프레임과 사실 카드. TODO: FactCardPanel·QuestionPanel 연결, 수동 입력·수정 이력·확정·버전 충돌. */
import { PageHeader } from "@/ui/controls";

export default async function FactsPage(props: PageProps<"/cases/[id]/facts">) {
  const { id } = await props.params;
  return (
    <PageHeader
      eyebrow={<span className="font-mono">{id}</span>}
      title="사실 카드"
      description="준비 중 — 영상·근거 프레임 옆에서 사실 카드를 확인하고 확정합니다."
    />
  );
}
