/**
 * A: 새 사건(사고 날짜 + 블랙박스 영상) 화면의 순수 규칙. 화면(src/features/cases/case-intake.tsx)과 테스트(intake.test.mjs)가 같이 쓴다.
 * 런타임 import는 두지 않는다 — Node가 타입만 지우고 그대로 실행한다.
 */

/** BE가 받는 영상 형식(app/api/cases.py UPLOAD_TYPES) → 확장자. */
export const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
  "video/webm": "webm",
  "video/x-matroska": "mkv",
};

/** Storage 무료 플랜의 파일 하나 한도(docs/contracts/README.md 「파일 업로드」). */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const BY_EXTENSION = Object.fromEntries(Object.entries(VIDEO_TYPES).map(([type, ext]) => [ext, type]));

/** 파일 형식. 브라우저가 형식을 비워 주는 경우(mkv·avi가 흔하다)는 확장자로 고른다. 받지 않는 형식이면 null. */
export function videoContentType(file: { name: string; type: string }): string | null {
  const type = file.type.split(";")[0].trim().toLowerCase();
  if (type in VIDEO_TYPES) return type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[ext] ?? null;
}

/** 올리기 전에 거를 이유. 문제없으면 null. */
export function videoProblem(file: { name: string; type: string; size: number }): string | null {
  if (!videoContentType(file)) return "mp4, mov, avi, webm, mkv 영상만 올릴 수 있어요.";
  if (file.size > MAX_VIDEO_BYTES) return `50MB까지 올릴 수 있어요. 이 영상은 ${Math.ceil(file.size / 1024 / 1024)}MB예요. 사고 장면만 잘라서 올려 주세요.`;
  if (file.size === 0) return "빈 파일이에요.";
  return null;
}

const MONTH_DAY = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" });
const YEAR = new Intl.DateTimeFormat("ko-KR", { year: "numeric", timeZone: "Asia/Seoul" });

/** "2026-11-07"처럼 시각 없는 날짜는 한국 날짜로 읽는다(BE도 시간대 없는 날짜를 한국 시간으로 본다). */
function parseAccidentDate(value: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+09:00` : value);
}

/**
 * 사건 이름 — 사고 날짜로 만든다(예: "11월 7일 사고"). 올해가 아니면 연도를 붙인다.
 * 날짜가 없거나 읽을 수 없으면 "날짜 모르는 사고".
 */
export function caseTitle(accidentDate: string | null | undefined, now: Date = new Date()): string {
  if (!accidentDate) return "날짜 모르는 사고";
  const date = parseAccidentDate(accidentDate);
  if (Number.isNaN(date.getTime())) return "날짜 모르는 사고";
  const year = YEAR.format(date) === YEAR.format(now) ? "" : `${YEAR.format(date)} `;
  return `${year}${MONTH_DAY.format(date)} 사고`;
}

const UUID_HEAD = /^([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
/**
 * 화면에 보이는 사건 번호 — 사건 ID는 UUID(36자)라 앞 8자리만 보인다(예: "3f8a2c1d"). 주소·API에는 전체 ID를 그대로 쓴다.
 * 16진수 8자리면 경우의 수가 약 43억이라 사건이 1천 건이어도 둘이 겹칠 확률은 0.01% 남짓이다. 겹쳐도 주소는 달라 다른 사건이 열리지는 않는다.
 * 청구 번호("{사건 ID}-C1")처럼 사건 ID로 시작하는 번호는 그 부분만 줄인다. 견본 ID("SYN-2026-0105")처럼 UUID가 아니면 그대로다.
 */
export function caseNo(id: string): string {
  return id.replace(UUID_HEAD, "$1");
}

const KOREAN_DAY = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" });
/** 사건 정보 줄의 날짜 — "2026년 11월 8일". 날짜만 온 값("2026-11-08")은 한국 날짜로 읽는다. 읽을 수 없으면 받은 값 그대로. */
export function koreanDay(iso: string): string {
  const date = parseAccidentDate(iso);
  return Number.isNaN(date.getTime()) ? iso : KOREAN_DAY.format(date);
}

/** 오늘 날짜(한국) "YYYY-MM-DD" — 날짜 입력의 최댓값. */
export function todayInKorea(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

/** 사건 화면이 분석 중 화면을 그릴 단계 — 접수(아직 분석 전)와 영상 분석. */
export function isBeforeCard(stage: string): boolean {
  return stage === "intake" || stage === "analysis";
}

/** 분석 중에 다시 읽은 사건(BE GET /cases/{id})에서 보는 부분. */
export type AnalysisWatchState = {
  stage: string;
  task_status: string | null;
  analysis?: { status: string } | null;
  versions?: { fact_card_version: number } | null;
};

/**
 * 영상 분석 중에 다시 읽은 사건으로 다음 행동을 가른다.
 * - done: 분석이 만든 사실 카드가 생겼다(카드 버전이 분석을 시작할 때의 baseVersion보다 크다) — 판단 화면으로 간다.
 * - failed: 분석이 실패했다 — 이유를 보이고 다시 시도하게 한다.
 * - wait: 아직이다. 다음 차례에 다시 읽는다.
 * 단계만으로 가르지 않는다. 카드가 이미 있는 사건(「영상 다시 올리기」 · 영상 없이 진행한 사건에 영상 올리기)은 분석 접수가 조회보다
 * 늦으면 단계가 아직 사실 카드 · 판단 · 검토 보고서라서, 단계만 보면 옛 카드로 판단 화면에 넘어가 버린다(검토 보고서 단계 사건은
 * BE가 새 분석을 보고서보다 먼저 보기 전까지 분석 중에도 report였다).
 * 그런 사건은 분석이 실패하면 BE가 이전 단계로 되돌린다(이전 판단 그대로 — BE app/api/cases.py summarize). 그래서 분석 단계를
 * 한 번 본 뒤(seenAnalysis) 카드 버전이 그대로인 채 카드가 있는 단계로 돌아왔으면 실패다. 아직 못 봤으면 접수 전일 수 있어 기다린다.
 */
export function watchAnalysis(state: AnalysisWatchState, baseVersion: number, seenAnalysis: boolean): "done" | "failed" | "wait" {
  if (isBeforeCard(state.stage)) return state.task_status === "failed" || state.analysis?.status === "failed" ? "failed" : "wait";
  const version = state.versions?.fact_card_version;
  if (version === undefined || version > baseVersion) return "done";
  return seenAnalysis ? "failed" : "wait";
}
