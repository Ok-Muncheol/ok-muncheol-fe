/**
 * BE 사실 카드 v1 확정본 값(app/schemas/facts.py FACT_FIELD_OPTIONS, docs/contracts/fact-card-v1.md)과
 * 도표 선택 칸(app/schemas/chart_scope.py, docs/contracts/mvp-chart-scope.md) 대응 — 칸과 허용값, 그 화면 표기.
 * 2026-11-11부터 도표 선택 값도 v1 값이다. 사실 카드(정지원)·구분 질문(구준휘) 화면이 같은 표기를 쓰고,
 * 사실 카드 편집 선택지는 OPTION_LABELS 값 그대로다(BE 카드 수정이 받는 값과 같아야 한다).
 * 런타임 import는 두지 않는다 — 테스트(*.test.mjs)에서 Node가 타입만 지우고 그대로 실행한다.
 */

/** 화면에 보이는 순서. 신호는 신호 있는 교차로, 도로 관계·진입 순서는 신호 없는 교차로에서만 쓴다. */
export const CHART_FIELD_KEYS = [
  "accident_type",
  "location_type",
  "road_priority",
  "movement_A",
  "movement_B",
  "signal_A",
  "signal_B",
  "relative_position",
  "entry_order",
  "night",
] as const;
export type ChartFieldKey = (typeof CHART_FIELD_KEYS)[number];

export const FIELD_LABELS: Record<ChartFieldKey, string> = {
  accident_type: "사고 유형",
  location_type: "교차로 종류",
  road_priority: "도로 관계",
  movement_A: "A 진행 방향",
  movement_B: "B 진행 방향",
  signal_A: "A 신호",
  signal_B: "B 신호",
  relative_position: "상대 위치",
  entry_order: "진입 순서",
  night: "야간 여부",
};

const MOVEMENT = {
  straight: "직진",
  left_turn: "좌회전",
  right_turn: "우회전",
  u_turn: "유턴",
  lane_change: "진로 변경",
  other: "기타",
};
const SIGNAL = { green: "녹색", yellow: "황색", red: "적색", green_left_arrow: "녹색 좌회전 화살표", no_signal: "신호등 없음" };

/**
 * BE 값 → 화면 글자. A/B는 카드 v1 2절대로 카드의 A(상대 차량)·B(촬영 차량)다.
 * 도로 관계는 우선 도로가 어느 쪽인지까지(major_A = A가 대로), 상대 위치는 B가 가는 방향에서 볼 때 A가 있던 쪽,
 * 진입 순서는 A 기준이다(first = A가 먼저).
 */
export const OPTION_LABELS: Record<ChartFieldKey, Record<string, string>> = {
  accident_type: { car_to_car: "차대차", other: "기타(3대 이상·차대차 아님)" },
  location_type: {
    signalized_intersection: "신호 있는 교차로",
    unsignalized_intersection: "신호 없는 교차로",
    roundabout: "회전교차로",
    straight_road: "직선 도로",
    highway: "고속도로",
    other: "교차로 아님",
  },
  road_priority: {
    same_width: "동일 폭",
    major_A: "A가 대로",
    major_B: "B가 대로",
    stop_A: "A 쪽 일시정지",
    stop_B: "B 쪽 일시정지",
    other: "한쪽만 신호등",
    none: "해당 없음",
  },
  movement_A: MOVEMENT,
  movement_B: MOVEMENT,
  signal_A: SIGNAL,
  signal_B: SIGNAL,
  relative_position: {
    same_direction_front: "같은 방향 앞",
    same_direction_rear: "같은 방향 뒤",
    opposite: "맞은편",
    left: "왼쪽",
    right: "오른쪽",
  },
  entry_order: { first: "A 먼저", second: "B 먼저", simultaneous: "동시", none: "해당 없음" },
  night: { true: "야간", false: "주간" },
};

export function isChartFieldKey(key: string): key is ChartFieldKey {
  return (CHART_FIELD_KEYS as readonly string[]).includes(key);
}

/** 칸 이름. 모르는 칸은 BE 키를 그대로 보인다 — 칸이 늘면 여기에 더한다. */
export function fieldLabel(key: string): string {
  return isChartFieldKey(key) ? FIELD_LABELS[key] : key;
}

/** 칸 값의 화면 글자. 값이 없으면(불명) null — 화면은 Empty로 비워 둔다. 모르는 값은 그대로 보인다. */
export function optionLabel(key: string, value: string | number | boolean | null): string | null {
  if (value === null) return null;
  const text = String(value);
  return (isChartFieldKey(key) ? OPTION_LABELS[key][text] : undefined) ?? text;
}
