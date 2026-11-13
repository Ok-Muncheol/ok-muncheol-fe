/**
 * A·B: 사건 화면 머리 — 접수 · 판단 · 검토 보고서 세 화면이 같은 자리에 같은 모양으로 둔다.
 * 위 줄 왼쪽은 「← 담당 사건」, 오른쪽은 진행 단계 한 줄(CaseStepper). 아래는 사건 이름(사고 날짜, caseTitle)과
 * 사건번호 · 사고일 · 배정일 한 줄이다. progress가 없으면(사건 요약을 못 읽음) 진행 단계 한 줄을 그리지 않는다.
 * 훅을 쓰지 않아 서버 화면과 클라이언트 화면(접수 화면) 어디서나 쓴다.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import type { BoardColumnKey } from "@/lib/cases/stages";
import { caseTitle, koreanDay } from "@/lib/cases/intake";
import { CaseStepper, type StepperCase } from "./case-stepper";

export type CaseHeadInfo = { caseId: string; accidentDate: string | null | undefined; assignedAt?: string | null };

export function CaseHeader({ info, progress, viewing, badge }: { info: CaseHeadInfo; progress?: StepperCase | null; viewing: BoardColumnKey; badge?: ReactNode }) {
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/cases" className="text-caption text-ink-muted hover:text-ink">
          ← 담당 사건
        </Link>
        {progress && <CaseStepper summary={progress} viewing={viewing} />}
      </div>
      <h1 className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-title font-bold tracking-tight break-keep">
        {caseTitle(info.accidentDate)}
        {badge}
      </h1>
      <p className="mt-1 text-caption text-ink-muted">
        <span className="font-mono tabular-nums">{info.caseId}</span>
        {info.accidentDate && <> · 사고 {koreanDay(info.accidentDate)}</>}
        {info.assignedAt && <> · {koreanDay(info.assignedAt)} 배정</>}
      </p>
    </header>
  );
}
