/** B: 판단 진행·구분 질문·검증. TODO: JudgmentPanel·QuestionPanel 연결, 재판단·버전 충돌. */
import { PageHeader } from "@/ui/controls";

export default async function JudgmentPage(props: PageProps<"/cases/[id]/judgment">) {
  const { id } = await props.params;
  return (
    <PageHeader
      eyebrow={<span className="font-mono">{id}</span>}
      title="판단"
      description="준비 중 — 도표 검색·판단 진행, 구분 질문 답변, 검증 3겹 결과를 보여 줍니다."
    />
  );
}
