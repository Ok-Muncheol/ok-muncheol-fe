/**
 * A·B: 사건 작업 화면 — 사실 카드 확인부터 과실 비율 판단까지 한 화면이다(src/features/facts/case-workspace.tsx).
 * 위에는 영상(근거 장면)과 사실 카드, 아래 가운데에 떠 있는 버튼 하나(확인 완료 → 판단 중 → 과실 비율 보기), 그 아래 판단 결과.
 * 영상 분석이 끝나면 새 사건 화면이 여기로 넘어온다. 카드가 아직 없는 영상 사건은 분석 중 화면(/cases/[id])으로 보낸다.
 * 판단은 judgment-source(견본 또는 BE GET /cases/{id}/judgment), 카드는 fact-source(견본 또는 BE GET /cases/{id}/fact-card)로 읽고,
 * 저장·확정·판단 접수 뒤에는 다시 읽는다. 판정 · 과실은 BE 값만 그린다. 검증 3겹과 근거 질의응답은 검토 보고서 화면에 있다.
 * TODO: Realtime 변경 알림이 오면 다시 읽는다. TODO(A): 영상 재생(H.264 사본 재생 URL)·근거 장면 이미지, 수정 이력.
 */
import Link from "next/link";
import { CaseStepper } from "@/features/cases/case-stepper";
import { redirect } from "next/navigation";
import { getCaseSummary, isSampleSource } from "@/features/cases/case-source";
import { CaseWorkspace } from "@/features/facts/case-workspace";
import { getFactCard } from "@/features/facts/fact-source";
import { getLatestJudgmentRun } from "@/features/judgment/judgment-source";
import { caseTitle, isBeforeCard } from "@/lib/cases/intake";

export default async function JudgmentPage(props: PageProps<"/cases/[id]/judgment">) {
  const { id } = await props.params;
  const live = !isSampleSource();
  const [summary, { run, error }, card] = await Promise.all([getCaseSummary(id), getLatestJudgmentRun(id), getFactCard(id)]);
  const base = `/cases/${encodeURIComponent(id)}`;

  if (!card && summary?.input_path === "video" && isBeforeCard(summary.stage)) redirect(base);

  const title = caseTitle(card?.accident_date ?? summary?.accident_date);
  const back = (
    <Link href="/cases" className="text-caption text-ink-muted hover:text-ink">
      ← 담당 사건
    </Link>
  );

  if (!card) {
    return (
      <div className="mx-auto max-w-3xl">
        {back}
        <h1 className="mt-2 text-title font-bold">{summary ? title : "사건을 찾지 못했어요"}</h1>
        <p className="mt-4 text-body text-ink-muted">{summary ? "사실 카드를 불러오지 못했어요. 잠시 후 다시 열어 주세요." : "담당 사건 목록에서 다시 골라 주세요."}</p>
      </div>
    );
  }

  const hasVideo = summary ? summary.input_path === "video" : card.evidence_frames.length > 0;
  const reportVersion = run?.result && run.fact_card_version === card.version ? run.report_version : null;

  return (
    <>
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {back}
          {summary && <CaseStepper summary={summary} viewing="judgment" />}
        </div>
        <h1 className="mt-3 text-title font-bold tracking-tight break-keep">{title}</h1>
      </div>
      <CaseWorkspace
        // 카드·판단이 바뀌면(저장·확정·판단 뒤 다시 읽음) 고르던 값을 새 카드로 다시 시작한다.
        key={`${card.version}-${card.status}-${run?.task_id ?? "none"}-${run?.status ?? ""}`}
        caseId={id}
        live={live}
        hasVideo={hasVideo}
        card={card}
        run={run}
        loadError={error}
        reportHref={reportVersion !== null ? `${base}/reports/${reportVersion}` : null}
      />
    </>
  );
}
