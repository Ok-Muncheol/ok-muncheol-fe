/**
 * A: 사실 카드 화면(사건 작업 화면 위쪽)의 순수 규칙 — 칸 순서·이름·보기, 상황에 맞는 칸, 칸 묶기, 당사자 이름, 저장 요청 모양.
 * 카드 v1(BE docs/contracts/fact-card-v1.md)의 A = 상대 차, B = 블랙박스(촬영) 차다. 화면은 A/B 대신 이 이름을 쓴다.
 * 도표 A/B(party_mapping.chart_party_*)는 카드 A/B와 다를 수 있다 — 과실 비율은 매핑으로 차 이름을 붙인다.
 * 확정할 수 있는지는 BE가 정한다. 여기서는 보여 주는 순서와 묶음만 정한다. 런타임 import는 두지 않는다.
 */
import type { FactCard, FactField, FactPatch, PartyMapping } from "../api/types";

type Fields = Record<string, FactField>;
type Value = FactField["value"];

/**
 * 화면 순서 — 장소 → 신호·도로 → 움직임 → 위치 → 그 밖.
 * 충돌 순간 신호·차로 노면표시·비보호 좌회전 표지(11/13)는 담당자 입력 칸이다 — 영상 카드는 비워(null + unverified) 보내고,
 * 판단이 그 칸으로 갈리는 도표를 볼 때 구분 질문으로 묻는다(BE docs/contracts/fact-card-v1.md).
 */
export const CARD_FIELD_ORDER = [
  "accident_type",
  "location_type",
  "signal_A",
  "signal_B",
  "collision_signal_A",
  "collision_signal_B",
  "unprotected_left_sign",
  "road_priority",
  "entry_order",
  "movement_A",
  "movement_B",
  "lane_marking_A",
  "lane_marking_B",
  "relative_position",
  "night",
  "collision_time_ms",
  "narrative",
] as const;

const LABELS: Record<string, string> = {
  accident_type: "사고 유형",
  location_type: "사고 장소",
  signal_A: "상대 차 신호",
  signal_B: "블랙박스 차 신호",
  collision_signal_A: "상대 차 충돌 순간 신호",
  collision_signal_B: "블랙박스 차 충돌 순간 신호",
  unprotected_left_sign: "비보호 좌회전 표지",
  road_priority: "도로 관계",
  entry_order: "교차로에 먼저 들어온 차",
  movement_A: "상대 차 움직임",
  movement_B: "블랙박스 차 움직임",
  lane_marking_A: "상대 차 차로 노면표시",
  lane_marking_B: "블랙박스 차 차로 노면표시",
  relative_position: "상대 차가 온 쪽",
  night: "밤낮",
  collision_time_ms: "충돌 시각",
  narrative: "사고 설명",
};

export function cardLabel(key: string): string {
  return LABELS[key] ?? key;
}

const MOVEMENT = { straight: "직진", left_turn: "좌회전", right_turn: "우회전", u_turn: "유턴", lane_change: "진로 변경", other: "그 밖" };
const SIGNAL = {
  green: "녹색",
  yellow: "황색",
  red: "적색",
  green_left_arrow: "녹색 좌회전",
  flashing_yellow: "황색 점멸",
  flashing_red: "적색 점멸",
  no_signal: "신호등 없음",
};
/** 그 차가 있던 차로의 방향 화살표. */
const LANE_MARKING = {
  left_only: "좌회전 전용",
  straight_left: "직진·좌회전",
  straight_only: "직진 전용",
  straight_right: "직진·우회전",
  right_only: "우회전 전용",
  none: "표시 없음",
};
/** 참거짓 칸 — 보기는 "true"/"false" 글자지만 카드 값은 bool이다(BE 카드 수정이 글자를 거절한다). */
const BOOL_KEYS: readonly string[] = ["night", "unprotected_left_sign"];

/** 칸별 보기(BE 값 → 화면 글자). 목록이 없는 칸(충돌 시각·사고 설명)은 없다. */
const OPTIONS: Record<string, Record<string, string>> = {
  accident_type: { car_to_car: "차 대 차", other: "그 밖(3대 이상 등)" },
  location_type: {
    signalized_intersection: "신호 있는 교차로",
    unsignalized_intersection: "신호 없는 교차로",
    roundabout: "회전교차로",
    straight_road: "직선 도로",
    highway: "고속도로",
    other: "주차장 등",
  },
  signal_A: SIGNAL,
  signal_B: SIGNAL,
  collision_signal_A: SIGNAL,
  collision_signal_B: SIGNAL,
  unprotected_left_sign: { true: "있음", false: "없음" },
  road_priority: {
    same_width: "폭이 같음",
    major_A: "상대 차 쪽이 대로",
    major_B: "블랙박스 차 쪽이 대로",
    stop_A: "상대 차 쪽 일시정지",
    stop_B: "블랙박스 차 쪽 일시정지",
    other: "한쪽만 신호등",
    none: "해당 없음",
  },
  entry_order: { first: "상대 차", second: "블랙박스 차", simultaneous: "동시에", none: "해당 없음" },
  movement_A: MOVEMENT,
  movement_B: MOVEMENT,
  lane_marking_A: LANE_MARKING,
  lane_marking_B: LANE_MARKING,
  relative_position: {
    left: "왼쪽에서",
    right: "오른쪽에서",
    opposite: "맞은편에서",
    same_direction_front: "같은 방향 앞",
    same_direction_rear: "같은 방향 뒤",
  },
  night: { false: "낮", true: "밤" },
};

