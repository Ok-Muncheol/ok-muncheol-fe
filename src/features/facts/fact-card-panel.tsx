"use client";

/**
 * A: 사실 카드 — 사건 작업 화면(case-workspace.tsx) 위쪽 오른쪽. 값과 상태는 부모가 쥐고 여기서는 그리고 고르기만 한다.
 * - 두 묶음이다: 「AI가 채운 값」(2열)과 「담당자 입력 · 선택」(영상이 채우지 않는 칸). 값만 한 줄로 보이고 「바꾸기」를 누르면 칩이 열린다.
 * - 확인이 필요한 칸(BE needs_review · 구분 질문이 걸린 칸)은 따로 빼지 않고 자기 묶음 안 맨 앞에 둔다. 칸 이름 앞 주황 점으로 표시하고
 *   보기를 칩으로 펼쳐 둔다(두 열을 다 쓴다). 고르면 점이 빠지고 칸이 닫힌다.
 * - 이 사고와 상관없는 칸(신호 없는 교차로의 신호 등)은 접어 둔다.
 * 칩을 고르면 그 칸은 담당자 확인이다 — AI 값과 같은 칩을 골라도 확인이다. 모델 원값은 건드리지 않고, 고친 칸에만 AI 의견을 회색으로 남긴다.
 * 칸마다 AI 확신도(model_confidence)와, 있으면 평가 영상 정답률(vision_detail.eval.accuracy)을 작게 보인다.
 * 보기를 고르면 칸이 바로 닫히고 고른 값과 「고침」(AI 값과 다름) 또는 「확인」 표시가 남는다. 다시 바꾸려면 「바꾸기」.
 * 카드 확정 · 고친 이유 · 판단 버튼은 카드 맨 아래(footer)에 있다 — 칸 하나가 아니라 카드 전체를 확정한다.
 */
import { useState, type ReactNode } from "react";
import type { FactCard, FactField, PartyMapping, QuestionView } from "@/lib/api/types";
import {
  cardLabel,
  cardOptions,
  cardValueLabel,
  differsFromModel,
  fieldAccuracy,
  groupFields,
  parseOption,
  parseSeconds,
  pick,
  setInsured,
  swapChartParties,
} from "@/lib/facts/card";
import { frameTime } from "@/lib/facts/view";
import { Button, Input, Textarea } from "@/ui/controls";

type Fields = Record<string, FactField>;

type Props = {
  card: FactCard;
  draft: Fields;
  mapping: PartyMapping;
  onField: (key: string, field: FactField) => void;
  onMapping: (mapping: PartyMapping) => void;
  /** 칸별로 고를 수 있는지. 잠긴 카드는 모두 false, 구분 질문 대기 중이면 질문 칸만 true다. */
  editable: (key: string) => boolean;
  /** 답하지 않은 구분 질문(칸 이름 → 질문). 그 칸은 맨 위에 두고 질문의 보기만 보인다. */
  questions: Record<string, QuestionView>;
  /** 근거 장면을 누르면 왼쪽 영상 칸에서 그 장면을 보인다. */
  onFrame: (frameId: string) => void;
  /** 머리의 오른쪽 — 잠긴 카드의 「수정하기」 등. */
  aside?: ReactNode;
  /** 카드 맨 아래 — 확정 버튼 · 고친 이유 · 남은 칸 안내. */
  footer?: ReactNode;
};

/** 카드 맨 아래 확정 줄 — 이 줄이 화면 밖이면 사건 화면이 같은 버튼을 아래에 띄운다. */
export const FACT_CARD_FOOTER_ID = "fact-card-footer";

