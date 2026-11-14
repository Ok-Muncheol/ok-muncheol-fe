/**
 * B 통합: 사건 관제 화면의 표시 규칙 — 단계·배정 방식·분야의 이름과 톤, 시각 표기, 주소 검색어, 배정 참고 정보(금액 표기·표식)와 담당자 속성.
 * 런타임 import는 두지 않는다 — 테스트(view.test.mjs)가 Node로 이 파일을 바로 읽는다.
 */
import type {
  AssignmentMethod, Coverage, InjurySeverity, IntakeDetails, IntakeDetailsInput, IntakeFilter, IntakeStage, IntakeView, PersonalInjuryCover, Policy,
  Policyholder, Specialty, StaffMember, VehicleType,
} from "../api/types";

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

/* ---------- 배정 참고 정보(details) ---------- */

export const VEHICLE_LABELS: Record<VehicleType, string> = { passenger: "승용차", imported: "수입차", truck: "화물차", motorcycle: "이륜차" };
export const SEVERITY_LABELS: Record<InjurySeverity, string> = { minor: "경상", serious: "중상", fatal: "사망" };
export const PERSONAL_INJURY_LABELS: Record<PersonalInjuryCover, string> = { none: "미가입", self_injury: "자기신체사고", auto_injury: "자동차상해" };
export const SPECIALTY_LABELS: Record<Specialty, string> = { imported: "수입차", serious_injury: "중상해", multi_vehicle: "다중 추돌" };

/** 예상 손해액이 이 값(원) 이상이면 고액 대물 사건이다 — BE 배정 규칙과 같은 값 */
export const HIGH_VALUE_DAMAGE = 30_000_000;
/** 접수 폼에서 고르는 대물 한도(원). 서버 기본값은 2억이다 */
export const PROPERTY_LIMITS = [20_000_000, 50_000_000, 100_000_000, 200_000_000, 300_000_000, 500_000_000, 1_000_000_000, 2_000_000_000];
/** 서버가 가입 담보·계약자 이력에 넣는 기본값 — 접수 폼이 같은 값으로 시작한다 */
export const DEFAULT_POLICY: Policy = { bodily_injury_ii: true, property_limit: 200_000_000, own_damage: true, personal_injury: "self_injury", uninsured_motorist: true };
export const DEFAULT_POLICYHOLDER: Policyholder = { accidents_3y: 0, complaints: 0, long_term: false };

/** "1억 2,000만 원" · "3,500만 원" · "5,000원" — 억/만 원 표기. 만 원 아래는 만 원이 안 될 때만 보인다. 값이 없으면 빈 글자 */
export function won(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount) || amount < 0) return "";
  const eok = Math.floor(amount / 100_000_000);
  const man = Math.floor((amount % 100_000_000) / 10_000);
  const parts = [eok ? `${eok.toLocaleString("ko-KR")}억` : "", man ? `${man.toLocaleString("ko-KR")}만` : ""].filter(Boolean);
  return parts.length ? `${parts.join(" ")} 원` : `${Math.floor(amount).toLocaleString("ko-KR")}원`;
}

/** 참고 정보가 하나라도 있는가 — 예전 접수 건·실제 사건은 모든 칸이 null이다(BE가 details를 주기 전 응답이면 통째로 없다) */
export function hasDetails(details: IntakeDetails | null | undefined): details is IntakeDetails {
  return !!details && Object.values(details).some((value) => value != null);
}

/** 그 분야의 고액 사건인가 — 대물은 예상 손해액 3,000만 원 이상, 대인은 다친 정도가 중상·사망. 권한 있는 담당자에게만 자동 배정된다 */
export function highValueFor(details: IntakeDetails | null | undefined, coverage: Coverage): boolean {
  if (!details) return false;
  return coverage === "property"
    ? (details.estimated_damage ?? 0) >= HIGH_VALUE_DAMAGE
    : details.injury_severity === "serious" || details.injury_severity === "fatal";
}

export type DetailFlag = { key: "high_value" | "imported" | "multi_vehicle" | "no_bodily_injury_ii" | "complaints"; label: string; tone: Tone };