/** 칸 하나의 보기. 구분 질문이 있으면 질문의 보기만 남긴다. */
export function cardOptions(key: string, only?: readonly string[]): [string, string][] {
  const all = Object.entries(OPTIONS[key] ?? {});
  return only ? all.filter(([value]) => only.includes(value)) : all;
}

/** 값 → 화면 글자. 모르는 값은 그대로, null은 "모름". */
export function cardValueLabel(key: string, value: Value): string {
  if (value === null) return "모름";
  if (key === "collision_time_ms" && typeof value === "number") return secondsText(value);
  return OPTIONS[key]?.[String(value)] ?? String(value);
}

/** 보기 값(문자열) → 카드 값. 밤낮·비보호 좌회전 표지는 참거짓이다. */
export function parseOption(key: string, raw: string): Value {
  if (BOOL_KEYS.includes(key)) return raw === "true";
  return raw;
}

/** 충돌 시각(ms) → "3.4초". */
export function secondsText(ms: number): string {
  return `${(ms / 1000).toFixed(1)}초`;
}

/** "3.4" 같은 초 입력 → ms. 비거나 읽을 수 없으면 null. */
export function parseSeconds(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) : null;
}

const SIGNALIZED_ONLY: readonly string[] = ["signal_A", "signal_B", "collision_signal_A", "collision_signal_B", "unprotected_left_sign"];

/**
 * 이 사고에 쓰이는 칸인지 — 신호(진입·충돌 순간)·비보호 좌회전 표지는 신호 있는 교차로에서만, 도로 관계·먼저 들어온 차는
 * 신호 없는 교차로에서만 본다. 장소를 모르면 모두 쓰는 칸으로 본다.
 */
export function isRelevant(key: string, locationType: Value): boolean {
  if (locationType === null) return true;
  if (SIGNALIZED_ONLY.includes(key)) return locationType === "signalized_intersection";
  if (key === "road_priority" || key === "entry_order") return locationType === "unsignalized_intersection";
  return true;
}

export type FieldGroups = { review: string[]; rest: string[]; unused: string[] };

/**
 * 칸 묶기 — review: 확인이 필요한 칸(BE needs_review, 구분 질문이 걸린 칸), rest: 나머지 쓰는 칸, unused: 이 사고와 상관없는 칸.
 * 확인이 필요한 칸은 상관없어 보여도 위에 둔다(BE가 확정을 막는다). 묶음은 원래 카드 상태로 정해 고르는 동안 칸이 움직이지 않는다.
 */
export function groupFields(original: Fields, draft: Fields, asked: readonly string[] = []): FieldGroups {
  const location = draft.location_type?.value ?? null;
  const keys = [...CARD_FIELD_ORDER.filter((k) => draft[k]), ...Object.keys(draft).filter((k) => !(CARD_FIELD_ORDER as readonly string[]).includes(k))];
  const review = keys.filter((k) => asked.includes(k) || original[k]?.verification_status === "needs_review");
  const others = keys.filter((k) => !review.includes(k));
  return { review, rest: others.filter((k) => isRelevant(k, location)), unused: others.filter((k) => !isRelevant(k, location)) };
}

/** 담당자가 값을 고른다 — 같은 값을 골라도 「확인함」이다(AI 값이 맞다는 답). 모델 원값은 그대로 둔다. */
export function pick(field: FactField, value: Value): FactField {
  return { ...field, value, verification_status: "human_confirmed" };
}

/** 확인이 아직 필요한 칸 — 담당자가 아직 고르지 않은 needs_review 칸. 0이어야 확인 완료를 누를 수 있다. */
export function remainingReview(draft: Fields): string[] {
  return Object.keys(draft).filter((k) => draft[k].verification_status === "needs_review");
}