export function FactCardPanel({ card, draft, mapping, onField, onMapping, editable, questions, onFrame, aside, footer }: Props) {
  const groups = groupFields(card.fields, draft, Object.keys(questions));
  const frameTimes = new Map(card.evidence_frames.map((frame) => [frame.frame_id, frame.timestamp_ms]));
  const row = (key: string, open: boolean, compact = false) => (
    <FieldRow
      key={key}
      compact={compact}
      fieldKey={key}
      field={draft[key]}
      open={open}
      editable={editable(key)}
      question={questions[key]}
      frameTimes={frameTimes}
      onFrame={onFrame}
      onChange={(next) => onField(key, next)}
    />
  );

  return (
    <section id="fact-card" aria-labelledby="fact-card-title" className="scroll-mt-20 lg:scroll-mt-8 rounded-card border border-line bg-surface shadow-card">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 id="fact-card-title" className="text-heading font-semibold">
          사고 사실
        </h2>
        {aside}
      </header>

      <Parties mapping={mapping} onChange={onMapping} editable={editable("party_mapping")} />

      {groups.rest.length > 0 && (
        // 이미 채운 값은 2열로 촘촘하게 — 고치려고 연 칸만 두 열을 다 쓴다.
        <div className="border-t border-line px-5 pt-4 pb-1">
          <h3 className="text-caption font-semibold text-ink-muted">{card.fields[groups.rest[0]]?.source === "vision" ? "AI가 채운 값" : "입력한 값"}</h3>
          <ul className="mt-1 grid gap-x-8 sm:grid-cols-2">{groups.rest.map((key) => row(key, groups.review.includes(key), true))}</ul>
        </div>
      )}

      {/* 영상 카드에서 비전이 채우지 않는 담당자 입력 칸 — 확정을 막지 않는 선택 칸이다. 판단이 물으면 제자리에서 확인할 칸으로 표시된다. */}
      {groups.manual.length > 0 && (
        <div className="border-t border-line px-5 pt-4 pb-1">
          <h3 className="text-caption font-semibold text-ink-muted">
            담당자 입력 <span className="font-normal text-ink-faint">· 선택</span>
          </h3>
          <ul className="mt-1 grid gap-x-8 sm:grid-cols-2">{groups.manual.map((key) => row(key, groups.review.includes(key), true))}</ul>
        </div>
      )}

      {groups.unused.length > 0 && (
        <details className="border-t border-line px-5 py-3">
          <summary className="cursor-pointer text-caption text-ink-muted">이 사고와 상관없는 칸 {groups.unused.length}개</summary>
          <ul className="divide-y divide-line">{groups.unused.map((key) => row(key, false))}</ul>
        </details>
      )}

      {footer && <footer id={FACT_CARD_FOOTER_ID} className="rounded-b-card border-t border-line px-5 py-4">{footer}</footer>}
    </section>
  );
}

/** 누가 가입자인지, 과실 도표의 A가 누구인지. 과실 비율은 도표 A : B로 나온다. */
function Parties({ mapping, onChange, editable }: { mapping: PartyMapping; onChange: (m: PartyMapping) => void; editable: boolean }) {
  const insuredIsEgo = mapping.insured_party_id !== null && mapping.insured_party_id === mapping.video_ego_party_id;
  const chartAIsEgo = mapping.chart_party_A_id !== null && mapping.chart_party_A_id === mapping.video_ego_party_id;
  const segment = (active: boolean) => `h-8 px-3 text-caption font-semibold ${active ? "bg-primary-soft text-on-primary-soft" : "bg-control text-ink-muted hover:text-ink"}`;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 text-body">
      <div className="flex items-center gap-2">
        <span className="text-caption text-ink-muted">가입자</span>
        <span className="inline-flex overflow-hidden rounded-control border border-line-strong" role="group" aria-label="가입자">
          <button type="button" disabled={!editable} aria-pressed={insuredIsEgo} className={segment(insuredIsEgo)} onClick={() => onChange(setInsured(mapping, true))}>
            블랙박스 차
          </button>
          <button
            type="button"
            disabled={!editable}
            aria-pressed={!insuredIsEgo}
            className={`border-l border-line-strong ${segment(!insuredIsEgo)}`}
            onClick={() => onChange(setInsured(mapping, false))}
          >
            상대 차
          </button>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-caption text-ink-muted">도표 A</span>
        <span className="font-semibold">{mapping.chart_party_A_id === null ? "정하지 않았어요" : chartAIsEgo ? "블랙박스 차" : "상대 차"}</span>
        {editable && (
          <Button variant="quiet" size="sm" onClick={() => onChange(swapChartParties(mapping))}>
            맞바꾸기
          </Button>
        )}
      </div>
    </div>
  );
}

