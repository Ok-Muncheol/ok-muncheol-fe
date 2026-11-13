"use client";

/**
 * A: 새 사건 — 사고 날짜와 블랙박스 영상만 받는다. 「분석 시작」 한 번으로 사건 생성 → 업로드 URL 발급 → 영상 PUT → 분석 접수를 잇고,
 * 같은 자리가 「영상 분석 중이에요」로 바뀐다. 사건이 생기면 주소만 /cases/{id}로 바꿔(history.replaceState — 화면은 다시 그리지 않아
 * 업로드가 끊기지 않는다) 새로고침해도 사건 화면이 같은 상태를 서버에서 다시 읽어 그린다. 분석이 끝나면 판단 화면으로 넘어간다.
 * 사건 이름은 사고 날짜다(caseTitle). 영상 없는 사건(직접 입력)은 아직 받지 않는다.
 * 배정된 사건(/cases/[id])은 단계와 상관없이 늘 이 화면이 접수 화면이다 — 머리(CaseHeader)는 사건 화면이 그리고, 여기는
 * 위에서부터 영상(올리기 칸 · 고른 영상 · 올린 영상) → 상태 한 줄(분석 시작 · 올리는 중 · 분석 중 · 실패 · 분석 완료와 다음 단계) → 사건 정보 상자다.
 * 견본 모드는 BE에 보내지 않고 진행만 흉내 낸 뒤 견본 사건의 판단 화면으로 간다.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { createBrowserApiClient } from "@/lib/api/browser";
import { asApiError, newIdempotencyKey } from "@/lib/api/client";
import type { ApiError, CaseStage, TaskStatus, VersionRef } from "@/lib/api/types";
import { caseTitle, isBeforeCard, todayInKorea, videoContentType, videoProblem } from "@/lib/cases/intake";
import { stageHref } from "@/lib/cases/stages";
import { Button, ButtonLink, Input, Spinner } from "@/ui/controls";
import { UploadError, uploadFile } from "./upload";

/**
 * 이미 있는 사건(배정된 사건 · 새로고침 · 다시 들어옴)의 지금 상태 — 사건 화면이 서버에서 읽어 넘긴다.
 * 접수 단계(intake)는 아직 영상이 없어 올리기 화면이고, 분석 단계(analysis)에서 작업이 대기·진행 중이면 분석 중 화면이다.
 */
export type ExistingCase = {
  caseId: string;
  stage: CaseStage;
  accidentDate: string | null;
  assignedAt?: string | null;
  taskStatus: TaskStatus | null;
  error?: ApiError | null;
  inputPath: "video" | "manual";
  updatedAt: string;
  /** 다음 단계 버튼이 가는 곳(검토 보고서 버전)을 정한다 */
  versions: VersionRef;
  /** 올린 영상의 재생 주소 — BE가 주기 전까지는 없다. */
  videoUrl?: string | null;
};

/** GET /cases/{id}에서 이 화면이 읽는 부분. analysis는 BE가 최신 분석 작업을 실어 줄 때만 있다. */
type CaseState = {
  stage: CaseStage;
  task_status: TaskStatus | null;
  analysis?: { status: TaskStatus; error: ApiError | null } | null;
};

type Phase = { kind: "form" } | { kind: "uploading"; progress: number } | { kind: "analyzing" };

const POLL_MS = 4000;
const SAMPLE_DONE_HREF = "/cases/SYN-2026-0130/judgment";
const FAILED_MESSAGE = "영상 분석이 실패했어요. 다시 시도해 주세요.";

function friendly(error: ApiError): string {
  if (error.code === "network_error") return "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";
  return error.message;
}

const dateTime = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Seoul" });
const dateOnly = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" });
/** 사건 정보 상자의 일시 — "2026년 11월 8일 오전 9:00". 날짜만 온 값은 날짜만. */
function when(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return dateOnly.format(new Date(`${iso}T00:00:00+09:00`));
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateTime.format(date);
}

/** 분석이 끝난 사건의 다음 단계 버튼 글. */
const NEXT_LABEL: Partial<Record<CaseStage, string>> = {
  facts: "사실 카드 확인하기",
  judgment: "과실 판단 보기",
  report: "검토 보고서 보기",
};

