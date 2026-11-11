/**
 * B: 근거 질의응답 화면의 순수 규칙 — 검토 보고서에서 물을 수 있는지, 질문 길이 검사, 답 본문의 [E1] 근거 표시 나누기,
 * 도구·코퍼스·쪽·출처 표기, 가정 결과 종류. 화면(src/features/qa/, 검토 보고서 화면)과 테스트(view.test.mjs)가 같이 쓴다.
 * 런타임 import는 두지 않는다. 답·근거·가정 결과는 BE 값을 그대로 그린다(BE app/agents/qa.py). 가정 결과와 그 근거는 공식 판정과 섞지 않는다.
 */
import type { CaseSummary, Corpus, JudgmentRunView, QaCitation, QaCitationSource, QaHypothesis } from "../api/types";

/** 질의응답이 근거로 삼는 최신 판단 — 판정이 났는지와 그 판정으로 만든 최신 보고서 버전. */
export type LatestJudgment = { judgmentVersion: number; decided: boolean; reportVersion: number | null };

/**
 * 최신 판단을 고른다. API 모드는 판단 조회(GET /cases/{id}/judgment)이고, report_version은 그 판단으로 만든 보고서의 최신 버전이다.
 * 견본 모드는 판단 견본이 판단 단계 사건에만 있어서, 판단 실행이 없으면 사건 요약(보드)의 버전·판정으로 고른다.
 */
export function latestJudgment(
  run: Pick<JudgmentRunView, "judgment_version" | "status" | "result" | "report_version"> | null,
  summary: Pick<CaseSummary, "task_status" | "judgment_status" | "versions"> | null,
): LatestJudgment | null {
  if (run) {
    return { judgmentVersion: run.judgment_version, decided: run.status === "completed" && run.result !== null, reportVersion: run.report_version };
  }
  if (!summary || summary.versions.judgment_version === null) return null;
  return {
    judgmentVersion: summary.versions.judgment_version,
    decided: summary.task_status === "completed" && summary.judgment_status !== null,
    reportVersion: summary.versions.report_version,
  };
}

/**
 * 검토 보고서 화면 오른쪽의 근거 질의응답 자리. BE는 최신 판단의 판정을 근거로 답하므로(판정 전이면 409 judgment_required)
 * 그 판정으로 만든 최신 보고서를 볼 때만 묻는다 — 지난 보고서 옆에서 물으면 화면의 보고서와 다른 판정으로 답할 수 있다.
 * reportVersion이 null이면 보고서를 보이지 않는 자리(/reports — 보고서 전)라 어긋날 보고서가 없어 판정만 났으면 묻는다.
 * not_latest의 latestReport가 null이면 최신 판정으로 만든 보고서가 없다(보고서 생성 실패) — 보고서 전 자리에서 묻는다.
 */
export type QaSlot =
  | { kind: "ready"; judgmentVersion: number }
  | { kind: "not_latest"; judgmentVersion: number; latestReport: number | null }
  | { kind: "undecided" };

export function qaSlot(latest: LatestJudgment | null, reportVersion: number | null): QaSlot {
  if (!latest || !latest.decided) return { kind: "undecided" };
  if (reportVersion !== null && latest.reportVersion !== reportVersion) {
    return { kind: "not_latest", judgmentVersion: latest.judgmentVersion, latestReport: latest.reportVersion };
  }
  return { kind: "ready", judgmentVersion: latest.judgmentVersion };
}

/** BE app/api/routes.py AskRequest — 1~2000자 */
export const QA_MAX_LENGTH = 2000;

/** 보내기 전에 막을 문제. 없으면 null */
export function questionProblem(text: string): string | null {
  if (!text.trim()) return "질문을 입력한다.";
  if (text.length > QA_MAX_LENGTH) return `질문은 ${QA_MAX_LENGTH}자까지다.`;
  return null;
}

export type AnswerPart = { kind: "text"; text: string } | { kind: "ref"; refs: string[] };

const REF_PATTERN = /\[\s*(E\d+(?:\s*,\s*E\d+)*)\s*\]/g;

/**
 * 답 본문을 글과 근거 표시([E1] · [E1, E3])로 나눈다. BE가 도구에 없던 표시는 이미 지웠지만,
 * 인용 목록(known)에 없는 표시가 섞이면 링크로 만들지 않고 글로 둔다.
 */
export function splitAnswer(answer: string, known: ReadonlySet<string>): AnswerPart[] {
  const parts: AnswerPart[] = [];
  let last = 0;
  for (const match of answer.matchAll(REF_PATTERN)) {
    const refs = match[1].split(",").map((ref) => ref.trim());
    if (!refs.every((ref) => known.has(ref))) continue;
    const start = match.index ?? 0;
    if (start > last) parts.push({ kind: "text", text: answer.slice(last, start) });
    parts.push({ kind: "ref", refs });
    last = start + match[0].length;
  }
  if (last < answer.length) parts.push({ kind: "text", text: answer.slice(last) });
  return parts;
}

/** BE QaToolName. 모르는 이름은 그대로 보인다 */
export const QA_TOOL_LABELS: Record<string, string> = {
  get_judgment_log: "판단 로그",
  search_dispute_cases: "결정례 검색",
  search_policy_terms: "약관 검색",
  simulate: "가정 실행",
};

export function toolLabel(name: string): string {
  return QA_TOOL_LABELS[name] ?? name;
}

export const QA_CORPUS_LABELS: Record<Corpus, string> = {
  fault_standards: "과실비율 인정기준",
  dispute_cases: "분쟁심의 결정례",
  policy_terms: "약관·보상 지침",
};

export function pagesLabel(citation: Pick<QaCitation, "page_start" | "page_end">): string {
  const { page_start: start, page_end: end } = citation;
  return start === end ? `${start}쪽` : `${start}–${end}쪽`;
}

/** 인용 근거의 출처 표기. 가정 실행의 근거는 공식 판정의 근거가 아니라서 가정 결과 상자와 같은 경고 톤으로 가른다. */
export const QA_SOURCE_LABELS: Record<QaCitationSource, string> = {
  official: "공식 판단 근거",
  search: "검색 결과",
  hypothesis: "가정 실행 근거",
};

/** 출처 배지 — 출처가 없는 예전 응답(BE #94 전)이나 모르는 값이면 그리지 않는다 */
export function citationSource(citation: Pick<QaCitation, "source">): { label: string; hypothetical: boolean } | null {
  const source = citation.source;
  if (!source || !(source in QA_SOURCE_LABELS)) return null;
  return { label: QA_SOURCE_LABELS[source], hypothetical: source === "hypothesis" };
}

/** 가정 결과 한 건의 종류 — 가정 판정이 났는지, 확인할 칸이 남아 멈췄는지, 실패했는지 */
export type HypothesisKind = "judged" | "needs_fields" | "failed";

export function hypothesisKind(hypothesis: QaHypothesis): HypothesisKind {
  if (hypothesis.status === "completed" && hypothesis.judgment_status) return "judged";
  if (hypothesis.status === "waiting_for_confirmation") return "needs_fields";
  return "failed";
}