function FieldRow({
  compact = false,
  fieldKey,
  field,
  open: initiallyOpen,
  editable,
  question,
  frameTimes,
  onFrame,
  onChange,
}: {
  /** 2열 목록의 한 칸 — 줄 구분선을 위에 긋고, 열리면 두 열을 다 쓴다. */
  compact?: boolean;
  fieldKey: string;
  field: FactField;
  open: boolean;
  editable: boolean;
  question?: QuestionView;
  frameTimes: Map<string, number>;
  onFrame: (frameId: string) => void;
  onChange: (field: FactField) => void;
}) {
  // 확인이 필요한 칸은 열린 채로 시작하고, 고르면 닫힌다.
  const [opened, setOpened] = useState(initiallyOpen && field.verification_status !== "human_confirmed");
  const open = opened && editable;
  const accuracy = fieldAccuracy(field);
  const confidence = field.model_confidence;
  const pending = field.verification_status === "needs_review";
  // 담당자 입력 칸(출처 manual)은 AI 값이 없어 「고침」·「AI 의견」을 붙이지 않는다.
  const manual = field.source === "manual";
  const changed = !manual && differsFromModel(field);
  const checked = field.verification_status === "human_confirmed";
  // 아직 담당자가 고르지 않은 확인 필요 칸 · 질문 칸만 노랗게 칠한다.
  const attention = field.verification_status === "needs_review" || (question !== undefined && opened);

  return (
    <li
      id={`fact-${fieldKey}`}
      className={`scroll-mt-24 py-3 transition-colors target:bg-primary-soft ${compact ? `border-t border-line ${open ? "sm:col-span-2" : ""}` : "-mx-5 px-5"} `}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-1.5 font-semibold text-ink">
          {/* 확인이 필요한 칸 — 담당자가 고르면 점이 빠진다 */}
          {attention && <span aria-hidden title="확인이 필요한 칸" className="size-1.5 shrink-0 rounded-full bg-warning" />}
          {cardLabel(fieldKey)}
          {attention && <span className="sr-only">(확인 필요)</span>}
        </p>
        <p className="flex shrink-0 items-baseline gap-3 text-caption">
          {(confidence !== null || accuracy !== null) && (
            <span className="text-ink-muted">
              {confidence !== null && (
                <span title="AI가 이 값에 얼마나 확신하는지">
                  AI 확신{" "}
                  <span className={`tabular-nums ${confidence < 0.5 ? "font-semibold text-on-warning-soft" : "text-model"}`}>{Math.round(confidence * 100)}%</span>
                </span>
              )}
              {confidence !== null && accuracy !== null && " · "}
              {accuracy !== null && (
                <span title="평가 영상에서 AI가 이 칸을 맞힌 비율">
                  정답률 <span className="text-model tabular-nums">{Math.round(accuracy * 100)}%</span>
                </span>
              )}
            </span>
          )}
          {!open && editable && (
            <button type="button" className="font-semibold text-primary-strong hover:underline" onClick={() => setOpened(true)}>
              {field.value === null ? "입력" : "바꾸기"}
            </button>
          )}
        </p>
      </div>

      {question && <p className="mt-1 text-body text-on-warning-soft">{question.text}</p>}

      {open ? (
        <div className="mt-2">
          <Editor
            fieldKey={fieldKey}
            field={field}
            only={question?.options}
            allowUnknown={question ? question.allow_unknown : true}
            onChange={onChange}
            onDone={() => setOpened(false)}
          />
        </div>
      ) : (
        <p className="mt-0.5 flex flex-wrap items-baseline gap-2 text-body">
          <span className={field.value === null ? "text-ink-muted" : changed ? "font-semibold text-ink" : "text-ink"}>
            {field.value === null && pending ? "아직 몰라요" : field.value === null && manual ? "비어 있음" : cardValueLabel(fieldKey, field.value)}
          </span>
          {changed ? (
            <span className="rounded-control bg-surface-muted px-1.5 text-caption font-semibold text-ink">고침</span>
          ) : (
            checked && <span className="text-caption font-semibold text-ink-muted">✓ 확인</span>
          )}
        </p>
      )}

      {(changed || field.evidence_frame_ids.length > 0) && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-muted">
          {changed && <span>AI 의견: {cardValueLabel(fieldKey, field.model_value)}</span>}
          {field.evidence_frame_ids.map((frameId) => (
            <button key={frameId} type="button" onClick={() => onFrame(frameId)} className="text-primary-strong tabular-nums hover:underline">
              ▸ {frameTimes.has(frameId) ? frameTime(frameTimes.get(frameId)!) : frameId}
            </button>
          ))}
        </p>
      )}
    </li>
  );
}

