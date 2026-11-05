/** C: 개발용 표시 부품. 라우트 연결 시 운영 접근 차단 필수. 평가 실행 기능은 미구현. */
import type { Corpus } from "../../lib/api/types";
export function CorpusPreview({ corpus, reviewStatus }: { corpus: Corpus; reviewStatus: string }) {
  return <section aria-label="코퍼스 검수"><h2>{corpus}</h2><p>{reviewStatus}</p></section>;
}
