/**
 * A: 근거 프레임 목록 — 카드 칸의 프레임 링크(#frame-…)가 여기로 온다. 온 프레임은 옥색 테두리로 표시한다.
 * 이미지는 그리지 않는다 — 비공개 파일은 BE가 준 권한 있는 URL로만 열고, storage_path를 공개 URL로 바꾸지 않는다.
 * TODO(A): 권한 있는 프레임 URL 조회·영상 재생 위치 이동.
 */
import { fieldLabel } from "@/lib/api/chart-scope";
import type { FactCard } from "@/lib/api/types";
import { frameTime } from "@/lib/facts/view";
import { Card, Empty } from "@/ui/controls";

export function EvidenceFrames({ card }: { card: Pick<FactCard, "evidence_frames" | "fields"> }) {
  const frames = [...card.evidence_frames].sort((a, b) => a.timestamp_ms - b.timestamp_ms);
  // 겉을 카드로 한 번 더 싸지 않는다 — 프레임마다 카드 하나로 두어 미리보기를 열 폭 가득 쓴다.
  return (
    <section aria-labelledby="evidence-frames-title" className="flex flex-col gap-3">
      <h2 id="evidence-frames-title" className="text-heading font-semibold">
        근거 프레임
      </h2>
      {frames.length === 0 ? (
        <Card>
          <Empty>근거 프레임이 없다</Empty>
        </Card>
      ) : (
        <ol className="flex flex-col gap-4">
          {frames.map((frame) => {
            const used = Object.entries(card.fields).filter(([, field]) => field.evidence_frame_ids.includes(frame.frame_id));
            return (
              <li
                key={frame.frame_id}
                id={`frame-${frame.frame_id}`}
                className="scroll-mt-20 overflow-hidden rounded-card border border-line bg-surface shadow-card target:border-primary-strong target:bg-primary-soft"
              >
                <div className="flex aspect-video items-center justify-center bg-surface-muted text-caption text-ink-muted">프레임 미리보기 연결 전</div>
                <p className="flex flex-wrap items-baseline gap-x-2 px-4 py-3">
                  <span className="font-mono font-semibold tabular-nums">{frameTime(frame.timestamp_ms)}</span>
                  <span className="text-caption text-ink-muted">{used.length > 0 ? used.map(([key]) => fieldLabel(key)).join(" · ") : "연결된 칸 없음"}</span>
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
