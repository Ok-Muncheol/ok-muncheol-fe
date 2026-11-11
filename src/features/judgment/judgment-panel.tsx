/**
 * B: 판정과 검증 3겹 표시. 판정(JudgmentOutcome)은 판단 화면(/cases/[id]/judgment)과 검토 보고서(ReviewReport)가 같이 쓰고,
 * 검증 3겹(ValidationLayers)은 검토 보고서만 쓴다. 판단 화면에서는 BE가 판정 사유에 넣은 걸린 검증의 이유로 충분하다.
 * 도표·적용판·과실비율·계산 로그는 BE 값을 그대로 그린다. 값이 없으면 Empty로 비우고 0이나 추정값으로 채우지 않는다.
 */
import { CheckLabel, StatusLabel } from "@/components/status-label";
import type { JudgmentResult, ValidationCheck } from "@/lib/api/types";
import { ATTEMPT_LABELS, REBUTTAL_KIND_LABELS, validationLayers, type Layer } from "@/lib/judgment/view";
import { Badge, Blank, Card, DescriptionList, DescriptionRow, Empty } from "@/ui/controls";

/** 판정 + 검증 3겹(검토 보고서). */
export function JudgmentPanel({ result }: { result: JudgmentResult }) {
  return (
    <div className="flex flex-col gap-6">
      <JudgmentOutcome result={result} />
      <ValidationLayers checks={result.checks} />
    </div>
  );
}

/** evidenceHref가 있으면 적용 도표에서 그 화면의 판정 근거로 이동한다(판단 화면). */
export function JudgmentOutcome({ result, evidenceHref }: { result: JudgmentResult; evidenceHref?: string }) {
  const hasFault = result.fault_A !== null && result.fault_B !== null;
  return (
    <Card title="판정" aside={<StatusLabel status={result.status} />}>
      {result.reasons.length > 0 && (
        <div className="mb-4">
          <h3 className="text-caption font-semibold text-ink-muted">사유</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {result.reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
      <DescriptionList>
        <DescriptionRow term="적용 도표" note={result.edition && <>적용판 <span className="font-mono">{result.edition}</span></>}>
          {result.chart_id ? (
            <>
              <span className="font-mono">{result.chart_id}</span>
              {evidenceHref && (
                <a href={evidenceHref} className="ml-2 text-caption text-primary-strong underline-offset-4 hover:underline">
                  근거 보기
                </a>
              )}
            </>
          ) : (
            <Empty />
          )}
        </DescriptionRow>
        <DescriptionRow term="과실비율 A : B" note={hasFault && "검토 초안 — 담당자가 승인하기 전에는 외부로 전달하지 않는다."}>
          {hasFault ? (
            <span className="font-mono font-semibold tabular-nums">
              {result.fault_A} : {result.fault_B}
            </span>
          ) : (
            <Empty />
          )}
        </DescriptionRow>
        <DescriptionRow term="계산 로그">
          {result.calculation_log.length > 0 ? (
            <ol className="list-decimal space-y-0.5 pl-5 font-mono text-caption tabular-nums">
              {result.calculation_log.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          ) : (
            <Empty>없음</Empty>
          )}
        </DescriptionRow>
      </DescriptionList>
    </Card>
  );
}

/** 판정 전 화면의 빈 판정 — 판정(JudgmentOutcome)과 같은 칸을 비워 둔다. label은 머리 배지(판정 전·기록 없음)다. */
export function JudgmentSkeleton({ label }: { label: string }) {
  return (
    <Card title="판정" aside={<Badge dot>{label}</Badge>}>
      <DescriptionList>
        <DescriptionRow term="적용 도표">
          <Blank />
        </DescriptionRow>
        <DescriptionRow term="과실비율 A : B">
          <Blank />
        </DescriptionRow>
        <DescriptionRow term="계산 로그">
          <Blank />
        </DescriptionRow>
      </DescriptionList>
    </Card>
  );
}

export function ValidationLayers({ checks }: { checks: readonly ValidationCheck[] }) {
  const layers = validationLayers(checks);
  return (
    <Card title="검증 3겹">
      <ol className="flex flex-col divide-y divide-line">
        {layers.map((layer, i) => (
          <li key={layer.key} className="grid gap-x-6 gap-y-2 py-3 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-semibold">
                <span aria-hidden className="font-mono text-caption text-ink-muted tabular-nums">
                  {i + 1}
                </span>
                {layer.label}
              </p>
              <p className="text-caption text-ink-muted">{layer.description}</p>
            </div>
            <LayerResult layer={layer} />
          </li>
        ))}
      </ol>
      {layers.some((l) => l.state === "not_run") && (
        <p className="mt-4 text-caption text-ink-muted">실행 안 함 — 앞 단계에서 판정이 나서 이 층까지 가지 않았다.</p>
      )}
    </Card>
  );
}

function LayerResult({ layer }: { layer: Layer }) {
  // 두 번 시도한 층(반박 뒤 차순위 도표)은 시도마다 결과를 따로 적는다. 한 번이면 이유만 적는다.
  const several = layer.attempts.length > 1;
  const reasons = layer.attempts.length === 1 ? layer.attempts[0].reasons : [];
  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <CheckLabel state={layer.state} />
        {layer.rebuttalKind && <Badge>{REBUTTAL_KIND_LABELS[layer.rebuttalKind]}</Badge>}
      </div>
      {several ? (
        <ol className="flex flex-col gap-1">
          {layer.attempts.map((attempt, i) => (
            <li key={i}>
              <span className="font-semibold">{ATTEMPT_LABELS[i] ?? `${i + 1}번째`}</span>
              <span className="text-ink-muted">
                {" "}
                — {attempt.passed ? "통과" : attempt.rebuttal_kind ? REBUTTAL_KIND_LABELS[attempt.rebuttal_kind] : "확인 필요"}
              </span>
              {attempt.reasons.length > 0 && <span>: {attempt.reasons.join(" · ")}</span>}
            </li>
          ))}
        </ol>
      ) : (
        reasons.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5">
            {reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