/**
 * 사건 정보 상자 — 지금 BE 사건 요약에 있는 값만 보인다(버전 번호 같은 개발 정보는 두지 않는다).
 * TODO(A): 사고 장소 · 고객 · 차량번호 · 접수 경로처럼 접수 때 들어오는 정보는 BE 사건에 칸이 생기면 여기에 더한다.
 */
function CaseInfo({ existing, analysis }: { existing: ExistingCase; analysis: string }) {
  const rows: [string, ReactNode][] = [
    ["사건번호", <span key="id" className="font-mono tabular-nums">{existing.caseId}</span>],
    ["사고 일시", existing.accidentDate ? when(existing.accidentDate) : "모름"],
    ["배정 일시", existing.assignedAt ? when(existing.assignedAt) : "모름"],
    ["입력 경로", existing.inputPath === "video" ? "블랙박스 영상" : "사실 카드 직접 입력"],
    ["영상 분석", analysis],
    ["최근 변경", when(existing.updatedAt)],
  ];
  // 작은 글자 한 줄씩(이름은 옅게, 값은 보통) — 화면의 주인공(영상 · 상태)보다 앞에 나서지 않게 한다.
  return (
    <section aria-labelledby="case-info-title" className="rounded-card border border-line bg-surface">
      <h2 id="case-info-title" className="border-b border-line px-5 py-3 text-body font-semibold">
        사건 정보
      </h2>
      <dl className="grid gap-x-10 px-5 py-3 sm:grid-cols-2">
        {rows.map(([term, value]) => (
          <div key={term} className="flex items-baseline gap-4 py-1.5 text-caption">
            <dt className="w-16 shrink-0 text-ink-muted">{term}</dt>
            <dd className="min-w-0 text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function sizeText(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/**
 * 고른 영상 미리보기. 블랙박스 영상은 MPEG-4 Part 2(mp4v) 코덱이 흔한데 Chrome·Edge는 이걸 재생하지 못한다
 * (팀 데이터셋 AI Hub 영상이 모두 mp4v다). 그런 영상은 까만 화면 대신 미리 볼 수 없다고 알린다 — 분석(OpenCV)은 그대로 읽는다.
 * 영상 트랙 없이 소리만 열리면(videoWidth 0) 같은 경우로 본다.
 */
function VideoPreview({ src }: { src: string }) {
  const [playable, setPlayable] = useState(true);
  if (!playable) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 bg-surface-muted px-6 text-center">
        <p className="text-body font-semibold text-ink">이 영상은 브라우저에서 미리 볼 수 없어요</p>
        <p className="text-caption text-ink-muted">블랙박스에서 흔한 형식이에요. 분석에는 문제없어요.</p>
      </div>
    );
  }
  return (
    <video
      src={src}
      controls
      muted
      playsInline
      preload="metadata"
      onError={() => setPlayable(false)}
      onLoadedMetadata={(e) => {
        if (e.currentTarget.videoWidth === 0) setPlayable(false);
      }}
      className="aspect-video w-full bg-black"
    />
  );
}

/**
 * 서버에 올린 영상 — 다시 들어온 분석 중 사건에서 미리보기 자리에 둔다. 재생 주소(BE가 H.264 사본으로 주는 서명 URL)가 아직 없으면
 * 같은 크기의 빈 자리에 올렸다는 것만 알린다. TODO(A): GET /cases/{id}/video 재생 주소를 사건 화면이 읽어 넘긴다.
 */
function UploadedVideo({ src }: { src: string | null }) {
  if (src) {
    return (
      <div className="overflow-hidden rounded-card border border-line">
        <VideoPreview src={src} />
      </div>
    );
  }
  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-card border border-line bg-surface-muted">
      <p className="text-caption text-ink-muted">영상 미리보기가 아직 없어요</p>
    </div>
  );
}

/** 분석·업로드 실패 — 이유와 다음 행동. 이 브라우저에 고른 영상이 남아 있으면 같은 영상으로 다시 시도할 수 있다. */
function Failure({ message, canRetry, onRetry, onPickAnother }: { message: string; canRetry: boolean; onRetry: () => void; onPickAnother: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-card border border-danger bg-danger-soft px-5 py-4">
      <div>
        <p className="font-semibold text-on-danger-soft">영상을 분석하지 못했어요</p>
        <p className="mt-0.5 text-body text-on-danger-soft">{message}</p>
      </div>
      {canRetry && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={onRetry}>같은 영상으로 다시 시도</Button>
          <Button variant="secondary" onClick={onPickAnother}>
            다른 영상 고르기
          </Button>
        </div>
      )}
    </div>
  );
}

export function CaseIntake({ sample, existing }: { sample: boolean; existing?: ExistingCase }) {
  const router = useRouter();
  const running = existing?.stage === "analysis" && (existing.taskStatus === "queued" || existing.taskStatus === "running");

  const [date, setDate] = useState(existing?.accidentDate?.slice(0, 10) ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>(running ? { kind: "analyzing" } : { kind: "form" });
  const [error, setError] = useState<string | null>(existing?.taskStatus === "failed" ? (existing.error ? friendly(existing.error) : FAILED_MESSAGE) : null);
  const [dragging, setDragging] = useState(false);
  /** 고른 파일이 받지 않는 형식·크기일 때 — 분석 실패(error)와 달리 올리기 칸 아래 한 줄로만 알린다. */
  const [fileProblem, setFileProblem] = useState<string | null>(null);

  // 다시 시도할 때 이미 끝난 단계는 건너뛴다 — 사건은 한 번만 만들고, 올린 영상은 다시 올리지 않는다.
  // ref는 이어지는 요청이 읽고, 화면은 hasCase 상태로 그린다.
  const caseId = useRef<string | null>(existing?.caseId ?? null);
  const [hasCase, setHasCase] = useState(existing !== undefined);
  const storagePath = useRef<string | null>(null);
  const analysisKey = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const title = hasCase || phase.kind !== "form" ? caseTitle(date) : "새 사건";
  // 분석이 끝난 사건(사실 카드 · 판단 · 검토 보고서 단계)과 영상 없이 들어온 사건은 올리기 대신 올린 영상과 다음 단계 버튼을 보인다.
  const settled = existing !== undefined && (existing.inputPath === "manual" || !isBeforeCard(existing.stage));
  const analysis =
    existing?.inputPath === "manual"
      ? "해당 없음"
      : settled
        ? "완료"
        : phase.kind === "uploading"
          ? "영상 올리는 중"
          : phase.kind === "analyzing"
            ? "분석 중"
            : error
              ? "실패"
              : "영상 대기";

  // 영상 미리보기 주소는 바꾸거나 떠나면 브라우저 메모리를 돌려준다.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  // 올리는 중에 창을 닫으면 업로드가 끊긴다.
  useEffect(() => {
    if (phase.kind !== "uploading") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase.kind]);

  // 분석 중이면 사건을 다시 읽는다. 카드가 생기면 판단 화면으로, 실패하면 이유를 보이고 다시 시도하게 한다.
  useEffect(() => {
    if (phase.kind !== "analyzing" || sample || !caseId.current) return;
    const id = caseId.current;
    const api = createBrowserApiClient();
    let stopped = false;
    const tick = async () => {
      try {
        const state = (await api.getCase(id)) as unknown as CaseState;
        if (stopped) return;
        if (!isBeforeCard(state.stage)) {
          router.replace(`/cases/${encodeURIComponent(id)}/judgment`);
        } else if (state.task_status === "failed" || state.analysis?.status === "failed") {
          analysisKey.current = null;
          setError(state.analysis?.error ? friendly(state.analysis.error) : FAILED_MESSAGE);
          setPhase({ kind: "form" });
        }
      } catch {
        // 잠깐 끊긴 조회는 다음 차례에 다시 읽는다.
      }
    };
    const interval = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [phase.kind, sample, router]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function choose(next: File | undefined) {
    if (!next) return;
    const problem = videoProblem(next);
    setFileProblem(problem);
    if (problem) return;
    setError(null);
    setFile(next);
    setPreview(URL.createObjectURL(next));
    storagePath.current = null; // 다른 영상을 골랐으면 새로 올린다
    analysisKey.current = null;
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  }

  function simulate() {
    let progress = 0;
    setPhase({ kind: "uploading", progress });
    const step = () => {
      progress = Math.min(1, progress + 0.12);
      setPhase({ kind: "uploading", progress });
      if (progress < 1) timers.current.push(setTimeout(step, 150));
      else {
        setPhase({ kind: "analyzing" });
        timers.current.push(setTimeout(() => router.push(SAMPLE_DONE_HREF), 3500));
      }
    };
    timers.current.push(setTimeout(step, 300));
  }

  async function start() {
    if (!file || !date) return;
    setError(null);
    setFileProblem(null);
    if (sample) return simulate();

    const api = createBrowserApiClient();
    try {
      if (!caseId.current) {
        setPhase({ kind: "uploading", progress: 0 });
        const created = (await api.createCase({
          accident_date: date,
          input_path: "video",
        })) as { case_id: string };
        caseId.current = created.case_id;
        setHasCase(true);
        window.history.replaceState(null, "", `/cases/${encodeURIComponent(created.case_id)}`);
      }
      if (!storagePath.current) {
        setPhase({ kind: "uploading", progress: 0 });
        const contentType = videoContentType(file)!;
        const ticket = await api.requestUpload(caseId.current, "video", contentType);
        await uploadFile(ticket.upload_url, file, contentType, (ratio) => setPhase({ kind: "uploading", progress: ratio }));
        storagePath.current = ticket.storage_path;
      }
      // 같은 접수를 다시 보낼 때(응답을 못 받았을 때)는 같은 키를 쓴다. 실패한 작업 뒤에는 새 키다.
      analysisKey.current ??= newIdempotencyKey();
      setPhase({ kind: "analyzing" });
      const task = (await api.startAnalysis(caseId.current, storagePath.current, analysisKey.current)) as {
        status: TaskStatus;
        error?: ApiError | null;
      };
      if (task.status === "failed") {
        analysisKey.current = null;
        setError(task.error ? friendly(task.error) : FAILED_MESSAGE);
        setPhase({ kind: "form" });
      }
    } catch (caught) {
      if (caught instanceof UploadError) {
        setError(caught.message);
        setPhase({ kind: "form" });
        return;
      }
      const apiError = asApiError(caught);
      if (apiError.code === "analysis_in_progress") return setPhase({ kind: "analyzing" });
      if (apiError.code === "video_not_uploaded") storagePath.current = null;
      setError(friendly(apiError));
      setPhase({ kind: "form" });
    }
  }

  if (existing && settled) {
    const next = NEXT_LABEL[existing.stage];
    return (
      <div className="flex w-full max-w-3xl flex-col gap-6">
        {existing.inputPath === "video" && <UploadedVideo src={existing.videoUrl ?? null} />}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-heading font-semibold">
            {existing.inputPath === "video" ? (
              <>
                <svg aria-hidden viewBox="0 0 16 16" className="size-4 text-primary-strong" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3.5 8.5 3 3 6-7" />
                </svg>
                영상 분석 완료
              </>
            ) : (
              "사실 카드를 직접 입력한 사건"
            )}
          </p>
          {next && (
            <ButtonLink href={stageHref({ case_id: existing.caseId, stage: existing.stage, versions: existing.versions })} className="h-10 px-6">
              {next} →
            </ButtonLink>
          )}
        </div>
        <CaseInfo existing={existing} analysis={analysis} />
      </div>
    );
  }

  return (
    // 새 사건(/cases/new)은 가운데, 배정된 사건은 머리(CaseHeader)에 맞춰 왼쪽에 붙인다.
    <div className={`flex w-full flex-col gap-6 ${existing ? "max-w-3xl" : "mx-auto max-w-2xl"}`}>
      {!existing && <h1 className="text-title font-bold tracking-tight break-keep">{title}</h1>}

      {phase.kind === "form" && !hasCase && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="accident-date" className="text-caption font-semibold text-ink">
            사고 날짜
          </label>
          <Input id="accident-date" type="date" required max={todayInKorea()} value={date} onChange={(e) => setDate(e.target.value)} className="h-10 max-w-56" />
        </div>
      )}

      <input
        ref={fileInput}
        id="video-file"
        type="file"
        accept="video/*,.mkv,.avi"
        className="peer sr-only"
        onChange={(e) => {
          choose(e.target.files?.[0] ?? undefined);
          e.target.value = ""; // 같은 파일을 다시 골라도 onChange가 오게
        }}
      />

      {preview && file ? (
        // 미리보기는 파일 선택(label) 밖에 둔다 — 안에 두면 재생 버튼을 눌러도 파일 고르기 창이 뜬다.
        <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
          <VideoPreview key={preview} src={preview} />
          {phase.kind === "form" && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-caption">
              <span className="min-w-0 truncate text-ink">
                {file.name} <span className="text-ink-muted">· {sizeText(file.size)}</span>
              </span>
              {!error && (
                <Button variant="quiet" size="sm" onClick={() => fileInput.current?.click()}>
                  다른 영상 고르기
                </Button>
              )}
            </div>
          )}
        </div>
      ) : phase.kind !== "form" ? (
        // 다시 들어온 분석 중 사건 — 이 브라우저에 고른 파일이 없으니 서버에 올린 영상을 보인다.
        <UploadedVideo src={existing?.videoUrl ?? null} />
      ) : (
        <label
          htmlFor="video-file"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-card border-2 border-dashed px-6 py-10 text-center transition-colors peer-focus-visible:border-primary-strong ${
            dragging ? "border-primary-strong bg-primary-soft" : "border-line-strong bg-surface hover:bg-surface-muted"
          }`}
        >
          <span aria-hidden className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
            <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13V4m-3.5 3.5L10 4l3.5 3.5M4 13.5v1A1.5 1.5 0 0 0 5.5 16h9a1.5 1.5 0 0 0 1.5-1.5v-1" />
            </svg>
          </span>
          <span className="text-heading font-semibold text-ink">{error ? "영상을 다시 올려 주세요" : "블랙박스 영상을 끌어다 놓으세요"}</span>
          <span className="text-caption text-ink-muted">또는 눌러서 고르기 · 50MB까지</span>
        </label>
      )}

      {fileProblem && (
        <p role="alert" className="-mt-3 text-caption text-on-danger-soft">
          {fileProblem}
        </p>
      )}

      {phase.kind === "uploading" ? (
        <div className="flex flex-col gap-2" role="status">
          <p className="flex items-center gap-3 text-heading font-semibold">
            <Spinner />
            영상을 올리고 있어요
            <span className="text-body font-normal text-ink-muted tabular-nums">{Math.round(phase.progress * 100)}%</span>
          </p>
          <div className="h-1 overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full bg-primary-strong transition-[width]" style={{ width: `${phase.progress * 100}%` }} />
          </div>
          <p className="text-caption text-ink-muted">다 올라갈 때까지 이 창을 닫지 마세요.</p>
        </div>
      ) : phase.kind === "analyzing" ? (
        <div className="flex flex-col gap-1" role="status">
          <p className="flex items-center gap-3 text-heading font-semibold">
            <Spinner />
            영상 분석 중이에요
          </p>
          <p className="text-caption text-ink-muted">몇 분 걸릴 수 있어요. 창을 닫아도 분석은 계속되고, 끝나면 사실 카드 화면으로 넘어가요.</p>
        </div>
      ) : error ? (
        <Failure message={error} canRetry={file !== null} onRetry={start} onPickAnother={() => fileInput.current?.click()} />
      ) : (
        // 왼쪽은 이 다음에 일어나는 일 한 줄, 오른쪽은 시작 버튼.
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ol aria-label="다음 순서" className="flex items-center gap-2 text-caption text-ink-muted">
            {["영상 업로드", "AI 분석 · 몇 분", "사실 카드 확인"].map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden className="h-px w-4 bg-line-strong" />}
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span aria-hidden className="flex size-4 items-center justify-center rounded-full bg-surface-muted text-[10px] font-semibold text-ink-muted tabular-nums">
                    {i + 1}
                  </span>
                  {step}
                </span>
              </li>
            ))}
          </ol>
          <Button onClick={start} disabled={!file || !date} className="h-10 px-6">
            분석 시작
          </Button>
        </div>
      )}

      {existing && <CaseInfo existing={existing} analysis={analysis} />}
    </div>
  );
}
