/**
 * A: 사건의 접수 화면 — 진행 단계 한 줄의 「접수」와 보드의 접수 열 사건이 여기로 온다. 단계와 상관없이 늘 같은 화면이다.
 * 머리(CaseHeader — 판단 · 검토 보고서 화면과 같은 모양) 아래에 영상 → 상태 한 줄 → 사건 정보 상자(CaseIntake)를 둔다.
 * 아직 영상 단계면 올리기 · 분석 중 · 실패이고, 분석이 끝난 사건은 올린 영상과 다음 단계 버튼이다.
 * 사건 요약은 견본 또는 BE GET /cases/{id}(case-source)로 읽어 새로고침해도 같은 상태로 그린다.
 */
import Link from "next/link";
import { CaseHeader } from "@/features/cases/case-header";
import { CaseIntake } from "@/features/cases/case-intake";
import { getCaseSummary, isSampleSource } from "@/features/cases/case-source";
import { getEvidence } from "@/features/facts/fact-source";
import { isBeforeCard } from "@/lib/cases/intake";

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
          담당 사건 목록에서 다시 골라 주세요. <span className="font-mono tabular-nums">{id}</span>
        </p>
      </div>
    );
  }

  // 분석이 끝난 영상 사건은 올린 영상 자리에 분석이 만든 미리보기 영상을 둔다(보기 주소 1시간 — 열 때마다 새로 읽는다).
  const evidence = summary.input_path === "video" && !isBeforeCard(summary.stage) ? await getEvidence(summary.case_id) : null;

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
          error: summary.analysis?.error ?? null,
          inputPath: summary.input_path,
          updatedAt: summary.updated_at,
          versions: summary.versions,
          videoUrl: evidence?.preview_url ?? null,
        }}
      />
    </>
  );
}
