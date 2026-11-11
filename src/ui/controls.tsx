import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TableHTMLAttributes,
  TextareaHTMLAttributes,
  ThHTMLAttributes,
  TdHTMLAttributes,
} from "react";

/*
 * 공통 컨트롤 — 디자인 시스템 「청람」. 색은 토큰 클래스만 쓴다(AGENTS.md).
 * 데스크톱 업무 화면이 먼저라 컨트롤 높이는 36px(h-9), 터치 기기에서는 최소 44px이 되도록 min-h를 둔다.
 * 담당 화면(src/features/*)은 여기 있는 컨트롤을 먼저 쓰고, 없는 것은 통합 담당과 맞춰 여기에 더한다.
 */

/* ---------- 버튼 ---------- */

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
type ButtonSize = "md" | "sm";
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize };

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-control font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "border border-line-strong bg-control text-ink hover:bg-surface-muted",
  quiet: "text-primary-strong hover:bg-primary-soft",
  danger: "border border-danger bg-control text-danger hover:bg-danger-soft",
};
const BUTTON_SIZES: Record<ButtonSize, string> = {
  md: "h-9 px-4 text-body",
  sm: "h-8 px-3 text-caption",
};

export function Button({ variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...props}
    />
  );
}

/** 버튼 모양의 링크 — 다른 화면으로 갈 때(사건 열기 · 목록으로). */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}>
      {children}
    </Link>
  );
}

/* ---------- 상태 표시 ---------- */

/**
 * 상태 톤 — 뜻으로 고른다. 색 이름(파랑·초록)으로 고르지 않는다.
 * neutral: 대기 · 초안 / info: 처리 중 · 초안 작성 가능 / success: 완료 · 확정 · 승인 /
 * warning: 확인 대기 · 추가 확인 필요 · 보류 / danger: 실패 · 충돌 / model: 모델 원값 · 확신도(담당자 값과 구분)
 */
export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "model";

const BADGE_TONES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-ink-muted",
  info: "bg-info-soft text-on-info-soft",
  success: "bg-success-soft text-on-success-soft",
  warning: "bg-warning-soft text-on-warning-soft",
  danger: "bg-danger-soft text-on-danger-soft",
  model: "bg-model-soft text-on-model-soft",
};
const DOT_TONES: Record<Tone, string> = {
  neutral: "bg-ink-muted",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  model: "bg-model",
};

export function Badge({ tone = "neutral", dot = false, className = "", children }: { tone?: Tone; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-badge px-2 text-caption font-semibold whitespace-nowrap ${BADGE_TONES[tone]} ${className}`}
    >
      {dot && <span aria-hidden className={`size-1.5 rounded-full ${DOT_TONES[tone]}`} />}
      {children}
    </span>
  );
}

/** 안내 상자 — 실패 이유 · 범위 밖 안내 · 버전 충돌처럼 화면에서 설명이 필요한 상태. title은 굵게, 본문은 보통 굵기. */
export function Notice({ tone = "info", title, children }: { tone?: Exclude<Tone, "neutral" | "model">; title?: ReactNode; children: ReactNode }) {
  const border: Record<typeof tone, string> = {
    info: "border-info",
    success: "border-success",
    warning: "border-warning",
    danger: "border-danger",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-card border-l-4 px-4 py-3 text-body ${border[tone]} ${BADGE_TONES[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </div>
  );
}

/* ---------- 틀 ---------- */

/** 화면 제목 줄 — 왼쪽 작은 머리말 · 제목 · 설명, 오른쪽 동작 버튼. */
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-caption font-semibold text-ink-muted">{eyebrow}</p>}
        <h1 className="text-title font-bold break-keep">{title}</h1>
        {description && <p className="mt-1 text-body text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** 카드 — 사실 카드 · 판정 · 근거처럼 한 묶음. title이 있으면 머리줄을 두고 오른쪽에 상태나 동작을 놓는다. */
export function Card({ title, aside, className = "", children }: { title?: ReactNode; aside?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-card border border-line bg-surface shadow-card ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="text-heading font-semibold break-keep">{title}</h2>
          {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/** 이름 · 값 목록 — 사건 요약, 카드 필드, 금액. 값이 숫자나 ID면 font-mono tabular-nums를 쓴다. */
export function DescriptionList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <dl className={`divide-y divide-line ${className}`}>{children}</dl>;
}

export function DescriptionRow({ term, children, note }: { term: ReactNode; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(7rem,1fr)_3fr] gap-x-4 py-2.5 text-body">
      <dt className="text-ink-muted">{term}</dt>
      <dd className="min-w-0">
        <div>{children}</div>
        {note && <div className="mt-0.5 text-caption text-ink-muted">{note}</div>}
      </dd>
    </div>
  );
}

/* ---------- 입력 ---------- */

/** 입력 묶음 — 라벨 · 컨트롤 · 안내/오류. 오류가 있으면 aria-describedby로 잇는다. */
export function Field({ id, label, hint, error, required, children }: { id: string; label: ReactNode; hint?: ReactNode; error?: ReactNode; required?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-caption font-semibold text-ink">
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-danger">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-caption text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-caption text-ink-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

const CONTROL =
  "w-full rounded-control border border-line-strong bg-control px-3 text-body text-ink placeholder:text-ink-faint disabled:bg-surface-muted disabled:opacity-60 aria-invalid:border-danger";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`h-9 ${CONTROL} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`h-9 ${CONTROL} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`min-h-24 py-2 ${CONTROL} ${className}`} {...props} />;
}

export type Choice = { value: string; label: ReactNode };

/**
 * 보기 하나 고르기 — 구분 질문의 보기처럼 몇 개 안 되는 값 중 하나. 네이티브 radio라 화살표 키·초점 고리가 그대로다.
 * 고른 보기는 옥색 테두리·면에 radio 점까지 바뀐다(색만으로 구분하지 않는다). 상태는 부모가 쥔다(value·onChange).
 * legend가 질문이고, children은 질문과 보기 사이의 설명 줄(지금 카드 값·모델 원값)이다.
 */
export function ChoiceGroup({
  name,
  legend,
  choices,
  value,
  onChange,
  disabled = false,
  children,
}: {
  name: string;
  legend: ReactNode;
  choices: readonly Choice[];
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-body font-semibold break-keep">{legend}</legend>
      {children}
      <div className="mt-2 flex flex-wrap gap-2">
        {choices.map((choice) => (
          <label
            key={choice.value}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-control px-3 text-body text-ink has-checked:border-primary-strong has-checked:bg-primary-soft has-checked:font-semibold has-checked:text-on-primary-soft has-disabled:cursor-not-allowed has-disabled:opacity-60"
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
              className="size-4 shrink-0 accent-primary-strong"
            />
            {choice.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** 켜고 끄는 값 하나 — 사실 카드 칸의 담당자 확인. 네이티브 checkbox라 Space 키·초점 고리가 그대로다. 상태는 부모가 쥔다. */
export function Checkbox({ className = "", children, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { children: ReactNode }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 text-body text-ink has-disabled:cursor-not-allowed has-disabled:opacity-60 ${className}`}>
      <input type="checkbox" className="size-4 shrink-0 accent-primary-strong" {...props} />
      {children}
    </label>
  );
}

