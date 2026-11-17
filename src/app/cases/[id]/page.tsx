/**
 * A: 사건의 접수 화면 — 진행 단계 한 줄의 「접수」와 보드의 접수 열 사건이 여기로 온다. 단계와 상관없이 늘 같은 화면이다.
 * 머리(CaseHeader — 판단 · 검토 보고서 화면과 같은 모양) 아래에 영상 → 상태 한 줄 → 사건 정보 상자(CaseIntake)를 둔다.
 * 아직 영상 단계면 올리기 · 분석 중 · 실패(영상 없이 진행도 여기서)이고, 분석이 끝난 사건은 올린 영상과 다음 단계 버튼이다.
 * 영상 없이 진행한 사건은 다음 단계 버튼과 함께 영상을 올릴 칸을 둔다 — 카드가 영상으로 만든 것인지 카드를 읽어 가른다.
 * 사건 요약은 견본 또는 BE GET /cases/{id}(case-source)로 읽어 새로고침해도 같은 상태로 그린다.
 */
import Link from "next/link";
import { CaseNo } from "@/components/case-no";
import { CaseHeader } from "@/features/cases/case-header";
import { CaseIntake } from "@/features/cases/case-intake";
import { getCaseSummary, isSampleSource } from "@/features/cases/case-source";
import { getEvidence, getFactCard } from "@/features/facts/fact-source";
import { isBeforeCard } from "@/lib/cases/intake";
import { isFromVideo } from "@/lib/facts/card";
import { isDone } from "@/lib/cases/stages";

export default async function CasePage(props: PageProps<"/cases/[id]">) {
  const { id } = await props.params;
  const summary = await getCaseSummary(id);

  if (!summary) {
    return (
      <div className="max-w-3xl">
        <Link href="/cases" className="text-caption text-ink-muted hover:text-ink">
          ← 담당 사건
        </Link>
        <h1 className="mt-3 text-title font-bold tracking-tight">사건을 찾지 못했어요</h1>
        <p className="mt-2 text-body text-ink-muted">
          담당 사건 목록에서 다시 골라 주세요. <CaseNo id={id} />
        </p>
      </div>
    );
  }

  // 카드가 있는 사건은 올린 영상 자리에 분석이 만든 미리보기 영상을 둔다(보기 주소 1시간 — 열 때마다 새로 읽는다).
  // 카드에 영상 흔적이 없으면 영상 없이 진행한 사건이다. 카드를 못 읽으면 예전처럼 영상 사건으로 본다.
  const settled = !isBeforeCard(summary.stage);
  const [evidence, card] = settled ? await Promise.all([getEvidence(summary.case_id), getFactCard(summary.case_id)]) : [null, null];
  const hasVideo = Boolean(evidence?.preview_url) || (card ? isFromVideo(card) : true);

  return (
    <>
      <CaseHeader info={{ caseId: summary.case_id, accidentDate: summary.accident_date, assignedAt: summary.created_at }} progress={summary} viewing="intake" />
      <CaseIntake
        sample={isSampleSource()}
        existing={{
          caseId: summary.case_id,
          stage: summary.stage,
          accidentDate: summary.accident_date,
          assignedAt: summary.created_at,
          taskStatus: summary.task_status,
          approved: isDone(summary),
          error: summary.analysis?.error ?? null,
          updatedAt: summary.updated_at,
          versions: summary.versions,
          videoUrl: evidence?.preview_url ?? null,
          hasVideo,
        }}
      />
    </>
  );
}
