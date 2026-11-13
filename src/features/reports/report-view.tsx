"use client";

/**
 * A·D: 검토 보고서 본문 — 보고서 9개 항목(BE ReviewReport)을 담당자가 하는 일 기준 세 덩어리로 묶어 보인다.
 * - 맨 위 요약: 확인 상태와 핵심 숫자 셋(최종 과실 · 자차 보험금 · 구상 예정액). 모르는 값은 「—」.
 * - 과실 판단(1 · 3~7번): 판단 화면에서 본 내용이라 짧게. 확정 사실(2번)은 접어 둔다.
 * - 손해액 · 보험금(8번): 담당자가 넣는 곳 — 견적서 PDF, 면책 확인. 넣으면 BE가 다시 산정해 새 보고서 버전이 생기고 그 버전으로 옮긴다.
 * - 구상(9번): 구상 예정액 = 자차 보험금 × 상대 과실. 상대와 과실을 다르게 합의했으면 협의 과실(이유 필수)로 새 버전.
 * - 맨 아래 「확인 완료」 한 번(상대방 정보는 선택) — 청구서가 만들어지면 구상 청구서 화면으로, 못 만들면 사유 목록을 보인다.
 * 금액 · 비율은 BE 값 그대로다(FE가 계산하지 않는다). 견본 모드는 BE에 보내지 않고 결과만 흉내 낸다.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { createBrowserApiClient } from "@/lib/api/browser";
import { asApiError } from "@/lib/api/client";
import type { CaseFacts, PartyMapping, ReportSection, ReviewReport } from "@/lib/api/types";
import { cardLabel, cardValueLabel, chartPartyName } from "@/lib/facts/card";
import { Button, ButtonLink, Input, Spinner } from "@/ui/controls";
import { UploadError, uploadFile } from "@/features/cases/upload";

const dateTime = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Seoul" });
const won = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toLocaleString("ko-KR")}원`);
const text = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

const LAYER: Record<string, string> = { evidence: "근거", rebuttal: "반박", calculation: "계산" };
const EXCLUSIONS = ["무면허", "음주", "고의"] as const;

type Busy = null | "estimate" | "facts" | "fault" | "confirm";

export function ReportView({ caseId, report, live, claimHref }: { caseId: string; report: ReviewReport; live: boolean; claimHref: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [blocked, setBlocked] = useState<string[] | null>(null);
  const [progress, setProgress] = useState(0);

  const version = report.versions.report_version ?? 1;
  const base = `/cases/${encodeURIComponent(caseId)}`;
  const j = report.judgment;
  const mapping: PartyMapping = report.party_mapping ?? { video_ego_party_id: null, insured_party_id: null, chart_party_A_id: null, chart_party_B_id: null };
  const section = (no: number): ReportSection | undefined => (report.sections as ReportSection[]).find((s) => s.no === no);
  const s8 = section(8);
  const s9 = section(9);
  const calc = report.calculation as (ReviewReport["calculation"] & { counterparty_fault?: number | null; assumptions?: string[] }) | null;
  const cp = calc?.counterparty_fault ?? null;
  const approved = report.approval_status === "approved";
  const ready = j.status === "draft_ready";

  /** 새 보고서 버전으로 옮긴다 — 견적서 · 면책 · 협의 과실을 넣으면 BE가 다시 산정해 새 버전을 돌려준다. */
  function goTo(next: ReviewReport | null) {
    const v = next?.versions.report_version;
    if (v && v !== version) router.replace(`${base}/reports/${v}`);
    router.refresh();
  }

  async function run(kind: Busy, action: () => Promise<void>) {
    setMessage(null);
    if (!live) {
      setMessage({ tone: "info", text: "견본이라 저장하지 않았어요. 실제 사건에서는 다시 산정해 새 보고서 버전이 생겨요." });
      return;
    }
    setBusy(kind);
    try {
      await action();
    } catch (caught) {
      setMessage({ tone: "error", text: caught instanceof UploadError ? caught.message : asApiError(caught).message });
    } finally {
      setBusy(null);
    }
  }

  const uploadEstimate = (file: File) =>
    run("estimate", async () => {
      const partyId = mapping.insured_party_id;
      if (!partyId) throw new Error("가입자 차량이 정해지지 않았어요. 판단 화면의 사실 카드에서 가입자를 정해 주세요.");
      const api = createBrowserApiClient();
      const ticket = await api.requestUpload(caseId, "estimate", "application/pdf");
      setProgress(0);
      await uploadFile(ticket.upload_url, file, "application/pdf", setProgress);
      goTo(await api.uploadEstimate(caseId, ticket.storage_path, partyId));
    });

  const saveFacts = (facts: CaseFacts) => run("facts", async () => goTo(await createBrowserApiClient().addDocuments(caseId, [], facts)));

  const saveFault = (fault: number | null, reason: string) =>
    run("fault", async () =>
      goTo(
        await createBrowserApiClient().setAgreedFault(caseId, fault === null ? { clear: true, fault_change_reason: reason } : { agreed_counterparty_fault: fault, fault_change_reason: reason }),
      ),
    );

  async function confirm(counterparty: { vehicle_no: string; insurer: string; claim_no: string } | null) {
    setMessage(null);
    setBlocked(null);
    if (!live) {
      // 견본: 청구서를 만들 수 있으면 견본 청구서 화면으로, 아니면 BE와 같은 사유를 보인다.
      if (report.recovery?.planned) router.push(claimHref);
      else setBlocked(["견적서 필요 — 견적서 추가 후 청구서 생성"]);
      return;
    }
    setBusy("confirm");
    try {
      const result = await createBrowserApiClient().confirmReport(caseId, version, counterparty);
      if (result.package) router.push(claimHref);
      else {
        setBlocked(result.claim_blocked_reasons.length > 0 ? result.claim_blocked_reasons : [result.claim_blocked_reason ?? "청구서를 만들지 못했어요"]);
        router.refresh();
      }
    } catch (caught) {
      const error = asApiError(caught);
      setMessage({ tone: "error", text: error.code === "version_conflict" ? "더 새 보고서 버전이 있어요. 새로 불러와 주세요." : error.message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 요약 — 확인 상태와 핵심 숫자 셋 */}
      <section aria-label="보고서 요약" className="rounded-card border border-line bg-surface px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-heading font-semibold">
            검토 보고서 <span className="font-normal text-ink-muted tabular-nums">v{version}</span>
          </h2>
          {approved ? (
            <span className="text-caption font-semibold text-ink-muted">✓ 담당자 확인 완료{report.approved_at && ` · ${dateTime.format(new Date(report.approved_at))}`}</span>
          ) : (
            <span className="flex items-center gap-1.5 text-caption font-semibold text-on-warning-soft">
              <span aria-hidden className="size-1.5 rounded-full bg-warning" />
              담당자 확인 전
            </span>
          )}
        </div>
        <dl className="mt-5 grid gap-6 sm:grid-cols-3">
          <Figure term="최종 과실" note={j.fault_A !== null ? `${chartPartyName(mapping, "A")} : ${chartPartyName(mapping, "B")}` : "판정 전"}>
            {j.fault_A !== null && j.fault_B !== null ? `${j.fault_A} : ${j.fault_B}` : "—"}
          </Figure>
          <Figure term="자차 보험금" note="보상 인정 손해액 − 자기부담금">
            {won(calc?.insurance_payment)}
          </Figure>
          <Figure term="구상 예정액" note={cp !== null ? `자차 보험금 × 상대 과실 ${cp}%` : "견적서 · 산정 후"} strong>
            {won(report.recovery?.planned)}
          </Figure>
        </dl>
        {typeof s8?.body["근거 상태"] === "string" && <p className="mt-4 text-caption text-ink-faint">{s8.body["근거 상태"] as string}</p>}
      </section>

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`text-body ${message.tone === "error" ? "text-on-danger-soft" : "text-ink-muted"}`}>
          {message.text}
        </p>
      )}

      {/* 과실 판단 — 1 · 3~7번 */}
      <Block
        title="과실 판단"
        aside={
          <span className="flex flex-wrap gap-1.5">
            {j.checks.map((c) => (
              <span
                key={c.layer}
                title={c.reasons.join("; ") || undefined}
                className={`inline-flex h-6 items-center rounded-full px-2.5 text-caption font-semibold ${c.passed ? "bg-surface-muted text-ink-muted" : "bg-danger-soft text-on-danger-soft"}`}
              >
                {c.passed ? "✓" : "✕"} {LAYER[c.layer] ?? c.layer} 검증
              </span>
            ))}
          </span>
        }
      >
        <Rows>
          <Row term="적용 도표">
            <span className="font-semibold">{text(j.chart_id)}</span>
            {j.edition && <span className="ml-2 text-caption text-ink-faint">{j.edition}</span>}
          </Row>
          <Row term="과실 계산">
            {j.base_fault_A != null ? (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  기본 <b className="tabular-nums">{j.base_fault_A} : {100 - j.base_fault_A}</b>
                </span>
                {(j.modifiers ?? [])
                  .filter((m) => m.decision === "적용")
                  .map((m) => (
                    <span key={m.modifier_id} className="text-ink-muted">
                      → {chartPartyName(mapping, m.applies_to)} {m.name}{" "}
                      <b className="text-ink tabular-nums">
                        {m.delta > 0 ? "+" : ""}
                        {m.delta}
                      </b>
                    </span>
                  ))}
                {j.fault_A !== null && (
                  <span>
                    → 최종 <b className="text-primary-strong tabular-nums">{j.fault_A} : {j.fault_B}</b>
                  </span>
                )}
              </span>
            ) : (
              "—"
            )}
          </Row>
          <Row term="판단 사유">
            {j.reasons.length > 0 ? (
              <ul className="flex flex-col gap-0.5">
                {j.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            ) : (
              "—"
            )}
          </Row>
          <FollowUps section={section(7)} />
        </Rows>
        <Facts section={section(2)} />
      </Block>

      {/* 손해액 · 보험금 — 8번 */}
      <Block title="손해액 · 보험금">
        {!ready ? (
          <p className="text-body text-ink-muted">{s8?.empty_reason ?? "과실비율이 정해진 뒤 산정해요."}</p>
        ) : (
          <>
            <Estimate source={s8?.body["손해액 출처"]} busy={busy === "estimate"} progress={progress} onFile={uploadEstimate} />
            <Exclusions busy={busy === "facts"} onSave={saveFacts} />
            <Rows>
              <Row term="고객 차량 손해액">{text(s8?.body["고객 차량 손해액"])}</Row>
              <Row term="자기부담금">{won(calc?.deductible)}</Row>
              <Row term="자차 보험금">
                <b>{won(calc?.insurance_payment)}</b>
              </Row>
              <Row term="상대방 부담 예상">{text((s8?.body["부담 요약"] as Record<string, unknown> | undefined)?.["상대방 부담 예상액(지급 전 예상치)"])}</Row>
              <Row term="보험사 최종 부담">{text((s8?.body["부담 요약"] as Record<string, unknown> | undefined)?.["보험사 최종 부담 예상액"])}</Row>
            </Rows>
            {list(s8?.body["기본 가정"]).length > 0 && (
              <ul className="mt-4 flex flex-col gap-1 text-caption text-ink-muted">
                {list(s8?.body["기본 가정"]).map((a) => (
                  <li key={a} className="flex gap-2">
                    <span className="shrink-0 rounded-badge bg-surface-muted px-1.5 font-semibold">가정</span>
                    {a}
                  </li>
                ))}
              </ul>
            )}
            <details className="mt-4 text-caption text-ink-muted">
              <summary className="cursor-pointer font-semibold">산정 근거</summary>
              <dl className="mt-2 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1">
                <dt>근거 조항</dt>
                <dd>{typeof s8?.body["근거 조항"] === "string" ? (s8.body["근거 조항"] as string) : "본문 참고"}</dd>
                <dt>규칙 버전</dt>
                <dd>{text(s8?.body["규칙 버전"])}</dd>
                <dt>약관 적용판</dt>
                <dd>{text(s8?.body["약관 적용판"])}</dd>
                <dt>산정 사유</dt>
                <dd>{list(s8?.body["사유"]).join(" · ") || "—"}</dd>
              </dl>
            </details>
          </>
        )}
      </Block>

      {/* 구상 — 9번 */}
      <Block title="구상">
        {!s9 || s9.state === "empty" ? (
          <p className="text-body text-ink-muted">{s9?.empty_reason ?? "견적서 · 산정 후 작성해요."}</p>
        ) : (
          <>
            <Rows>
              <Row term="구상 예정액">
                <b className="text-heading">{won(report.recovery?.planned)}</b>
                <span className="ml-2 text-caption text-ink-muted">
                  {won(calc?.insurance_payment)} × 상대 과실 {cp ?? "—"}%
                </span>
              </Row>
              <Row term="청구액">{won(report.recovery?.claimed)}</Row>
              <Row term="고객 자기부담금 검토액">{won(report.recovery?.customer_deductible_review)}</Row>
              <Row term="협의 과실">
                <AgreedFault current={text(s9.body["협의 과실 / 변경 이유"])} busy={busy === "fault"} onSave={saveFault} />
              </Row>
            </Rows>
            {typeof s9.body["주의"] === "string" && <p className="mt-4 text-caption text-ink-faint">{s9.body["주의"] as string}</p>}
          </>
        )}
      </Block>

      {/* 확인 완료 — 한 번 */}
      <section aria-label="확인 완료" className="rounded-card border border-line bg-surface px-6 py-5">
        {approved ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">✓ 담당자가 확인을 마친 보고서예요</p>
            <ButtonLink href={claimHref} className="h-10 px-6">
              구상 청구서 보기 →
            </ButtonLink>
          </div>
        ) : !ready ? (
          <p className="text-body text-ink-muted">추가 확인 · 보류 상태라 확인 완료할 수 없어요. 판단 화면에서 먼저 확인해 주세요.</p>
        ) : (
          <ConfirmForm busy={busy === "confirm"} onConfirm={confirm} />
        )}
        {blocked && (
          <div role="alert" className="mt-4 rounded-control bg-warning-soft px-4 py-3 text-body text-on-warning-soft">
            <p className="font-semibold">확인은 마쳤지만 구상 청구서를 만들지 못했어요</p>
            <ul className="mt-1 list-disc pl-5">
              {blocked.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <p className="text-caption text-ink-faint">
        이전 단계: <Link href={`${base}/judgment`} className="text-primary-strong hover:underline">과실 판단 화면</Link>
      </p>
    </div>
  );
}

function Figure({ term, note, strong, children }: { term: string; note: string; strong?: boolean; children: ReactNode }) {
  return (
    <div>
      <dt className="text-caption text-ink-muted">{term}</dt>
      <dd className={`mt-1 text-2xl font-bold tracking-tight tabular-nums ${strong ? "text-primary-strong" : "text-ink"}`}>{children}</dd>
      <dd className="mt-0.5 text-caption text-ink-faint">{note}</dd>
    </div>
  );
}

function Block({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-card border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-6 py-3">
        <h2 className="text-body font-semibold">{title}</h2>
        {aside}
      </header>
      <div className="px-6 py-4">{children}</div>
    </section>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <dl className="divide-y divide-line">{children}</dl>;
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 text-body sm:grid-cols-[9rem_1fr] sm:gap-4">
      <dt className="text-caption text-ink-muted sm:pt-0.5">{term}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** 7번 추가 확인 사항 — 남은 질문 · 반박이 있을 때만 주황 점과 함께 보인다. */
function FollowUps({ section }: { section?: ReportSection }) {
  const questions = (section?.body["담당자 질문"] as { 칸: string; 질문: string }[] | undefined) ?? [];
  const rebuttals = list(section?.body["미해결 반박·검증"]);
  if (questions.length === 0 && rebuttals.length === 0) return null;
  return (
    <Row term="추가 확인">
      <ul className="flex flex-col gap-1">
        {[...questions.map((q) => `${cardLabel(q.칸)}: ${q.질문}`), ...rebuttals].map((t) => (
          <li key={t} className="flex items-start gap-2">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />
            {t}
          </li>
        ))}
      </ul>
    </Row>
  );
}

/** 2번 확정 사실 — 판단에 쓴 사실 카드. 접어 둔다. */
function Facts({ section }: { section?: ReportSection }) {
  const fields = (section?.body["사실 카드"] as { 칸: string; 값: unknown }[] | undefined) ?? [];
  if (fields.length === 0) return null;
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-caption font-semibold text-ink-muted">판단에 쓴 사실 카드 {fields.length}칸</summary>
      <dl className="mt-2 grid gap-x-8 gap-y-1.5 text-caption sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.칸} className="flex gap-3">
            <dt className="w-28 shrink-0 text-ink-muted">{cardLabel(f.칸)}</dt>
            <dd className="text-ink">{cardValueLabel(f.칸, f.값 as string | number | boolean | null)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** 견적서 — 손해액 출처(견적서 PDF 자동 추출)와 올리기. 올리면 BE가 다시 산정해 새 버전이 생긴다. */
function Estimate({ source, busy, progress, onFile }: { source: unknown; busy: boolean; progress: number; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-control bg-surface-muted px-4 py-3">
      <div className="min-w-0 text-body">
        <p className="text-caption text-ink-muted">견적서</p>
        <p className={typeof source === "string" ? "text-ink" : "text-ink-muted"}>{typeof source === "string" ? source : "아직 없어요 — 올리면 손해액 · 보험금을 산정해요"}</p>
      </div>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <Button variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? (
          <>
            <Spinner className="h-3.5! w-3.5!" /> 올리는 중 {Math.round(progress * 100)}%
          </>
        ) : typeof source === "string" ? (
          "다른 견적서 올리기"
        ) : (
          "견적서 PDF 올리기"
        )}
      </Button>
    </div>
  );
}

/**
 * 면책 확인 — 운전자(계약자 · 기명피보험자 · 30일 초과 임차인 · 동거 친족)의 무면허 · 음주, 고의. 「해당 없음」과 항목은 함께 고를 수 없다.
 * 아무것도 고르지 않으면 보내지 않는다(BE: 해당 없음으로 가정). 고르면 바로 저장해 새 버전이 생긴다.
 */
function Exclusions({ busy, onSave }: { busy: boolean; onSave: (facts: CaseFacts) => void }) {
  const [picked, setPicked] = useState<"none" | (typeof EXCLUSIONS)[number][] | null>(null);
  const chip = (active: boolean) =>
    `inline-flex h-8 items-center rounded-control border px-3 text-body transition-colors ${
      active ? "border-primary-strong bg-primary-soft font-semibold text-on-primary-soft" : "border-line-strong bg-control text-ink hover:border-primary-strong"
    }`;
  function choose(next: "none" | (typeof EXCLUSIONS)[number][]) {
    setPicked(next);
    const facts: CaseFacts = Object.fromEntries(EXCLUSIONS.map((k) => [k, next !== "none" && next.includes(k)]));
    onSave(facts);
  }
  return (
    <div className="mb-4">
      <p className="text-caption text-ink-muted" title="운전자(계약자 · 기명피보험자 · 30일 초과 임차인 · 동거 친족) 기준">
        면책 사유 <span className="text-ink-faint">· 고르지 않으면 해당 없음으로 가정해요</span>
      </p>
      <div role="group" aria-label="면책 사유" className="mt-1.5 flex flex-wrap gap-1.5">
        <button type="button" disabled={busy} aria-pressed={picked === "none"} className={chip(picked === "none")} onClick={() => choose("none")}>
          해당 없음
        </button>
        {EXCLUSIONS.map((k) => {
          const on = Array.isArray(picked) && picked.includes(k);
          return (
            <button
              key={k}
              type="button"
              disabled={busy}
              aria-pressed={on}
              className={chip(on)}
              onClick={() => {
                const now = Array.isArray(picked) ? picked : [];
                choose(on ? now.filter((x) => x !== k) : [...now, k]);
              }}
            >
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 협의 과실 — 상대와 과실을 다르게 합의했을 때만. 이유가 있어야 저장한다. */
function AgreedFault({ current, busy, onSave }: { current: string; busy: boolean; onSave: (fault: number | null, reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [fault, setFault] = useState("");
  const [reason, setReason] = useState("");
  const value = Number(fault);
  const valid = fault !== "" && Number.isInteger(value) && value >= 0 && value <= 100 && reason.trim() !== "";
  if (!open) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span>{current}</span>
        <button type="button" className="text-caption font-semibold text-primary-strong hover:underline" onClick={() => setOpen(true)}>
          바꾸기
        </button>
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-caption text-ink-muted">
        상대 과실
        <Input type="number" min={0} max={100} value={fault} onChange={(e) => setFault(e.target.value)} className="h-9 w-20" aria-label="협의 상대 과실(%)" />%
      </label>
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="합의한 이유 (필수)" className="h-9" aria-label="협의 이유" />
      <span className="flex gap-2">
        <Button size="sm" disabled={!valid || busy} onClick={() => onSave(value, reason.trim())}>
          {busy ? "저장 중" : "저장"}
        </Button>
        <Button size="sm" variant="quiet" onClick={() => setOpen(false)}>
          취소
        </Button>
      </span>
    </div>
  );
}

/** 확인 완료 — 상대방 정보(차량번호 · 보험사 · 사고접수번호)는 선택이다. 셋 다 비우면 보내지 않는다. */
function ConfirmForm({ busy, onConfirm }: { busy: boolean; onConfirm: (counterparty: { vehicle_no: string; insurer: string; claim_no: string } | null) => void }) {
  const [vehicle, setVehicle] = useState("");
  const [insurer, setInsurer] = useState("");
  const [claimNo, setClaimNo] = useState("");
  const filled = vehicle.trim() !== "" && insurer.trim() !== "";
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-semibold">보고서를 확인하고 구상 청구서를 만들어요</p>
        <p className="mt-0.5 text-caption text-ink-muted">상대방 정보는 선택이에요. 넣으면 청구서에 함께 적혀요.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="상대 차량번호" aria-label="상대 차량번호" className="h-9" />
        <Input value={insurer} onChange={(e) => setInsurer(e.target.value)} placeholder="상대 보험사" aria-label="상대 보험사" className="h-9" />
        <Input value={claimNo} onChange={(e) => setClaimNo(e.target.value)} placeholder="상대 사고접수번호" aria-label="상대 사고접수번호" className="h-9" />
      </div>
      <div className="flex justify-end">
        <Button
          className="h-10 px-6"
          disabled={busy}
          onClick={() => onConfirm(filled ? { vehicle_no: vehicle.trim(), insurer: insurer.trim(), claim_no: claimNo.trim() } : null)}
        >
          {busy ? (
            <>
              <Spinner className="h-4! w-4!" /> 확인 중
            </>
          ) : (
            "확인 완료"
          )}
        </Button>
      </div>
    </div>
  );
}
