/**
 * BE app/schemas/chart_scope.py 대응 수동 초안 — 도표 선택 칸과 허용값, 그 화면 표기(docs/contracts/mvp-chart-scope.md, 2026-11-06 결정).
 * 사실 카드(정지원)·구분 질문(구준휘) 화면이 같은 표기를 쓴다. 값 이름은 BE 제안이라 칸이 확정되면 BE와 함께 바꾼다.
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
  entry_order: "진입 순서",
  night: "야간 여부",
};

const MOVEMENT = { straight: "직진", left_turn: "좌회전", right_turn: "우회전", u_turn: "유턴" };
const SIGNAL = { green: "녹색", yellow: "황색", red: "적색", green_left_arrow: "녹색 좌회전 화살표", no_signal: "신호등 없음" };

/** BE FIELD_OPTIONS의 값 → 화면 글자. entry_order는 A 기준이다(first = A가 먼저, BE evals/vision/run_vlm.py). */
export const OPTION_LABELS: Record<ChartFieldKey, Record<string, string>> = {
  accident_type: { car_to_car: "차대차" },
  location_type: {
    signalized_intersection: "신호 있는 교차로",
    unsignalized_intersection: "신호 없는 교차로",
    roundabout: "회전교차로",
    other: "교차로 아님",
  },
  road_priority: { same_width: "동일 폭", major_minor: "대로·소로", stop_sign: "일시정지 표지" },
  movement_A: MOVEMENT,
  movement_B: MOVEMENT,
  signal_A: SIGNAL,
  signal_B: SIGNAL,
  entry_order: { first: "A 먼저", second: "B 먼저", simultaneous: "동시" },
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
