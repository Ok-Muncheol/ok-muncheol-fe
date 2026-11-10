/**
 * C: 세 코퍼스 근거 표시. 인정기준·결정례·약관을 따로 묶고, 근거마다 부모 ID·적용판·적용기간·원문 페이지를 보인다.
 * 원문 링크는 BE가 내준 서명 URL(sourceLinks)만 쓴다. document.source_uri는 비공개 Storage 경로라 링크로 쓰지 않는다.
 * 서명 URL은 견본·로그에 남기지 않는다(FE TEAM.md 「원칙」). 선택/제외 이유는 BE 판단 결과 값을 그대로 보인다.
 */
import type { Corpus, EvidenceHit, SourceDocument } from "@/lib/api/types";
import { Badge, Card, Empty, Notice, type Tone } from "@/ui/controls";

export const CORPUS_ORDER: Corpus[] = ["fault_standards", "dispute_cases", "policy_terms"];
export const CORPUS_LABELS: Record<Corpus, string> = {
  fault_standards: "과실비율 인정기준",
  dispute_cases: "분쟁심의 결정례",
  policy_terms: "자동차보험 약관",
};

export type EvidenceDecision = { status: "selected" | "excluded" | "unconfirmed"; reason?: string | null };

const DECISIONS: Record<EvidenceDecision["status"], { text: string; tone: Tone }> = {
  selected: { text: "판단에 사용", tone: "success" },
  excluded: { text: "제외", tone: "neutral" },
  unconfirmed: { text: "사용 여부 미확인", tone: "warning" },
};

type Props = {
  hits: EvidenceHit[];
  /** document_id → BE가 발급한 짧은 만료 서명 URL. 없으면 원문 링크를 보이지 않는다. */
  sourceLinks?: Record<string, string>;
  /** chunk_id → 선택/제외와 이유(BE 판단 결과). 없으면 미확인. */
  decisions?: Record<string, EvidenceDecision>;
};

/** 판 값이 비었거나 BE가 unconfirmed로 표시하면 미확인이다. */
function isUnconfirmed(value: string | null | undefined): boolean {
  return !value || value === "unconfirmed";
}

function pageText(start: number, end: number): string {
  return start === end ? `${start}쪽` : `${start}~${end}쪽`;
}

/** 서명 URL에 PDF 페이지 조각을 붙인다. https가 아니면 버린다(임의 스킴 차단). */
export function sourcePageHref(signedUrl: string | undefined, page: number): string | null {
  if (!signedUrl) return null;
  let url: URL;
  try {
    url = new URL(signedUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  url.hash = `page=${page}`;
  return url.toString();
}

function documentName(document: SourceDocument): string {
  const name = document.source_uri.split("/").pop() || document.document_id;
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function EvidenceItem({ hit, link, decision }: { hit: EvidenceHit; link?: string; decision?: EvidenceDecision }) {
  const { chunk } = hit;
  const { document } = chunk;
  const state = DECISIONS[decision?.status ?? "unconfirmed"];
  const href = sourcePageHref(link, chunk.page_start);
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-caption break-all">{chunk.parent_id}</span>
        <Badge tone={state.tone} dot>
          {state.text}
        </Badge>
        {isUnconfirmed(document.edition) && <Badge tone="warning">적용판 미확인</Badge>}
      </div>
      <p className="mt-1 text-caption text-ink-muted">
        {documentName(document)} · 판 {isUnconfirmed(document.edition) ? <Empty>미확인</Empty> : document.edition} · 적용{" "}
        {document.effective_from ? `${document.effective_from}부터` : <Empty>기간 미확인</Empty>} ·{" "}
        <span className="font-mono tabular-nums">{pageText(chunk.page_start, chunk.page_end)}</span>
      </p>
      <p className="mt-1 text-body">{decision?.reason ? decision.reason : <Empty>선택·제외 이유 없음</Empty>}</p>
      <p className="mt-1 text-caption">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-strong underline">
            원문 {chunk.page_start}쪽 열기
          </a>
        ) : (
          <Empty>원문 열람 권한 확인 전</Empty>
        )}
      </p>
    </li>
  );
}

export function EvidencePanel({ hits, sourceLinks = {}, decisions = {} }: Props) {
  return (
    <section aria-label="판단 근거" className="grid gap-4">
      <h2 className="text-heading font-semibold">근거</h2>
      {hits.length === 0 && (
        <Notice tone="warning" title="확인된 근거 없음">
          세 코퍼스에서 판단에 쓸 근거를 찾지 못했습니다. 근거 없이 판정하지 않으며 추가 확인이 필요합니다.
        </Notice>
      )}
      {hits.length > 0 &&
        CORPUS_ORDER.map((corpus) => {
          const group = hits.filter((hit) => hit.chunk.document.corpus === corpus);
          return (
            <Card key={corpus} title={CORPUS_LABELS[corpus]} aside={<Badge>{group.length}건</Badge>}>
              {group.length === 0 ? (
                <Empty>이 코퍼스의 근거 없음</Empty>
              ) : (
                <ul className="divide-y divide-line">
                  {group.map((hit) => (
                    <EvidenceItem
                      key={hit.chunk.chunk_id}
                      hit={hit}
                      link={sourceLinks[hit.chunk.document.document_id]}
                      decision={decisions[hit.chunk.chunk_id]}
                    />
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
    </section>
  );
}
