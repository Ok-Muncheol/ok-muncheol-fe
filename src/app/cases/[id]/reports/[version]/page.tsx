/** D·B·C: 버전별 검토 초안. TODO: ReviewReport·JudgmentPanel·EvidencePanel 연결, 버전 비교·담당자 승인. */
import { Badge, PageHeader } from "@/ui/controls";

export default async function ReportPage(props: PageProps<"/cases/[id]/reports/[version]">) {
  const { id, version } = await props.params;
  return (
    <PageHeader
      eyebrow={<span className="font-mono">{id}</span>}
      title={
        <>
          검토 초안 v{version} <Badge className="ml-2 align-middle">초안</Badge>
        </>
      }
      description="준비 중 — 판정 상태·근거·과실비율 초안과 승인 이력을 보여 줍니다."
    />
  );
}
