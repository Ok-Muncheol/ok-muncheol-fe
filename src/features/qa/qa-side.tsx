/**
 * B: 검토 보고서 화면 오른쪽의 질의응답 자리(qaSlot, src/lib/qa/view.ts). 물을 수 있으면 근거 질의응답(QaPanel)을,
 * 아니면 물을 수 있는 곳을 알린다. 머리줄은 늘 「근거 질의응답」이다. 서버 컴포넌트다 — QaPanel만 클라이언트다.
 * 보고서 버전 화면(/reports/[version])과 보고서 전 자리(/reports)가 같이 쓰고, 접힘 여부 쿠키(QA_PANEL_COOKIE)도 같이 쓴다.
 */
import type { ReactNode } from "react";
import { QaPanel } from "@/features/qa/qa-panel";
import type { ApiError } from "@/lib/api/types";
import type { QaSlot } from "@/lib/qa/view";
import { ButtonLink, Card, Notice } from "@/ui/controls";

/** 근거 질의응답 패널을 접었는지 — 담당자 브라우저 쿠키("closed"면 접힘). 서버가 첫 화면을 같은 모양으로 그린다 */
export const QA_PANEL_COOKIE = "okm-qa-panel";

function Version({ n }: { n: number }) {
  return <span className="font-mono tabular-nums">v{n}</span>;
}

export function QaSide({ caseId, live, base, error, slot }: { caseId: string; live: boolean; base: string; error: ApiError | null; slot: QaSlot }) {
  if (error) {
    // 판단 조회 실패 — 답의 근거가 될 최신 판정을 모른다. BE가 돌려준 이유를 그대로 보여 준다(로그인 전 401 등).
    return (
      <QaCard>
        <Notice tone="danger" title="최신 판정을 불러오지 못했다">
          <p>{error.message}</p>
          <p className="mt-1 text-caption">
            오류 코드 <span className="font-mono">{error.code}</span>
            {error.retryable && " · 잠시 후 이 화면을 다시 열면 다시 읽는다."}
          </p>
        </Notice>
      </QaCard>
    );
  }
  switch (slot.kind) {
    case "ready":
      return <QaPanel caseId={caseId} live={live} judgmentVersion={slot.judgmentVersion} />;
    case "undecided":
      return (
        <QaCard>
          <Notice tone="info" title="판정이 난 판단이 없다">
            질의응답은 최신 판정을 근거로 답한다. 아직 판정이 나지 않았거나 새 판단이 진행 중이면 묻지 않고, 판정이 나면 여기서 묻는다. 진행
            상태는 판단 화면에서 본다.
          </Notice>
        </QaCard>
      );
    case "not_latest":
      return (
        <QaCard>
          {slot.latestReport !== null ? (
            <Notice tone="info" title="최신 보고서에서 묻는다">
              <p>
                질의응답은 최신 판정(판단 <Version n={slot.judgmentVersion} />)을 근거로 답한다. 이 화면은 최신 보고서가 아니라 답의 근거가
                보고서와 어긋날 수 있다.
              </p>
              <div className="mt-3">
                <ButtonLink href={`${base}/reports/${slot.latestReport}`} variant="secondary" size="sm">
                  최신 보고서 <Version n={slot.latestReport} />
                </ButtonLink>
              </div>
            </Notice>
          ) : (
            <Notice tone="info" title="최신 판정의 보고서가 없다">
              <p>
                질의응답은 최신 판정(판단 <Version n={slot.judgmentVersion} />)을 근거로 답하는데, 그 판정으로 만든 보고서가 아직 없다.
              </p>
              <div className="mt-3">
                <ButtonLink href={`${base}/reports`} variant="secondary" size="sm">
                  최신 판정으로 묻기
                </ButtonLink>
              </div>
            </Notice>
          )}
        </QaCard>
      );
  }
}

function QaCard({ children }: { children: ReactNode }) {
  return <Card title="근거 질의응답">{children}</Card>;
}

/** 근거 질의응답 아이콘(말풍선) — 패널을 접었을 때 남는 버튼에 쓴다. 장식이라 이름은 버튼이 따로 준다. */
export function QaIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7.5L6 19.5V16a2 2 0 0 1-2-2z" />
      <path d="M8.5 8.5h7M8.5 11.5h4.5" />
    </svg>
  );
}
