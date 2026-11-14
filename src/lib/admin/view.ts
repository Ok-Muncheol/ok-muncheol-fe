/**
 * B 통합: 사건 관제 화면의 표시 규칙 — 단계·배정 방식·분야의 이름과 톤, 시각 표기, 주소 검색어.
 * 런타임 import는 두지 않는다 — 테스트(view.test.mjs)가 Node로 이 파일을 바로 읽는다.
 */
import type { AssignmentMethod, Coverage, IntakeFilter, IntakeStage, IntakeView, StaffMember } from "../api/types";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "model";

export const COVERAGE_LABELS: Record<Coverage, string> = { property: "대물", injury: "대인" };

/** 단계 이름과 톤. 미배정은 관리자가 손써야 하는 상태라 warning이다. */
export const STAGE_VIEW: Record<IntakeStage, { label: string; tone: Tone }> = {
  unassigned: { label: "미배정", tone: "warning" },
  intake: { label: "접수", tone: "neutral" },
  analysis: { label: "영상 분석", tone: "info" },
  facts: { label: "사실 카드", tone: "info" },
  judgment: { label: "판단", tone: "info" },
  report: { label: "검토 보고서", tone: "info" },
  done: { label: "종결", tone: "success" },
};
/** 현황 줄에 보이는 진행 단계 순서 */
export const OPEN_STAGES: IntakeStage[] = ["intake", "analysis", "facts", "judgment", "report"];

/** 배정 방식. 에이전트가 낸 배정만 model 톤이다(모델이 낸 값). */
export const METHOD_VIEW: Record<AssignmentMethod, { label: string; tone: Tone }> = {
  agent: { label: "AI 배정", tone: "model" },
  rule: { label: "규칙 배정", tone: "neutral" },
  manual: { label: "직접 배정", tone: "info" },
  transfer: { label: "이관", tone: "info" },
};

/** 목록 탭. 주소 검색어 state 값과 같다(전체는 값 없음). */
export const INTAKE_TABS: { key: "" | "open" | "unassigned" | "closed"; label: string }[] = [
  { key: "open", label: "진행 중" },
  { key: "unassigned", label: "미배정" },
  { key: "closed", label: "종결" },
  { key: "", label: "전체" },
];

/** BE 지역 값(17개 시·도) — app/schemas/admin.py Region과 같은 순서 */
export const REGIONS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

export type AdminView = { state: "" | "open" | "unassigned" | "closed"; region: string; assignee: string; before: string };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/** 주소 검색어 → 화면 보기. 모르는 값은 버린다. 처음 들어오면 진행 중 탭이다. */
export function parseAdminView(params: Record<string, string | string[] | undefined>): AdminView {
  const state = first(params.state);
  const region = first(params.region);
  return {
    state: params.state === undefined ? "open" : state === "open" || state === "unassigned" || state === "closed" ? state : "",
    region: REGIONS.includes(region) ? region : "",
    assignee: /^[0-9a-f-]{36}$/i.test(first(params.assignee)) ? first(params.assignee) : "",
    before: Number.isNaN(Date.parse(first(params.before))) ? "" : first(params.before),
  };
}

/** 화면 보기 → BE 목록 조건 */
export function intakeFilter(view: AdminView, limit: number): IntakeFilter {
  return {
    state: view.state || undefined,
    region: view.region || undefined,
    assignee_id: view.assignee || undefined,
    before: view.before || undefined,
    limit,
  };
}

/** 화면 보기 → /admin 주소. 바꿀 값만 넘기면 나머지는 그대로다. 탭·거르기를 바꾸면 쪽은 처음으로 돌아간다. */
export function adminHref(view: AdminView, change: Partial<AdminView> = {}): string {
  const next = { ...view, before: "", ...change };
  const query = new URLSearchParams();
  query.set("state", next.state);
  if (next.region) query.set("region", next.region);
  if (next.assignee) query.set("assignee", next.assignee);
  if (next.before) query.set("before", next.before);
  return `/admin?${query.toString()}`;
}

/** "11.14 15:02" — 한국 시간. BE가 +09:00으로 준 값을 그대로 자른다(브라우저 시간대와 무관하게 같은 글자). */
export function shortTime(iso: string | null): string {
  const match = iso?.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return match ? `${Number(match[1])}.${Number(match[2])} ${match[3]}:${match[4]}` : "";
}

/** 담당자 표시 이름 — 이름, 없으면 이메일 앞부분, 그것도 없으면 ID 앞 8자 */
export function staffName(member: Pick<StaffMember, "name" | "email" | "user_id"> | undefined, userId: string | null): string {
  if (!userId) return "";
  if (!member) return userId.slice(0, 8);
  return member.name || member.email?.split("@")[0] || member.user_id.slice(0, 8);
}

/** 그 분야에 줄 수 있는 담당자 — 접수 지역이 같은 사람을 앞에, 그 안에서는 진행 중 사건이 적은 순 */
export function assignable(staff: StaffMember[], coverage: Coverage, intake: Pick<IntakeView, "region">, current: string | null): StaffMember[] {
  return staff
    .filter((member) => member.staff_role === "adjuster" && member.coverage === coverage && member.user_id !== current)
    .sort(
      (a, b) =>
        Number(b.region === intake.region) - Number(a.region === intake.region) ||
        a.cases.open - b.cases.open ||
        staffName(a, a.user_id).localeCompare(staffName(b, b.user_id), "ko"),
    );
}

/** 대인 담당자가 필요한데 없는 접수 건(다친 사람이 있고 배정됐는데 대인 담당자가 비었다) */
export function needsInjuryAdjuster(intake: IntakeView): boolean {
  return intake.status === "assigned" && intake.stage !== "done" && intake.injured_count > 0 && !intake.injury_assignee_id;
}