/** 칸 종류에 맞는 입력 — 보기가 있는 칸은 칩, 충돌 시각은 초, 사고 설명은 여러 줄. */
function Editor({
  fieldKey,
  field,
  only,
  allowUnknown,
  onChange,
  onDone,
}: {
  fieldKey: string;
  field: FactField;
  only?: readonly string[];
  allowUnknown: boolean;
  onChange: (field: FactField) => void;
  /** 고르기를 마쳤다 — 칩은 고르는 즉시, 글·숫자 칸은 「다 고쳤어요」로 닫는다. */
  onDone: () => void;
}) {
  const done = (
    <Button variant="quiet" size="sm" onClick={onDone}>
      다 고쳤어요
    </Button>
  );
  if (fieldKey === "narrative") {
    return (
      <div className="flex flex-col items-start gap-1">
        <Textarea
          rows={3}
          value={field.value === null ? "" : String(field.value)}
          onChange={(e) => onChange(pick(field, e.target.value || null))}
          placeholder="사고 상황을 적어 주세요"
        />
        {done}
      </div>
    );
  }
  if (fieldKey === "collision_time_ms") {
    return (
      <span className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          step={0.1}
          className="h-9 w-28"
          defaultValue={typeof field.value === "number" ? field.value / 1000 : ""}
          onChange={(e) => onChange(pick(field, parseSeconds(e.target.value)))}
          aria-label="충돌 시각(초)"
        />
        <span className="text-caption text-ink-muted">초 (영상 시작부터)</span>
        {done}
      </span>
    );
  }

  const confirmed = field.verification_status === "human_confirmed";
  const aiValue = field.verification_status === "needs_review" ? field.value : null;
  const chips: [string, string][] = [...cardOptions(fieldKey, only), ...(allowUnknown ? ([["__null__", "모르겠어요"]] as [string, string][]) : [])];
  return (
    <div role="radiogroup" aria-label={cardLabel(fieldKey)} className="flex flex-wrap gap-1.5">
      {chips.map(([raw, label]) => {
        const value = raw === "__null__" ? null : parseOption(fieldKey, raw);
        const isValue = field.value === null ? value === null : value !== null && String(value) === String(field.value);
        // 확인이 필요한 칸의 AI 값은 고른 것으로 칠하지 않고 「AI」로만 표시한다 — 담당자가 골라야 확인이다.
        const selected = isValue && (confirmed || field.verification_status === "unverified");
        const suggested = aiValue !== null && isValue && !confirmed;
        return (
          <button
            key={raw}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              onChange(pick(field, value));
              onDone();
            }}
            className={`inline-flex h-8 items-center gap-1.5 rounded-control border px-3 text-body transition-[color,background-color,border-color,transform] active:scale-[0.97] ${
              selected
                ? "border-primary-strong bg-primary-soft font-semibold text-on-primary-soft"
                : suggested
                  ? "border-dashed border-model text-ink"
                  : "border-line-strong bg-control text-ink hover:border-primary-strong hover:bg-primary-soft hover:text-on-primary-soft"
            }`}
          >
            {label}
            {suggested && <span className="text-caption font-semibold text-model">AI</span>}
          </button>
        );
      })}
    </div>
  );
}
