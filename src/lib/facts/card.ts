/**
 * A: 사실 카드 화면(사건 작업 화면 위쪽)의 순수 규칙 — 칸 순서·이름·보기, 상황에 맞는 칸, 칸 묶기, 당사자 이름, 저장 요청 모양.
 * 카드 v1(BE docs/contracts/fact-card-v1.md)의 A = 상대 차, B = 블랙박스(촬영) 차다. 화면은 A/B 대신 이 이름을 쓴다.
 * 영상 없이 진행한 카드는 가입자 차를 카드 B 자리에 두므로(BE blank_card) 그 카드의 B는 「가입자 차」라고 부른다(egoName).
 * 도표 A/B(party_mapping.chart_party_*)는 카드 A/B와 다를 수 있다 — 과실 비율은 매핑으로 차 이름을 붙인다.
 * 확정할 수 있는지는 BE가 정한다. 여기서는 보여 주는 순서와 묶음만 정한다. 런타임 import는 두지 않는다.
 */
import type { FactCard, FactField, FactPatch, PartyMapping } from "../api/types";

type Fields = Record<string, FactField>;
type Value = FactField["value"];

/**
 * 화면 순서 — 장소 → 신호·도로(교차로) → 회전교차로 → 움직임 → 위치 → 차 종류 → 도로 상황 → 그 밖.
 * 충돌 순간 신호·차로 노면표시·비보호 좌회전 표지(11/13)는 담당자 입력 칸이다 — 영상 카드는 비워(null + unverified) 보내고,
 * 판단이 그 칸으로 갈리는 도표를 볼 때 구분 질문으로 묻는다(BE docs/contracts/fact-card-v1.md).
 * 11/16 교차로 밖 도표(차31~61) 칸 22개도 같다. 이륜차·긴급자동차는 영상 AI 2단계 전까지, 나머지는 늘 담당자 입력 칸이다(BE #239).
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
  "roundabout_lanes",
  "roundabout_move_A",
  "roundabout_move_B",
  "roundabout_lane_A",
  "roundabout_lane_B",
  "movement_A",
  "movement_B",
  "lane_marking_A",
  "lane_marking_B",
  "relative_position",
  "two_wheeler_A",
  "two_wheeler_B",
  "emergency_vehicle_A",
  "emergency_vehicle_B",
  "center_line_crossing_A",
  "center_line_crossing_B",
  "door_open_A",
  "door_open_B",
  "overtake_line",
  "u_turn_zone",
  "u_turn_timing",
  "lane_change_timing",
  "lane_reduction",
  "shoulder",
  "traffic_jam",
  "secondary_collision",
  "bus_stop",
  "safety_zone",
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
  roundabout_lanes: "회전 차로 수",
  roundabout_move_A: "상대 차 회전교차로 진행",
  roundabout_move_B: "블랙박스 차 회전교차로 진행",
  roundabout_lane_A: "상대 차 회전 차로",
  roundabout_lane_B: "블랙박스 차 회전 차로",
  two_wheeler_A: "상대 차 이륜차 여부",
  two_wheeler_B: "블랙박스 차 이륜차 여부",
  emergency_vehicle_A: "상대 차 긴급자동차(긴급 운행) 여부",
  emergency_vehicle_B: "블랙박스 차 긴급자동차(긴급 운행) 여부",
  center_line_crossing_A: "상대 차 중앙선 침범",
  center_line_crossing_B: "블랙박스 차 중앙선 침범",
  door_open_A: "상대 차 문 열림",
  door_open_B: "블랙박스 차 문 열림",
  overtake_line: "추월한 곳 차선",
  u_turn_zone: "유턴 구역",
  u_turn_timing: "뒤차 유턴 시점",
  lane_change_timing: "두 차 진로 변경 순서",
  lane_reduction: "차로 감소(합류)",
  shoulder: "갓길·도로 가장자리",
  traffic_jam: "정체",
  secondary_collision: "앞차가 사고로 정차 중(2차 사고)",
  bus_stop: "버스정류장",
  safety_zone: "안전지대 통과",
  night: "밤낮",
  collision_time_ms: "충돌 시각",
  narrative: "사고 설명",
};

/** 카드 B(1인칭 영상의 촬영 차 자리) 차의 화면 이름 — 영상 카드는 블랙박스 차, 영상 없이 진행한 카드는 가입자 차다. */
export type EgoName = "블랙박스 차" | "가입자 차";
const VIDEO_EGO: EgoName = "블랙박스 차";

