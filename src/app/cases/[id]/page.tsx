/** A·B: 사건 상세. TODO: GET /cases/{id}로 진행 상태·확인 질문·현재 버전 복원(Realtime은 변경 알림만). */
import { PageHeader } from "@/ui/controls";

export default async function CasePage(props: PageProps<"/cases/[id]">) {
  const { id } = await props.params;
  return (
    <PageHeader
      eyebrow="담당 사건"
      title={<span className="font-mono">{id}</span>}
      description="준비 중 — 진행 상태·확인 질문·현재 버전을 요약합니다."
    />
  );
}
