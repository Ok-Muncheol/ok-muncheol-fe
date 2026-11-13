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