/* ---------- 표 ---------- */

/** 표 — 사건 목록 · 수정요소 · 이력. 가로가 좁으면 바깥에서 overflow-x-auto로 민다. */
export function Table({ className = "", ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className={`w-full border-collapse text-body ${className}`} {...props} />
    </div>
  );
}

export function Th({ className = "", ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={`border-b border-line bg-surface-muted px-4 py-2.5 text-left text-caption font-semibold text-ink-muted ${className}`} {...props} />;
}

export function Td({ className = "", ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`border-b border-line px-4 py-2.5 align-top last:border-b-0 ${className}`} {...props} />;
}

/* ---------- 요약 수치 · 단계 줄 표 ---------- */

/**
 * 요약 수치 줄 — 보드 위 "담당 10 · 손댈 차례 4 · 처리 중 3"처럼 수치 여러 개를 카드 하나에 한 줄로 둔다.
 * 숫자는 ink·mono로만 적고 톤은 점과 라벨 글자로 보인다. 숫자 자체에 색을 입히면 색각 이상·다크에서 뜻이 사라진다.
 * aside는 수치가 아닌 표시(견본 배지 등)를 줄 오른쪽 끝에 둔다. dl 밖에 둬야 이름–값 목록 구조가 깨지지 않고,
 * 위아래 여백을 겹쳐(-my-1) 배지 높이만큼 줄이 두꺼워지지 않게 한다.
 */
export function StatStrip({ children, aside, className = "" }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 rounded-control border border-line bg-surface px-4 py-2 shadow-card ${className}`}>
      <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">{children}</dl>
      {aside && <div className="-my-1 ml-auto flex shrink-0 items-center gap-2">{aside}</div>}
    </div>
  );
}

export function Stat({ label, value, tone = "neutral", title }: { label: ReactNode; value: ReactNode; tone?: Tone; title?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-caption leading-none" title={title}>
      <dt className="flex items-center gap-1.5 font-semibold text-ink-muted">
        {tone !== "neutral" && <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${DOT_TONES[tone]}`} />}
        {label}
      </dt>
      <dd className="font-mono font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

/**
 * 단계 줄 표(스윔레인) — 항목마다 한 줄이고 열이 단계다. 왼쪽 칸은 항목 이름(행 머리), 오른쪽 열(lanes)은 단계이고
 * 항목 카드는 그 항목이 있는 단계 칸에만 놓는다(LaneRow). 표라서 한 줄의 칸은 높이가 같다.
 * 데스크톱(lg)에서는 머리줄이 앱 머리글(56px) 아래에 붙는다. 그래서 감싼 상자를 lg에서 overflow: clip으로 둔다 —
 * hidden·auto는 스크롤 상자가 돼 머리줄이 화면에 붙지 않는다. 좁은 화면에서는 표를 가로로 밀고 행 머리 칸이 왼쪽에 붙는다.
 */
