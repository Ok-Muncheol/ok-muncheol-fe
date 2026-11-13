/**
 * A·D: 구상 청구서 — 확인 완료한 검토 보고서로 BE가 만든 청구서(ClaimPackage)를 문서 한 장처럼 보인다.
 * 위는 청구번호 · 상대방 · 확인 기록, 가운데는 금액 표(자차 보험금 × 상대 과실 = 청구액), 아래는 근거 조항 · 증빙 · 빠진 증빙 · 기본 가정.
 * 예시 규칙이면 「약관 검수 전 초안」을 눈에 띄게 둔다. 인쇄하면 앱 메뉴 없이 이 문서만 나온다(app-shell의 print:hidden).
 * 금액은 BE 값 그대로다(FE가 계산하지 않는다).
 */
import type { ClaimPackage } from "@/lib/api/types";

const dateTime = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Seoul" });
const won = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toLocaleString("ko-KR")}원`);
const when = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date);
};
const names = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : String((x as { 조항?: string })?.조항 ?? x))) : []);

export function ClaimView({ claim }: { claim: ClaimPackage }) {
  const row = claim.rows[0];
  const basis = names(claim.basis["근거 조항"]);
  const evidence = claim.evidence as { document_id?: string; title?: string; doc_type?: string }[];
  return (
    <article aria-label="구상 청구서" className="rounded-card border border-line bg-surface px-8 py-7 print:border-0 print:px-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-caption text-ink-muted">구상 청구서</p>
          <h2 className="mt-0.5 text-title font-bold tracking-tight">
            <span className="font-mono tabular-nums">{row?.claim_no ?? `${claim.case_id}-C${claim.package_version}`}</span>
          </h2>
          <p className="mt-1 text-caption text-ink-muted">
            검토 보고서 v{claim.report_version} 기준 · 청구서 {claim.package_version}판 · {when(claim.created_at)}
          </p>
        </div>
        {claim.rule_notice && <span className="rounded-badge bg-warning-soft px-2.5 py-1 text-caption font-semibold text-on-warning-soft">{claim.rule_notice}</span>}
      </header>

      <section aria-label="상대방" className="grid gap-x-8 gap-y-3 border-b border-line py-5 text-body sm:grid-cols-3">
        <Meta term="상대 보험사">{claim.counterparty?.insurer ?? "미입력"}</Meta>
        <Meta term="상대 차량번호">{claim.counterparty?.vehicle_no ?? "미입력"}</Meta>
        <Meta term="상대 사고접수번호">{claim.counterparty?.claim_no ?? "미입력"}</Meta>
      </section>

      <section aria-label="청구 금액" className="border-b border-line py-5">
        <table className="w-full text-body">
          <thead>
            <tr className="text-left text-caption text-ink-muted">
              <th className="pb-2 font-normal">담보</th>
              <th className="pb-2 text-right font-normal">지급한 자차 보험금</th>
              <th className="pb-2 text-right font-normal">상대 과실</th>
              <th className="pb-2 text-right font-normal">청구액</th>
            </tr>
          </thead>
          <tbody>
            {claim.rows.map((r) => (
              <tr key={r.claim_no} className="border-t border-line">
                <td className="py-2.5">{r.coverage}</td>
                <td className="py-2.5 text-right tabular-nums">{won(r.insurance_payment)}</td>
                <td className="py-2.5 text-right tabular-nums">{r.counterparty_fault}%</td>
                <td className="py-2.5 text-right font-semibold tabular-nums">{won(r.planned_share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex items-baseline justify-end gap-4 rounded-control bg-primary-soft px-4 py-3">
          <span className="text-body font-semibold text-on-primary-soft">청구 합계</span>
          <span className="text-2xl font-bold tracking-tight text-on-primary-soft tabular-nums">{won(claim.amounts.claimed)}</span>
        </div>
        {claim.fault_change_reason && <p className="mt-2 text-caption text-ink-muted">협의 과실 반영 — {claim.fault_change_reason}</p>}
      </section>

      <section aria-label="근거와 증빙" className="grid gap-6 py-5 sm:grid-cols-2">
        <div>
          <h3 className="text-caption font-semibold text-ink-muted">근거 조항</h3>
          <ul className="mt-1.5 flex flex-col gap-1 text-body">{basis.length > 0 ? basis.map((b) => <li key={b}>{b}</li>) : <li className="text-ink-muted">—</li>}</ul>
        </div>
        <div>
          <h3 className="text-caption font-semibold text-ink-muted">첨부 증빙 {evidence.length}건</h3>
          <ul className="mt-1.5 flex flex-col gap-1 text-body">
            {evidence.map((e, i) => (
              <li key={e.document_id ?? i}>{e.title ?? e.document_id ?? e.doc_type}</li>
            ))}
            {claim.missing_evidence.map((m) => (
              <li key={m} className="flex items-center gap-2 text-on-warning-soft">
                <span aria-hidden className="size-1.5 rounded-full bg-warning" />
                빠짐: {m}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {claim.assumptions.length > 0 && (
        <section aria-label="기본 가정" className="border-t border-line pt-4">
          <ul className="flex flex-col gap-1 text-caption text-ink-muted">
            {claim.assumptions.map((a) => (
              <li key={a} className="flex gap-2">
                <span className="shrink-0 rounded-badge bg-surface-muted px-1.5 font-semibold">가정</span>
                {a}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-6 flex flex-wrap justify-between gap-2 border-t border-line pt-4 text-caption text-ink-faint">
        <span>확인 {when(claim.confirmed_at)}</span>
        <span>규칙 {claim.rule_version}</span>
      </footer>
    </article>
  );
}

function Meta({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-caption text-ink-muted">{term}</p>
      <p className="mt-0.5">{children}</p>
    </div>
  );
}
