"use client";

/**
 * A: 사건 작업 화면(/cases/[id]/judgment) — 위에는 영상(근거 장면)과 사실 카드, 그 아래에 판단 영역(판단 중 · 결과).
 * 흐름: 칸을 확인 · 고침 → 카드 맨 아래 「확정하고 과실 비율 판단」(고친 칸 저장 → 카드 확정 → 판단 접수를 한 번에) →
 * 화면이 아래 판단 영역으로 스르륵 내려가고 거기서 「과실 비율을 판단하고 있어요」 → 결과(FaultResult)가 같은 자리에 뜬다.
 * 판단 영역이 화면 밖이면 아래 가운데에 「과실 비율 보기 ↓」가 떠 있다.
 * 판단 중 구분 질문이 오면 위 카드의 그 칸이 맨 위로 올라오고 질문의 보기만 열린다 — 고른 뒤 확정 버튼을 누르면
 * 답변을 보내고, 값으로 답했으면 카드에 반영·재확정·재판단까지 이어서 한다.
 * 확인 완료한 카드는 잠긴다. 「수정하기」로 열어 고치면 아래 결과는 이전 카드 기준으로 흐려진다.
 * 판단 접수(POST …/judgments)는 판단을 끝까지 돌린 뒤 응답한다. 실행 중인 판단은 몇 초마다 다시 읽는다.
 * 견본 모드는 BE에 보내지 않고 진행을 흉내 낸 뒤 견본 결과를 보인다.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FAULT_RATIO_HEAD_ID, FaultResult } from "@/features/judgment/fault-result";
import { createBrowserApiClient } from "@/lib/api/browser";
import { asApiError, newIdempotencyKey } from "@/lib/api/client";
import type { AnswerResult, ApiError, FactCard, FactField, JudgmentResult, JudgmentRunView, PartyMapping } from "@/lib/api/types";
import { buildCardPatch, cardLabel, changedFields, pick, readableMessage, remainingReview, sameMapping, withDefaultChart } from "@/lib/facts/card";
import { answeredValues } from "@/lib/judgment/view";
import { frameTime } from "@/lib/facts/view";
import { Button, ButtonLink, Spinner } from "@/ui/controls";
import { FACT_CARD_FOOTER_ID, FactCardPanel } from "./fact-card-panel";

type Props = {
  caseId: string;
  live: boolean;
  hasVideo: boolean;
  card: FactCard;
  run: JudgmentRunView | null;
  /** 판단 조회가 실패했으면 그 이유 */
  loadError: ApiError | null;
  reportHref: string | null;
};

/** 카드 수정 API(PATCH)가 받는 수정 이유 — 수정 이력용이라 담당자에게 고르게 하지 않고 고정 문구로 보낸다. */
const EDIT_REASON = "담당자가 카드에서 수정";
const POLL_MS = 4000;
const JUDGMENT_AREA_ID = "judgment-area";

type Busy = null | "saving" | "judging";
type Failure = { message: string; conflict: boolean };