/** 영상 분석으로 만든 카드인가 — 근거 장면이나 영상 분석 칸(출처 vision)이 있다. 담당자가 칸을 고쳐도 근거 장면은 남는다. */
export function isFromVideo(card: Pick<FactCard, "fields" | "evidence_frames">): boolean {
  return card.evidence_frames.length > 0 || Object.values(card.fields).some((f) => f.source === "vision");
}

/** 그 카드의 카드 B 차 이름. */
export function egoName(card: Pick<FactCard, "fields" | "evidence_frames">): EgoName {
  return isFromVideo(card) ? VIDEO_EGO : "가입자 차";
}

/** 표에 적어 둔 「블랙박스 차」를 그 카드의 카드 B 이름으로 바꾼다. */
function named(text: string, ego: EgoName): string {
  return ego === VIDEO_EGO ? text : text.replaceAll(VIDEO_EGO, ego);
}

export function cardLabel(key: string, ego: EgoName = VIDEO_EGO): string {
  return named(LABELS[key] ?? key, ego);
}

const MOVEMENT = {
  straight: "직진",
  left_turn: "좌회전",
  right_turn: "우회전",
  u_turn: "유턴",
  lane_change: "진로 변경",
  stopped: "정차·주정차",
  starting: "정차 후 출발",
  reversing: "후진",
  overtaking: "추월",
  entering_road: "도로 밖에서 진입",
  leaving_road: "도로 밖으로 진출",
  parking_out: "주차구획에서 출차",
  parking_in: "주차구획으로 진입",
  other: "그 밖",
};
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
const BOOL_KEYS: readonly string[] = [
  "night",
  "unprotected_left_sign",
  "two_wheeler_A",
  "two_wheeler_B",
  "emergency_vehicle_A",
  "emergency_vehicle_B",
  "center_line_crossing_A",
  "center_line_crossing_B",
  "door_open_A",
  "door_open_B",
  "lane_reduction",
  "shoulder",
  "traffic_jam",
  "secondary_collision",
  "bus_stop",
];
/** 11/16 참거짓 칸 보기 — 칸 이름이 무엇을 묻는지 말하므로 예·아니요다. */
const YES_NO = { true: "예", false: "아니요" };
const ROUNDABOUT_MOVE = { circulating: "회전 중", entering: "진입", exiting: "진출하려고 진로 변경" };
const ROUNDABOUT_LANE = { inner: "회전 1차로(안쪽)", outer: "회전 2차로 이상(바깥쪽)" };