/** 칸의 자동 정확도(vision_detail.eval.accuracy, 0~1). 없으면 null. */
export function fieldAccuracy(field: FactField): number | null {
  const accuracy = (field.vision_detail?.eval as { accuracy?: unknown } | undefined)?.accuracy;
  return typeof accuracy === "number" ? accuracy : null;
}

/** 담당자가 AI 값과 다르게 고쳤는지. */
export function differsFromModel(field: FactField): boolean {
  return field.source === "vision" && field.model_value !== null && String(field.model_value) !== String(field.value);
}

const same = (a: Value, b: Value) => (a === null || b === null ? a === b : String(a) === String(b));

export function sameMapping(a: PartyMapping, b: PartyMapping): boolean {
  return (
    a.chart_party_A_id === b.chart_party_A_id &&
    a.chart_party_B_id === b.chart_party_B_id &&
    a.insured_party_id === b.insured_party_id &&
    a.video_ego_party_id === b.video_ego_party_id
  );
}

/** 저장할 칸 — 값이나 확인 상태가 받은 카드와 다른 칸. */
export function changedFields(original: Fields, draft: Fields): string[] {
  return Object.keys(draft).filter((k) => {
    const before = original[k];
    const after = draft[k];
    return !before || !same(before.value, after.value) || before.verification_status !== after.verification_status;
  });
}

/** 저장 요청(PATCH) — 받은 카드 버전 기준, 바뀐 칸만. 매핑은 바뀌었을 때만 싣는다. 사유는 수정 이력에 남는다. */
export function buildCardPatch(card: Pick<FactCard, "version" | "fields" | "party_mapping">, draft: Fields, mapping: PartyMapping, reason: string): FactPatch {
  const fields = Object.fromEntries(changedFields(card.fields, draft).map((k) => [k, draft[k]]));
  return {
    expected_version: card.version,
    fields,
    ...(sameMapping(card.party_mapping, mapping) ? {} : { party_mapping: mapping }),
    reason: reason.trim(),
  } as FactPatch;
}

/**
 * 도표 A/B가 비어 있으면 카드 v1 계약의 기본값으로 채운다 — 영상 사건은 도표 A가 상대 차, 도표 B가 블랙박스 차다.
 * 상대 차 ID는 카드의 parties에서 블랙박스 차가 아닌 당사자다. 채울 수 없으면(당사자 목록 없음) 그대로 둔다.
 */
export function withDefaultChart(mapping: PartyMapping, parties: readonly { party_id: string }[] | undefined): PartyMapping {
  if (mapping.chart_party_A_id !== null || mapping.chart_party_B_id !== null) return mapping;
  const ego = mapping.video_ego_party_id;
  const other = parties?.find((p) => p.party_id !== ego)?.party_id ?? null;
  if (ego === null || other === null) return mapping;
  return { ...mapping, chart_party_A_id: other, chart_party_B_id: ego };
}

/** 도표 A/B 당사자의 화면 이름 — 블랙박스 차인지 상대 차인지, 가입자면 덧붙인다. */
export function chartPartyName(mapping: PartyMapping, side: "A" | "B"): string {
  const id = side === "A" ? mapping.chart_party_A_id : mapping.chart_party_B_id;
  if (id === null) return side === "A" ? "도표 A" : "도표 B";
  const car = mapping.video_ego_party_id !== null && id === mapping.video_ego_party_id ? "블랙박스 차" : "상대 차";
  return id === mapping.insured_party_id ? `${car}(가입자)` : car;
}

/** 도표 A·B를 맞바꾼 매핑. */
export function swapChartParties(mapping: PartyMapping): PartyMapping {
  return { ...mapping, chart_party_A_id: mapping.chart_party_B_id, chart_party_B_id: mapping.chart_party_A_id };
}

/** 가입자를 블랙박스 차 쪽(true)이나 상대 차 쪽(false)으로 둔 매핑. 상대 차 ID는 블랙박스 차가 아닌 도표 당사자다. */
export function setInsured(mapping: PartyMapping, insuredIsEgo: boolean): PartyMapping {
  const ego = mapping.video_ego_party_id;
  const other = [mapping.chart_party_A_id, mapping.chart_party_B_id].find((id) => id !== null && id !== ego) ?? null;
  return { ...mapping, insured_party_id: insuredIsEgo ? ego : other };
}

/** BE 메시지 속 카드 칸 이름(movement_A 등)을 화면 이름으로 바꾼다. */
export function readableMessage(message: string): string {
  return message.replace(
    /\b(accident_type|location_type|signal_[AB]|collision_signal_[AB]|unprotected_left_sign|road_priority|entry_order|movement_[AB]|lane_marking_[AB]|relative_position|night|collision_time_ms|narrative)\b/g,
    (key) => cardLabel(key),
  );
}
