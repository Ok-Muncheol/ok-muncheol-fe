/**
 * C: 개발용 코퍼스 출처·검수 상태 미리보기. /dev/corpora에서만 쓰고 운영 배포에서는 그 라우트가 열리지 않는다.
 * 값은 BE manifest와 검색 평가 산출물을 그대로 보인다. FE에서 지표를 다시 계산하거나 반올림·백분율로 바꾸지 않는다.
 * 평가 실행·관리자 API는 별도 계약이 필요해 이 부품에 두지 않는다.
 */
import type { Corpus } from "@/lib/api/types";
import { Badge, Card, DescriptionList, DescriptionRow, Empty, Notice, Table, Td, Th } from "@/ui/controls";
import { CORPUS_LABELS } from "../evidence/evidence-panel";

/** data/corpora/<corpus>/manifest.json 문서 한 건에서 화면에 필요한 값. */
export type CorpusDocumentView = {
  document_id: string;
  source_name: string;
  edition: string;
  effective_from: string;
  effective_period_status: string;
  content_hash: string;
  parser_version: string;
  usage_status: string;
  reviewed_by: string | null;
};

/** BE 검색 평가 산출물(이름 → 값). 값이 null이면 미측정. */
export type CorpusMetrics = { status: string; values: Record<string, number | null>; limitations: string[] };

type Props = {
  corpus: Corpus;
  reviewStatus: string;
  documents: CorpusDocumentView[];
  metrics?: CorpusMetrics | null;
};

function Missing({ value, label = "미확인" }: { value: string | null | undefined; label?: string }) {
  return !value || value === "unconfirmed" || value === "unknown" ? <Empty>{label}</Empty> : <>{value}</>;
}

export function CorpusPreview({ corpus, reviewStatus, documents, metrics }: Props) {
  return (
    <Card title={CORPUS_LABELS[corpus]} aside={<Badge tone={reviewStatus ? "warning" : "neutral"}>{reviewStatus || "검수 상태 미확인"}</Badge>}>
      {documents.length === 0 ? (
        <Empty>등록된 원문 없음</Empty>
      ) : (
        documents.map((doc) => (
          <DescriptionList key={doc.document_id} className="mb-4">
            <DescriptionRow term="원문">{doc.source_name}</DescriptionRow>
            <DescriptionRow term="적용판">
              <Missing value={doc.edition} />
            </DescriptionRow>
            <DescriptionRow term="적용 시작" note={doc.effective_period_status}>
              <Missing value={doc.effective_from} />
            </DescriptionRow>
            <DescriptionRow term="이용조건">{doc.usage_status}</DescriptionRow>
            <DescriptionRow term="검수자">
              <Missing value={doc.reviewed_by} label="검수 전" />
            </DescriptionRow>
            <DescriptionRow term="파서 · 해시">
              <span className="font-mono text-caption break-all">
                {doc.parser_version} · {doc.content_hash.slice(0, 12)}
              </span>
            </DescriptionRow>
          </DescriptionList>
        ))
      )}
      {metrics ? (
        <>
          <Table>
            <caption className="mb-2 text-left text-caption text-ink-muted">검색 평가 지표 (BE 산출물 · {metrics.status})</caption>
            <thead>
              <tr>
                <Th>지표</Th>
                <Th>값</Th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics.values).map(([name, value]) => (
                <tr key={name}>
                  <Td className="font-mono">{name}</Td>
                  <Td className="font-mono tabular-nums">{value === null ? <Empty>미측정</Empty> : String(value)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {metrics.limitations.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-caption text-ink-muted">
              {metrics.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <Notice tone="info">BE 검색 평가 지표가 아직 없습니다.</Notice>
      )}
    </Card>
  );
}