/** 칸별 보기(BE 값 → 화면 글자). 목록이 없는 칸(충돌 시각·사고 설명)은 없다. */
const OPTIONS: Record<string, Record<string, string>> = {
  accident_type: { car_to_car: "차 대 차", other: "그 밖(3대 이상 등)" },
  location_type: {
    signalized_intersection: "신호 있는 교차로",
    unsignalized_intersection: "신호 없는 교차로",
    roundabout: "회전교차로",
    straight_road: "직선 도로",
    highway: "고속도로",
    parking_lot: "주차장",
    other: "그 밖(차도 아닌 곳 등)",
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
  // 계약 v1 4절(11/13): 같은 방향 옆 차로에서 나란히 가던 차는 같은 방향 앞/뒤이고, 왼쪽·오른쪽은 옆 도로에서 가로질러 들어온 차만이다.
  relative_position: {
    left: "왼쪽 도로에서",
    right: "오른쪽 도로에서",
    opposite: "맞은편에서",
    same_direction_front: "같은 방향 앞(옆 차로 포함)",
    same_direction_rear: "같은 방향 뒤(옆 차로 포함)",
  },
  night: { false: "낮", true: "밤" },
  roundabout_lanes: { one: "1차로", two_plus: "2차로 이상" },
  roundabout_move_A: ROUNDABOUT_MOVE,
  roundabout_move_B: ROUNDABOUT_MOVE,
  roundabout_lane_A: ROUNDABOUT_LANE,
  roundabout_lane_B: ROUNDABOUT_LANE,
  two_wheeler_A: YES_NO,
  two_wheeler_B: YES_NO,
  emergency_vehicle_A: YES_NO,
  emergency_vehicle_B: YES_NO,
  center_line_crossing_A: YES_NO,
  center_line_crossing_B: YES_NO,
  door_open_A: YES_NO,
  door_open_B: YES_NO,
  overtake_line: {
    yellow_solid: "황색 실선",
    yellow_dashed: "황색 점선",
    white_solid: "흰색 실선",
    no_passing_zone: "앞지르기 금지 장소",
    none: "차선 없음",
  },
  u_turn_zone: { always: "상시 유턴 구역", signal: "신호 유턴", none: "유턴 구역 아님" },
  u_turn_timing: { sudden: "급 유턴", simultaneous: "동시 유턴" },
  // BE #261: 두 차 모두 진로변경일 때(차43-3 동시, 43-5 뒤차 먼저). 앞차 먼저는 도표가 없어 고르면 보류된다
  lane_change_timing: { simultaneous: "양옆 차로에서 동시에", follower_first: "같은 차로 뒤차가 먼저", leader_first: "같은 차로 앞차가 먼저" },
  lane_reduction: YES_NO,
  shoulder: YES_NO,
  traffic_jam: YES_NO,
  secondary_collision: YES_NO,
  bus_stop: YES_NO,
  safety_zone: { before_leaving: "안전지대 벗어나기 전", after_leaving: "안전지대 벗어난 뒤", none: "안전지대 없음" },
};

/** 칸 하나의 보기. 구분 질문이 있으면 질문의 보기만 남긴다. */
export function cardOptions(key: string, only?: readonly string[], ego: EgoName = VIDEO_EGO): [string, string][] {
  const all = Object.entries(OPTIONS[key] ?? {}).map(([value, label]): [string, string] => [value, named(label, ego)]);
  return only ? all.filter(([value]) => only.includes(value)) : all;
}

/** 값 → 화면 글자. 모르는 값은 그대로, null은 "모름". */
export function cardValueLabel(key: string, value: Value, ego: EgoName = VIDEO_EGO): string {
  if (value === null) return "모름";
  if (key === "collision_time_ms" && typeof value === "number") return secondsText(value);
  return named(OPTIONS[key]?.[String(value)] ?? String(value), ego);
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
const ROUNDABOUT_ONLY: readonly string[] = ["roundabout_lanes", "roundabout_move_A", "roundabout_move_B", "roundabout_lane_A", "roundabout_lane_B"];
/** 일반 도로·고속도로 도표(차31~55)를 가르는 상황 칸. */
const ROAD_ONLY: readonly string[] = [
  "center_line_crossing_A",
  "center_line_crossing_B",
  "door_open_A",
  "door_open_B",
  "overtake_line",
  "u_turn_zone",
  "u_turn_timing",
  "lane_change_timing",
  "lane_reduction",
  "shoulder",
  "secondary_collision",
  "bus_stop",
  "safety_zone",
];
const ROADS: readonly string[] = ["straight_road", "highway"];

/**
 * 이 사고에 쓰이는 칸인지 — 신호(진입·충돌 순간)·비보호 좌회전 표지는 신호 있는 교차로에서만, 도로 관계·먼저 들어온 차는
 * 신호 없는 교차로에서만, 회전교차로 칸은 회전교차로에서만, 중앙선 침범·추월 차선·갓길 같은 도로 상황 칸은 일반 도로·고속도로에서만 본다.
 * 정체는 도로와 신호 없는 교차로(차61-1)에서, 이륜차·긴급자동차는 어디서나 본다. 장소를 모르면 모두 쓰는 칸으로 본다.
 */
export function isRelevant(key: string, locationType: Value): boolean {
  if (locationType === null) return true;
  if (SIGNALIZED_ONLY.includes(key)) return locationType === "signalized_intersection";
  if (key === "road_priority" || key === "entry_order") return locationType === "unsignalized_intersection";
  if (ROUNDABOUT_ONLY.includes(key)) return locationType === "roundabout";
  if (ROAD_ONLY.includes(key)) return ROADS.includes(String(locationType));
  if (key === "traffic_jam") return ROADS.includes(String(locationType)) || locationType === "unsignalized_intersection";
  return true;
}

export type FieldGroups = { review: string[]; rest: string[]; manual: string[]; unused: string[] };

/**
 * 칸 묶기 — 화면은 두 묶음이다. rest: AI가 채운 값(영상 분석 칸이 없는 카드면 담당자가 채운 값), manual: 담당자 입력 칸,
 * unused: 이 사고와 상관없는 칸(접어 둔다). review는 따로 빼는 묶음이 아니라 표시다 — 확인이 필요한 칸(BE needs_review, 구분 질문이 걸린 칸)은
 * 자기 묶음 안에서 맨 앞에 두고(그 안에서는 카드 칸 순서) 화면이 표시한다. 확인할 칸은 상관없어 보여도 unused로 접지 않는다(BE가 확정을 막는다).
 * manual은 영상 카드에서 비전이 채우지 않는 칸(충돌 순간 신호 · 차로 노면표시 · 비보호 좌회전 표지, 카드 v1 — 출처 manual)이다.
 * 확정을 막지 않는 선택 칸이라 AI가 채운 값과 섞지 않는다. 영상 분석 칸이 없는 카드(모든 칸이 manual)는 rest다.
 * 확인이 필요한 칸은 상관없어 보여도 위에 둔다(BE가 확정을 막는다). 묶음은 원래 카드 상태로 정해 고르는 동안 칸이 움직이지 않는다.
 * 구분 질문이 걸린 칸은 카드에 없어도 줄을 둔다 — 11/16 전에 만든 영상 카드에는 그날 생긴 칸(합류·갓길·정체 등)이 없는데, 판단은 그 칸을 묻는다.
 * 그런 칸은 담당자 입력 칸으로 묶고 빈 칸(emptyField)으로 그린다. BE 카드 수정은 없던 칸도 받는다(apply_patch).
 */
export function groupFields(original: Fields, draft: Fields, asked: readonly string[] = []): FieldGroups {
  const location = draft.location_type?.value ?? null;
  const present = new Set([...Object.keys(draft), ...asked]);
  const order = CARD_FIELD_ORDER as readonly string[];
  const keys = [...order.filter((k) => present.has(k)), ...[...present].filter((k) => !order.includes(k))];
  const review = keys.filter((k) => asked.includes(k) || original[k]?.verification_status === "needs_review");
  const fromVideo = keys.some((k) => original[k]?.source === "vision");
  const isManual = (k: string) => fromVideo && (original[k]?.source ?? "manual") === "manual";
  // 확인할 칸을 앞에 — 묶음은 원래 카드 상태로 정하므로 고른 뒤에도 칸이 움직이지 않는다.
  const used = [...review, ...keys.filter((k) => !review.includes(k) && isRelevant(k, location))];
  return {
    review,
    rest: used.filter((k) => !isManual(k)),
    manual: used.filter(isManual),
    unused: keys.filter((k) => !used.includes(k)),
  };
}

/** 담당자가 값을 고른다 — 같은 값을 골라도 「확인함」이다(AI 값이 맞다는 답). 모델 원값은 그대로 둔다. */
export function pick(field: FactField, value: Value): FactField {
  return { ...field, value, verification_status: "human_confirmed" };
}

/** 카드에 없는 칸의 빈 담당자 칸 — BE 카드 수정이 없던 칸을 만들 때와 같은 모양(apply_patch)이다. */
export function emptyField(): FactField {
  return {
    value: null,
    model_value: null,
    source: "manual",
    model_confidence: null,
    verification_status: "unverified",
    evidence_frame_ids: [],
    source_document_ids: [],
  };
}

/**
 * 값으로 답한 구분 질문(칸 → 답 글자, answeredValues)을 카드 칸에 미리 채운다 — 확인 완료 때 카드에 반영·재확정한다.
 * 답 글자는 칸 값으로 바꾼다(참거짓 칸은 true/false — BE 카드 수정은 글자 "true"를 받지 않는다). 카드에 없던 칸은 빈 담당자 칸에서 채운다.
 */
export function withAnswers(fields: Fields, answers: Record<string, string>): Fields {
  return { ...fields, ...Object.fromEntries(Object.entries(answers).map(([key, raw]) => [key, pick(fields[key] ?? emptyField(), parseOption(key, raw))])) };
}

/**
 * 「초기화」 — 고른 값을 한 번에 되돌린다. 확정 전 카드는 받은 카드 그대로(AI가 채운 값·상태)로,
 * 확정한 카드는 AI 원값(model_value)으로 되돌리고 확인을 지워(unverified) 다시 고르게 한다. 담당자 입력 칸은 비운다.
 */
export function resetFields(card: Pick<FactCard, "fields" | "status">): Fields {
  if (card.status !== "confirmed") return { ...card.fields };
  return Object.fromEntries(
    Object.entries(card.fields).map(([key, f]) => [
      key,
      { ...f, value: f.source === "manual" ? null : (f.model_value ?? f.value), verification_status: "unverified" as const },
    ]),
  );
}

/**
 * 담당자가 직접 골라야 하는 칸 — AI가 값을 채우지 못한(모름) needs_review 칸. 0이어야 확정을 누를 수 있다.
 * AI가 값을 채운 needs_review 칸은 화면이 그 값을 미리 골라 두고, 확정할 때 그 값으로 확인한다(acceptAiValues).
 */
export function remainingReview(draft: Fields): string[] {
  return Object.keys(draft).filter((k) => draft[k].verification_status === "needs_review" && draft[k].value === null);
}

/**
 * 확정할 때 미리 골라 둔 AI 값을 확인으로 넘긴다 — 값이 있는 needs_review 칸을 그 값 그대로 확인함(pick)으로 바꾼다.
 * BE는 needs_review 칸이 남으면 확정을 막고, 표시 없는 칸(unverified)은 확정하면 스스로 확인함으로 바꾼다(카드 v1 9절).
 * 값이 없는(모름) 칸은 그대로 둔다 — 담당자가 골라야 한다(remainingReview).
 */
export function acceptAiValues(draft: Fields): Fields {
  return Object.fromEntries(
    Object.entries(draft).map(([key, f]) => [key, f.verification_status === "needs_review" && f.value !== null ? pick(f, f.value) : f]),
  );
}

/** 확정한 카드의 칸 — BE 확정처럼 값이 있는 칸은 모두 확인함이다(카드 v1 9절). 견본 모드가 BE 대신 쓴다. */
export function confirmedFields(draft: Fields): Fields {
  return Object.fromEntries(
    Object.entries(draft).map(([key, f]) => [key, f.value !== null && f.verification_status !== "human_confirmed" ? pick(f, f.value) : f]),
  );
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

/** 도표 A/B 당사자의 화면 이름 — 카드 B 차(블랙박스 차 · 가입자 차)인지 상대 차인지, 가입자면 덧붙인다. */
export function chartPartyName(mapping: PartyMapping, side: "A" | "B", ego: EgoName = VIDEO_EGO): string {
  const id = side === "A" ? mapping.chart_party_A_id : mapping.chart_party_B_id;
  if (id === null) return side === "A" ? "도표 A" : "도표 B";
  const car = mapping.video_ego_party_id !== null && id === mapping.video_ego_party_id ? ego : "상대 차";
  return id === mapping.insured_party_id && car !== "가입자 차" ? `${car}(가입자)` : car;
}

/** 도표 A·B를 맞바꾼 매핑. */
export function swapChartParties(mapping: PartyMapping): PartyMapping {
  return { ...mapping, chart_party_A_id: mapping.chart_party_B_id, chart_party_B_id: mapping.chart_party_A_id };
}

/** 화면 이름이 있는 카드 칸 이름(movement_A 등). 앞뒤가 낱말 경계일 때만 바꾼다 — collision_signal_A 속 signal_A는 그대로다. */
const FIELD_KEY_PATTERN = new RegExp(`\\b(${Object.keys(LABELS).join("|")})\\b`, "g");

/** BE 메시지 속 카드 칸 이름(movement_A 등)을 화면 이름으로 바꾼다. */
export function readableMessage(message: string): string {
  return message.replace(FIELD_KEY_PATTERN, (key) => cardLabel(key));
}

/** 쪽이 붙은 칸의 반대쪽 칸(movement_A ↔ movement_B). 쪽이 없는 칸은 그대로다. */
function otherSide(key: string): string {
  if (key.endsWith("_A")) return `${key.slice(0, -1)}B`;
  if (key.endsWith("_B")) return `${key.slice(0, -1)}A`;
  return key;
}

/** BE 판단 사유가 칸 이름 목록을 적는 파이썬 목록 모양 — ['movement_A', 'relative_position']. */
const PY_LIST = /\['([^'\]]+(?:', '[^'\]]+)*)'\]/g;

/**
 * BE 판단 사유를 화면 글로 — 칸 이름은 카드 칸 이름(「상대 차 움직임」 등)으로, 파이썬 목록은 괄호 목록으로 바꾼다.
 * 판단 사유는 도표 A/B 기준 칸 이름을 쓴다(BE graph.py). 도표 A가 카드 B 차(블랙박스 차 · 가입자 차)면
 * _A·_B를 맞바꿔 카드 칸으로 읽는다(BE card_fields.is_swapped). 매핑은 판단한 카드의 것을 준다.
 */
export function readableReason(reason: string, mapping: PartyMapping, ego: EgoName = VIDEO_EGO): string {
  return reasonParts(reason, mapping, ego)
    .map((part) => (typeof part === "string" ? part : part.label))
    .join("");
}

/** 판단 사유의 한 토막 — 글자, 또는 카드 칸(칸 이름 key와 화면 이름 label). */
export type ReasonPart = string | { key: string; label: string };

/**
 * readableReason과 같은 글을 토막으로 — 칸 이름 자리는 카드 칸(key)을 함께 준다. 화면이 그 칸(#fact-{key})으로 가는 링크를 건다.
 * key는 카드 칸 이름이다(도표 A가 카드 B 차면 _A·_B를 맞바꾼 것).
 */
export function reasonParts(reason: string, mapping: PartyMapping, ego: EgoName = VIDEO_EGO): ReasonPart[] {
  const swapped = mapping.video_ego_party_id !== null && mapping.chart_party_A_id === mapping.video_ego_party_id;
  // 파이썬 목록은 괄호 목록으로 — 칸 이름은 그대로 두고 아래에서 토막 낸다
  const text = reason.replace(PY_LIST, (_, items: string) => `(${items.split("', '").join(", ")})`);
  const parts: ReasonPart[] = [];
  let last = 0;
  for (const match of text.matchAll(FIELD_KEY_PATTERN)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const key = swapped ? otherSide(match[0]) : match[0];
    parts.push({ key, label: cardLabel(key, ego) });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/**
 * 판단이 보류·추가 확인으로 끝났을 때 담당자가 먼저 볼 카드 칸 — 화면이 누르기 전에도 그 칸을 칠해 둔다.
 * 「미확인」 사유의 칸은 모두, 「카드와 불일치」 줄은 다른 칸이 가장 적은 도표(가장 가까운 도표)의 칸만 고른다.
 * 멀리 어긋난 도표까지 칠하면 카드 대부분이 칠해져 쓸모가 없다. key는 카드 칸 이름이다(reasonParts).
 */
export function fieldsToFix(reasons: readonly string[], mapping: PartyMapping): string[] {
  const keysOf = (reason: string) => reasonParts(reason, mapping).flatMap((part) => (typeof part === "string" ? [] : [part.key]));
  const unconfirmed = reasons.filter((r) => r.includes("미확인")).flatMap(keysOf);
  const mismatches = reasons.filter((r) => r.includes("카드와 불일치")).map(keysOf).filter((keys) => keys.length > 0);
  const fewest = Math.min(...mismatches.map((keys) => keys.length));
  return [...new Set([...unconfirmed, ...mismatches.filter((keys) => keys.length === fewest).flat()])];
}
