/**
 * C 개발 전용: 세 코퍼스 근거 표시·출처/검수 상태 미리보기. 운영 배포(VERCEL_ENV=production)에서는 없는 페이지다.
 * 값은 모두 합성 견본이다. 실제 원문·청크·서명 URL·평가 정답을 넣지 않는다.
 */
import { notFound } from "next/navigation";
import { EvidencePanel, type EvidenceDecision } from "@/features/evidence/evidence-panel";
import { CorpusPreview, type CorpusDocumentView } from "@/features/knowledge/corpus-preview";
import type { Corpus, EvidenceHit, SourceDocument } from "@/lib/api/types";
import { PageHeader } from "@/ui/controls";

const HASH = "0".repeat(64);

function doc(corpus: Corpus, edition: string, effective_from: string): SourceDocument {
  return {
    document_id: `synthetic-${corpus}`,
    corpus,
    source_uri: `synthetic-bucket/${corpus}/견본.pdf`,
    edition,
    effective_from,
    effective_to: null,
    content_hash: HASH,
    parser_version: "synthetic-v1",
  };
}

function hit(corpus: Corpus, parent: string, page: number, edition: string, from: string): EvidenceHit {
  return {
    chunk: {
      chunk_id: `${corpus}-${parent}`,
      parent_id: `synthetic-${corpus}:${parent}`,
      document: doc(corpus, edition, from),
      page_start: page,
      page_end: page + (corpus === "dispute_cases" ? 1 : 0),
      text: "합성 근거 문장",
      metadata: {},
    },
    score: 0.5,
    retrieval_version: "synthetic-v1",
  };
}

const HITS: EvidenceHit[] = [
  hit("fault_standards", "합1-1", 12, "2099.1", ""),
  hit("dispute_cases", "사례-1", 30, "unconfirmed", ""),
];
const DECISIONS: Record<string, EvidenceDecision> = {
  "fault_standards-합1-1": { status: "selected", reason: "합성 견본: 신호·진행 방향이 도표 조건과 일치" },
};

const DOCUMENTS: CorpusDocumentView[] = [
  {
    document_id: "synthetic-fault_standards",
    source_name: "견본 인정기준.pdf",
    edition: "2099.1",
    effective_from: "",
    effective_period_status: "unknown",
    content_hash: HASH,
    parser_version: "synthetic-v1",
    usage_status: "permission_required",
    reviewed_by: null,
  },
];

export default function DevCorporaPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <>
      <PageHeader eyebrow="개발 전용 · 합성 견본" title="근거·코퍼스 미리보기" description="세 코퍼스 구분, 원문 페이지·미확인 상태 표시를 확인한다." />
      <div className="grid gap-6 lg:grid-cols-2">
        <EvidencePanel hits={HITS} decisions={DECISIONS} />
        <div className="grid gap-6">
          <EvidencePanel hits={[]} />
          <CorpusPreview
            corpus="fault_standards"
            reviewStatus="pending_storage_and_rights_review"
            documents={DOCUMENTS}
            metrics={{ status: "synthetic", values: { "Top-1": null, "R@3": null }, limitations: ["합성 견본: 실제 지표 아님"] }}
          />
          <CorpusPreview corpus="policy_terms" reviewStatus="" documents={[]} metrics={null} />
        </div>
      </div>
    </>
  );
}