/** 목록에서 눈에 띄어야 하는 표식 — 고액 사건, 수입차, 다중 추돌(차량 3대 이상), 대인배상Ⅱ 미가입, 민원 2회 이상 */
export function detailFlags(details: IntakeDetails | null | undefined): DetailFlag[] {
  if (!details) return [];
  const flags: DetailFlag[] = [];
  if (highValueFor(details, "property") || highValueFor(details, "injury")) flags.push({ key: "high_value", label: "고액 사건", tone: "warning" });
  if (details.vehicle_type === "imported") flags.push({ key: "imported", label: "수입차", tone: "info" });
  if ((details.vehicle_count ?? 0) >= 3) flags.push({ key: "multi_vehicle", label: "다중 추돌", tone: "info" });
  if (details.policy && !details.policy.bodily_injury_ii) flags.push({ key: "no_bodily_injury_ii", label: "대인배상Ⅱ 미가입", tone: "warning" });
  if ((details.policyholder?.complaints ?? 0) >= 2) flags.push({ key: "complaints", label: `민원 ${details.policyholder?.complaints}회`, tone: "warning" });
  return flags;
}

/** 목록 한 줄 요약 — "예상 3,500만 원 · 수입차 3대 · 중상". 있는 값만 잇는다 */
export function detailSummary(details: IntakeDetails | null | undefined): string {
  if (!details) return "";
  const vehicle = [details.vehicle_type ? VEHICLE_LABELS[details.vehicle_type] : "", details.vehicle_count != null ? `${details.vehicle_type ? "" : "차량 "}${details.vehicle_count}대` : ""]
    .filter(Boolean)
    .join(" ");
  return [
    details.estimated_damage != null ? `예상 ${won(details.estimated_damage)}` : "",
    vehicle,
    details.injury_severity ? SEVERITY_LABELS[details.injury_severity] : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** 접수 폼이 쥐는 참고 정보 — 숫자 칸은 입력 글자 그대로 둔다(빈 칸 = 모름) */
export type DetailsDraft = {
  /** 예상 손해액(만 원) */
  damageManwon: string;
  vehicleType: VehicleType | "";
  vehicleCount: string;
  severity: InjurySeverity | "";
  policy: Policy;
  accidents3y: string;
  complaints: string;
  longTerm: boolean;
};

export const EMPTY_DETAILS_DRAFT: DetailsDraft = {
  damageManwon: "", vehicleType: "passenger", vehicleCount: "2", severity: "", policy: DEFAULT_POLICY, accidents3y: "0", complaints: "0", longTerm: false,
};

const whole = (text: string): number | null => (text.trim() === "" || !Number.isFinite(Number(text)) ? null : Math.round(Number(text)));

/** 폼 값 → 요청 details. 만 원을 원으로 바꾸고, 빈 칸은 null로, 다친 사람이 없으면 다친 정도는 보내지 않는다(서버가 422로 막는다) */
export function detailsInput(draft: DetailsDraft, injuredCount: number): IntakeDetailsInput {
  const damage = whole(draft.damageManwon);
  return {
    estimated_damage: damage == null ? null : damage * 10_000,
    vehicle_type: draft.vehicleType || null,
    vehicle_count: whole(draft.vehicleCount),
    injury_severity: injuredCount > 0 ? draft.severity || null : null,
    policy: draft.policy,
    policyholder: { accidents_3y: whole(draft.accidents3y) ?? 0, complaints: whole(draft.complaints) ?? 0, long_term: draft.longTerm },
  };
}

/* ---------- 담당자 속성 ---------- */

/** 전문 분야 이름 목록. BE가 속성을 주기 전 응답이면 빈 목록이다 */
export function specialtyLabels(member: Pick<StaffMember, "specialties">): string[] {
  return (member.specialties ?? []).map((specialty) => SPECIALTY_LABELS[specialty] ?? specialty);
}

/** 담당자 고르기 목록의 한 줄 — "김대물 · 서울 · 진행 중 3건 · 경력 7년 · 고액 권한 · 부재". 부재여도 고를 수 있다 */
export function staffOptionLabel(member: StaffMember): string {
  return [
    staffName(member, member.user_id),
    member.region ?? "지역 없음",
    `진행 중 ${member.cases.open}건`,
    member.career_years != null ? `경력 ${member.career_years}년` : "",
    member.high_value ? "고액 권한" : "",
    member.away ? "부재" : "",
    member.auto_assign ? "" : "자동 배정 제외",
  ]
    .filter(Boolean)
    .join(" · ");
}