/** tint는 단계 열 머리 바탕의 토큰 클래스다(예: bg-stage-intake). 없으면 bg-surface. 머리줄이 화면에 붙으므로 불투명해야 한다. */
export type LaneHead = { key: string; title: ReactNode; description?: ReactNode; count: number; tint?: string };

const LANE_HEAD_CELL = "border-b border-line px-3 py-2.5 text-left align-top font-normal lg:sticky lg:top-14 lg:z-20";

export function LaneTable({ caption, head, lanes, children }: { caption: string; head: LaneHead; lanes: readonly LaneHead[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface lg:overflow-clip">
      <table className="w-full min-w-[40rem] table-fixed border-separate border-spacing-0 text-body">
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          <col className="w-40 lg:w-[17rem]" />
          {lanes.map((lane) => (
            <col key={lane.key} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className={`${LANE_HEAD_CELL} sticky left-0 z-30 ${head.tint ?? "bg-surface"}`}>
              <LaneHeading lane={head} />
            </th>
            {lanes.map((lane) => (
              <th key={lane.key} scope="col" className={`${LANE_HEAD_CELL} border-l ${lane.tint ?? "bg-surface"}`}>
                <LaneHeading lane={lane} />
              </th>
            ))}
          </tr>
        </thead>
        {children}
      </table>
    </div>
  );
}

function LaneHeading({ lane }: { lane: LaneHead }) {
  return (
    <span className="flex items-start justify-between gap-2">
      <span className="min-w-0">
        <span className="block font-semibold break-keep text-ink">{lane.title}</span>
        {lane.description && <span className="block text-caption text-ink-muted">{lane.description}</span>}
      </span>
      <span className="shrink-0 font-mono text-caption tabular-nums text-ink-muted">
        <span aria-hidden>{lane.count}</span>
        <span className="sr-only">{lane.count}건</span>
      </span>
    </span>
  );
}

/** 표의 마지막 줄은 감싼 상자의 테두리와 겹치지 않게 아래 선을 뺀다. */
const LANE_LAST_ROW = "[tbody:last-child>tr:last-child>&]:border-b-0";

/** 단계 줄 묶음(tbody). title이 있으면 묶음 첫 줄에 전체 폭 머리줄(예: 고정·접수 순)을 둔다. span은 행 머리 + 단계 열 수다. */
export function LaneGroup({ title, span, children }: { title?: ReactNode; span: number; children: ReactNode }) {
  return (
    <tbody>
      {title && (
        <tr>
          <th scope="rowgroup" colSpan={span} className={`border-b border-line bg-surface px-4 py-1.5 text-left text-caption font-semibold text-ink-muted ${LANE_LAST_ROW}`}>
            {title}
          </th>
        </tr>
      )}
      {children}
    </tbody>
  );
}

/** 단계 줄 한 줄 — 행 머리(header)와 단계 칸. 항목 카드(children)는 lane번째 칸에만 놓고 나머지 칸은 비운다. */
export function LaneRow({ header, lanes, lane, children }: { header: ReactNode; lanes: number; lane: number; children: ReactNode }) {
  return (
    <tr>
      <th scope="row" className={`sticky left-0 z-10 border-b border-line bg-surface px-3 py-2 text-left align-middle font-normal ${LANE_LAST_ROW}`}>
        {header}
      </th>
      {Array.from({ length: lanes }, (_, i) => (
        <td key={i} className={`border-b border-l border-line bg-surface-muted p-2 align-middle ${LANE_LAST_ROW}`}>
          {i === lane ? children : null}
        </td>
      ))}
    </tr>
  );
}

/* ---------- 기다림 ---------- */

/**
 * 도는 표시 — 길이를 모르는 기다림(영상 분석 · 판단 진행)에 쓰고, 무엇을 기다리는지는 옆에 글로 적는다.
 * '동작 줄이기'를 켰어도 멈추면 화면이 멈춘 것으로 읽혀서 3초에 한 바퀴로 느리게만 돌린다.
 */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" fill="none" className={`h-5 w-5 shrink-0 animate-spin motion-reduce:[animation-duration:3s] ${className}`}>
      <circle cx="20" cy="20" r="17" strokeWidth="4" className="stroke-line" />
      <circle cx="20" cy="20" r="17" strokeWidth="4" strokeLinecap="round" strokeDasharray="27 80" className="stroke-primary-strong" />
    </svg>
  );
}

/** 값이 아직 없을 때 — 미확정 비율 · 자료 없는 금액. 빈 문자열이나 0으로 채우지 않는다. */
export function Empty({ children = "미확정" }: { children?: ReactNode }) {
  return <span className="text-ink-faint">{children}</span>;
}

/**
 * 아직 오지 않은 단계 화면의 빈 칸 — 칸 이름은 그대로 두고 값 자리에 흐린 줄표만 둔다. 화면 낭독기에는 "비어 있음"으로 읽힌다.
 * 미확정 값(Empty)과 다르다: Empty는 단계는 왔지만 값이 정해지지 않은 것이고, Blank는 그 단계가 아직 오지 않은 것이다.
 */
export function Blank() {
  return (
    <span className="text-ink-faint">
      <span aria-hidden>—</span>
      <span className="sr-only">비어 있음</span>
    </span>
  );
}