function friendly(error: ApiError): string {
  if (error.code === "network_error") return "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";
  return readableMessage(error.message);
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function CaseWorkspace({ caseId, live, hasVideo, card, run, loadError, reportHref }: Props) {
  const router = useRouter();
  // 이미 값으로 답한 구분 질문은 그 값을 카드에 미리 채운다 — 확인 완료 때 카드에 반영·재확정한다.
  const [draft, setDraft] = useState(() => {
    if (run?.status !== "waiting_for_confirmation" || run.fact_card_version !== card.version) return card.fields;
    const answered = Object.entries(answeredValues(run.questions)).filter(([key]) => card.fields[key]);
    return {
      ...card.fields,
      ...Object.fromEntries(answered.map(([key, value]) => [key, pick(card.fields[key], value)])),
    };
  });
  // 도표 A/B가 비어 온 카드는 기본값(A 상대 차 · B 블랙박스 차)으로 보이고, 확정할 때 그 값을 같이 저장한다.
  const baseMapping = withDefaultChart(card.party_mapping, card.parties);
  const [mapping, setMapping] = useState<PartyMapping>(baseMapping);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [frame, setFrame] = useState<string | null>(null);
  const [sampleResult, setSampleResult] = useState<JudgmentResult | null>(null);
  const [resultInView, setResultInView] = useState(false);
  /** 비율 제목 줄이 화면 위로 지나갔다(결과를 읽으며 아래로 내려왔다) */
  const [headAbove, setHeadAbove] = useState(false);
  /** 카드 맨 아래 확정 줄이 화면에 보인다(처음엔 보인다고 둔다 — 아래 버튼이 깜빡이지 않게) */
  const [footerInView, setFooterInView] = useState(true);
  const judgmentKey = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const runForCard = run && run.fact_card_version === card.version ? run : null;
  const pendingQuestions = runForCard?.status === "waiting_for_confirmation" ? runForCard.questions.filter((q) => q.answer === null) : [];
  const questionMap = Object.fromEntries(pendingQuestions.map((q) => [q.field_key, q]));
  const confirmed = card.status === "confirmed" || sampleResult !== null;
  const open = !confirmed || editing;
  const dirty = changedFields(card.fields, draft).length > 0 || !sameMapping(baseMapping, mapping);
  // 아직 고를 칸 — 확인이 필요한 칸과 답하지 않은 질문 칸(같은 칸이면 한 번만 센다). 0이어야 확인 완료를 누를 수 있다.
  const toPick = [...new Set([...pendingQuestions.filter((q) => !touched.has(q.field_key)).map((q) => q.field_key), ...remainingReview(draft)])];
  const result = sampleResult ?? (run?.status === "completed" ? run.result : null);
  const stale = sampleResult === null && result !== null && (run!.fact_card_version !== card.version || editing || dirty);
  const running = runForCard !== null && (runForCard.status === "queued" || runForCard.status === "running");

  // 실행 중인 판단은 다시 읽는다(새로고침해도 BE 상태로 돌아온다).
  useEffect(() => {
    if (!live || !running) return;
    const interval = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(interval);
  }, [live, running, router]);

  // 카드 저장 · 확정도 판단 준비라 따로 알리지 않고 처음부터 「과실 비율을 판단하고 있어요」로 보인다.
  const judging = busy !== null || running;
  const runFailed = !judging && runForCard?.status === "failed";
  const showArea = judging || runFailed || result !== null;

  // 판단 영역이 화면에 들어오면 아래 버튼을 숨긴다.
  useEffect(() => {
    const target = document.getElementById(JUDGMENT_AREA_ID);
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setResultInView(entry.isIntersecting), { threshold: 0.1 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [showArea]);

  // 카드 아래 확정 줄이 화면 밖이면 아래 바에 같은 확정 버튼을 띄운다.
  useEffect(() => {
    const target = document.getElementById(FACT_CARD_FOOTER_ID);
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setFooterInView(entry.isIntersecting));
    observer.observe(target);
    return () => observer.disconnect();
  }, [busy, failure]);

  // 결과를 읽으며 비율 제목 줄(다음 단계 버튼)이 위로 지나가면 아래 바에 같은 버튼을 띄운다.
  const showsResult = !judging && !runFailed && result !== null;
  useEffect(() => {
    const target = document.getElementById(FAULT_RATIO_HEAD_ID);
    if (!target) return;
    // 좁은 화면은 위 고정 머리글(h-14) 밑에 가려진 것도 지나간 것으로 본다. 데스크톱은 메뉴가 왼쪽이라 위가 비어 있다.
    const top = window.matchMedia("(min-width: 64rem)").matches ? 0 : 56;
    const observer = new IntersectionObserver(([entry]) => setHeadAbove(!entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0)), {
      rootMargin: `-${top}px 0px 0px 0px`,
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [showsResult]);

  // 확정 버튼을 누르면 바로 아래 판단 영역으로 내려간다.
  useEffect(() => {
    if (busy !== null) scrollTo(JUDGMENT_AREA_ID);
  }, [busy]);

  // 저장 안 한 변경이 있으면 떠나기 전에 묻는다.
  useEffect(() => {
    if (!dirty || busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function onField(key: string, field: FactField) {
    setDraft((fields) => ({ ...fields, [key]: field }));
    setTouched((keys) => new Set(keys).add(key));
    setFailure(null);
  }

  /** 결과 옆 「사실 카드 고치기」 — 카드를 수정 상태로 열고 그리로 올라간다. */
  function editCard() {
    setEditing(true);
    scrollTo("fact-card");
  }

  function cancelEdit() {
    setDraft(card.fields);
    setMapping(baseMapping);
    setTouched(new Set());
    setEditing(false);
    setFailure(null);
  }

  function simulate() {
    setBusy("saving");
    timers.current.push(
      setTimeout(() => setBusy("judging"), 700),
      setTimeout(() => {
        setSampleResult(sampleJudgment(card));
        setEditing(false);
        setBusy(null);
      }, 3200),
    );
  }

  async function confirmAndJudge() {
    setFailure(null);
    if (!live) return simulate();
    const api = createBrowserApiClient();
    let saved = false;
    try {
      setBusy("saving");
      if (runForCard && pendingQuestions.length > 0) {
        let last: AnswerResult | null = null;
        for (const q of pendingQuestions) {
          const value = draft[q.field_key]?.value ?? null;
          last = await api.answerQuestion(caseId, {
            question_id: q.question_id,
            expected_card_version: runForCard.fact_card_version,
            value: value === null ? null : String(value),
            unknown: value === null,
          });
        }
        // 모두 「모르겠어요」면 같은 판단이 이어서 끝난다 — 다시 읽으면 결과가 보인다.
        if (last && last.next_action !== "update_fact_card") return router.refresh();
      }
      let current = card;
      if (dirty || pendingQuestions.length > 0 || !sameMapping(card.party_mapping, mapping)) {
        current = await api.patchFactCard(caseId, buildCardPatch(card, draft, mapping, EDIT_REASON));
        saved = true;
      }
      if (current.status !== "confirmed") {
        current = await api.confirmFactCard(caseId, current.version);
        saved = true;
      }
      setBusy("judging");
      judgmentKey.current ??= newIdempotencyKey();
      await api.startJudgment(caseId, current.version, judgmentKey.current);
      judgmentKey.current = null;
      router.refresh();
    } catch (caught) {
      const error = asApiError(caught);
      if (error.code === "judgment_in_progress") return router.refresh();
      setFailure({
        message: friendly(error),
        conflict: error.code === "version_conflict",
      });
      setBusy(null);
      // 저장은 됐는데 다음 단계에서 멈췄으면 최신 카드를 다시 읽어 다시 시도할 수 있게 한다.
      if (saved) router.refresh();
    }
  }

  async function startOnly() {
    setFailure(null);
    if (!live) return simulate();
    try {
      setBusy("judging");
      judgmentKey.current ??= newIdempotencyKey();
      await createBrowserApiClient().startJudgment(caseId, card.version, judgmentKey.current);
      judgmentKey.current = null;
      router.refresh();
    } catch (caught) {
      const error = asApiError(caught);
      if (error.code === "judgment_in_progress") return router.refresh();
      setFailure({
        message: friendly(error),
        conflict: error.code === "version_conflict",
      });
      setBusy(null);
    }
  }

  // 잠긴 카드에서도 질문 칸과 확인이 필요한 칸은 고를 수 있다(그래야 확인 완료를 누를 수 있다).
  const editable = (key: string) => busy === null && (open || key in questionMap || card.fields[key]?.verification_status === "needs_review");
  // 질문에 값으로 답해 카드 반영을 기다리는 판단(미리 채운 값으로 dirty)도 확인 완료로 반영·재확정·재판단한다.
  const askingCard = open || pendingQuestions.length > 0 || (runForCard?.status === "waiting_for_confirmation" && dirty);

  // 다음 단계(검토 보고서)로 넘어갈 수 있는 결과 — 지금 카드로 낸 비율이고 보고서가 있다.
  // 견본 결과에는 보고서가 없어 보고서 단계 자리(/reports — 보고서가 생기면 그 버전으로 보낸다)로 넘어간다.
  const nextHref = showsResult && result?.status === "draft_ready" && !stale ? (sampleResult ? `/cases/${encodeURIComponent(caseId)}/reports` : reportHref) : null;

  // 확정 버튼 — 카드 아래 줄과, 그 줄이 화면 밖일 때 아래 바에 같은 것을 둔다. 아직 고를 칸이 있으면 회색이고 누르면 그 노란 칸으로 데려간다.
  const confirmButton = (
    <Button
      onClick={toPick.length > 0 ? () => scrollTo(`fact-${toPick[0]}`) : confirmAndJudge}
      aria-disabled={toPick.length > 0}
      title={toPick.length > 0 ? `아직 고르지 않은 칸: ${toPick.map(cardLabel).join(", ")}` : undefined}
      className="h-10 px-5"
    >
      확정하고 과실 비율 판단
    </Button>
  );
  const confirmFloating = busy === null && !failure && askingCard && !footerInView;

  const footer =
    busy !== null ? null : failure ? (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="alert" className="text-body text-on-danger-soft">
          {failure.message}
        </p>
        {failure.conflict ? (
          <Button variant="secondary" onClick={() => router.refresh()}>
            새로 불러오기
          </Button>
        ) : (
          <Button onClick={askingCard ? confirmAndJudge : startOnly}>다시 시도</Button>
        )}
      </div>
    ) : askingCard ? (
      // 문구 없이 버튼 하나다. 아직 안 고른 칸이 있으면 회색으로 두고, 누르면 그 노란 칸으로 데려간다.
      <div className="flex justify-end">{confirmButton}</div>
    ) : !judging && !runFailed && result === null ? (
      <div className="flex justify-end">
        <Button onClick={startOnly} className="h-10 px-5">
          과실 비율 판단
        </Button>
      </div>
    ) : null;

  return (
    <>
      {loadError && <p className="mb-4 text-body text-danger">판단 기록을 불러오지 못했어요. {loadError.message}</p>}

      <div className={hasVideo ? "grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]" : "mx-auto max-w-3xl"}>
        {hasVideo && <Media card={card} draft={draft} selected={frame} onSelect={setFrame} />}
        <FactCardPanel
          card={card}
          draft={draft}
          mapping={mapping}
          onField={onField}
          onMapping={(next) => {
            setMapping(next);
            setFailure(null);
          }}
          editable={editable}
          questions={questionMap}
          onFrame={setFrame}
          footer={footer}
          aside={
            busy === null &&
            confirmed &&
            pendingQuestions.length === 0 &&
            (editing ? (
              <Button variant="quiet" size="sm" onClick={cancelEdit}>
                수정 취소
              </Button>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-caption font-semibold text-ink-muted">✓ 확정</span>
                <Button variant="quiet" size="sm" onClick={() => setEditing(true)}>
                  수정하기
                </Button>
              </span>
            ))
          }
        />
      </div>

      {showArea && (
        // 판단 영역은 최소 한 화면 높이다 — 확정을 누르면 이 영역 맨 위가 머리글 바로 아래까지 올라와서
        // 판단 중 표시와 이어서 뜨는 과실 비율 · 사유가 한 화면에 들어온다(짧으면 아래 여백이 없어 조금만 내려간다).
        <div id={JUDGMENT_AREA_ID} className="mt-16 min-h-[calc(100dvh-5rem)] scroll-mt-20 lg:scroll-mt-8">
          {judging ? (
            <section aria-label="과실 비율 판단" className="flex flex-col items-center gap-2 border-t border-line py-16 text-center" role="status">
              <p className="flex items-center gap-3 text-heading font-semibold">
                <Spinner />
                과실 비율을 판단하고 있어요
              </p>
              <p className="text-caption text-ink-muted">확정한 사실 카드로 과실 도표를 찾고 수정요소를 따지고 있어요. 보통 1분 안에 끝나요.</p>
            </section>
          ) : runFailed ? (
            <section aria-label="과실 비율 판단" className="flex flex-col items-center gap-3 border-t border-line py-16 text-center">
              <p className="text-heading font-semibold">판단이 멈췄어요</p>
              {runForCard?.error?.message && <p className="text-body text-ink-muted">{runForCard.error.message}</p>}
              {(runForCard?.error?.retryable ?? true) && <Button onClick={startOnly}>다시 판단</Button>}
            </section>
          ) : (
            result && (
              <FaultResult
                result={result}
                mapping={sampleResult ? mapping : baseMapping}
                stale={stale}
                reportHref={nextHref}
                onEditCard={busy === null && confirmed && pendingQuestions.length === 0 && !editing ? editCard : undefined}
                sample={sampleResult !== null}
              />
            )
          )}
        </div>
      )}

      {/* 아래 버튼이 내용을 가리지 않게 자리를 남긴다 */}
      <div aria-hidden className="h-28" />

      <BottomBar>
        {confirmFloating ? (
          confirmButton
        ) : showArea && !resultInView && (judging || (result && !stale)) ? (
          <Button onClick={() => scrollTo(JUDGMENT_AREA_ID)} className="h-10 gap-2 px-6">
            {judging ? (
              <>
                <Spinner className="h-4! w-4!" />
                과실 비율 판단 중이에요 ↓
              </>
            ) : result?.status === "draft_ready" ? (
              "과실 비율 보기 ↓"
            ) : result?.status === "deferred" ? (
              "보류 사유 보기 ↓"
            ) : (
              "확인할 내용 보기 ↓"
            )}
          </Button>
        ) : nextHref && headAbove ? (
          <ButtonLink href={nextHref} className="h-10 px-6">
            검토 보고서 보기 →
          </ButtonLink>
        ) : null}
      </BottomBar>
    </>
  );
}

/** 화면 아래 가운데에 떠 있는 버튼 하나. 내용이 없으면 그리지 않는다. */
function BottomBar({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <div className="pointer-events-auto rounded-control shadow-raised">{children}</div>
    </div>
  );
}

/**
 * 왼쪽 영상 칸. 브라우저가 재생할 수 있는 영상(H.264 사본)이 아직 없어 근거 장면 목록만 보인다.
 * 카드의 근거 장면(▸ 00:03.4)을 누르면 여기서 그 장면이 강조된다.
 */
function Media({ card, draft, selected, onSelect }: { card: FactCard; draft: Record<string, FactField>; selected: string | null; onSelect: (id: string) => void }) {
  const frames = [...card.evidence_frames].sort((a, b) => a.timestamp_ms - b.timestamp_ms);
  return (
    <aside aria-label="영상" className="flex flex-col gap-3 lg:sticky lg:top-8">
      <div className="flex aspect-video items-center justify-center rounded-card bg-surface-muted text-caption text-ink-muted">영상 재생은 준비 중이에요</div>
      {frames.length > 0 && (
        <div>
          <h2 className="text-caption font-semibold text-ink-muted">근거 장면</h2>
          <ol className="mt-1 flex flex-col">
            {frames.map((f) => {
              const fields = Object.keys(draft).filter((key) => draft[key].evidence_frame_ids.includes(f.frame_id));
              return (
                <li key={f.frame_id}>
                  <button
                    type="button"
                    onClick={() => onSelect(f.frame_id)}
                    aria-pressed={selected === f.frame_id}
                    className={`flex w-full items-baseline gap-3 rounded-control px-2 py-1.5 text-left hover:bg-surface-muted ${selected === f.frame_id ? "bg-primary-soft" : ""}`}
                  >
                    <span className="font-semibold tabular-nums">{frameTime(f.timestamp_ms)}</span>
                    <span className="text-caption text-ink-muted">{fields.length > 0 ? fields.map(cardLabel).join(" · ") : "연결된 칸 없음"}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </aside>
  );
}

/** 견본 모드의 흉내 낸 판단 결과 — 실제 도표·비율이 아니다(화면 확인용). 도표 A는 카드의 도표 A다. */
function sampleJudgment(card: FactCard): JudgmentResult {
  return {
    versions: {
      case_id: card.case_id,
      fact_card_version: card.version,
      judgment_version: 1,
      report_version: null,
    },
    status: "draft_ready",
    chart_id: "SYN-견본-1",
    edition: "견본",
    fault_A: 30,
    fault_B: 70,
    base_fault_A: 40,
    calculation_log: ["기본 A 40 : B 60", "B 수정요소 +10 → A 30 : B 70"],
    evidence: [],
    checks: [],
    questions: [],
    reasons: ["견본 결과 — 실제 도표 · 비율이 아님"],
    modifiers: [
      {
        modifier_id: "syn-1",
        name: "현저한 과실(견본)",
        applies_to: "B",
        delta: 10,
        decision: "적용",
        evidence_fields: [],
        reason: "견본 사유",
      },
      {
        modifier_id: "syn-2",
        name: "야간(견본)",
        applies_to: "A",
        delta: 5,
        decision: "미적용",
        evidence_fields: ["night"],
      },
    ],
    alternatives: [],
  };
}
