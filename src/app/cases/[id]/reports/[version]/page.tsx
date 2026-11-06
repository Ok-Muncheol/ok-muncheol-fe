/** D·B·C: 버전별 검토 초안. TODO: ReviewReport·JudgmentPanel·EvidencePanel 연결, 버전 비교·담당자 승인. */
export default async function ReportPage(props: PageProps<"/cases/[id]/reports/[version]">) {
  const { id, version } = await props.params;
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">
        사건 {id} · 검토 초안 v{version}
      </h1>
      <p className="mt-2 text-neutral-600">준비 중 — 판정 상태·근거·과실비율 초안과 승인 이력을 보여 줍니다.</p>
    </main>
  );
}
