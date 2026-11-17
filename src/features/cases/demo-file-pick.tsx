"use client";

/**
 * 시연 파일에서 고르기 — 시연용으로 Storage `case-files/demo/`에 미리 올려 둔 파일(영상 · 견적서)을 업로드 칸에서 고른다.
 * 목록은 BE GET /demo-files?kind=…, 고른 파일은 부르는 쪽이 POST /cases/{id}/uploads/demo로 그 사건 폴더에 복사해 쓴다
 * (돌려받은 storage_path는 직접 올린 파일과 같다). 견본 모드이거나 시연 폴더가 비었거나 목록을 못 읽으면 아무것도 그리지 않는다.
 */
import { useEffect, useState } from "react";
import { createBrowserApiClient } from "@/lib/api/browser";
import type { DemoFile, UploadKind } from "@/lib/api/types";
import { Select } from "@/ui/controls";

export function DemoFilePick({
  kind,
  live,
  prefix = "",
  disabled = false,
  onPick,
}: {
  kind: UploadKind;
  /** 견본 모드가 아니다 — 견본 모드는 BE를 부르지 않는다 */
  live: boolean;
  /** 이 글자로 시작하는 파일만(내 차 견적서 own_, 상대 차 견적서 counterparty_) */
  prefix?: string;
  disabled?: boolean;
  onPick: (name: string) => void;
}) {
  const [files, setFiles] = useState<DemoFile[]>([]);

  useEffect(() => {
    if (!live) return;
    let stopped = false;
    createBrowserApiClient()
      .listDemoFiles(kind)
      .then((list) => !stopped && setFiles(list))
      .catch(() => undefined); // 시연 편의 기능이라 못 읽으면 조용히 감춘다 — 직접 올리기는 그대로 된다
    return () => {
      stopped = true;
    };
  }, [kind, live]);

  const shown = files.filter((f) => f.name.startsWith(prefix));
  if (shown.length === 0) return null;
  return (
    <Select
      aria-label="시연 파일에서 고르기"
      value=""
      disabled={disabled}
      className="max-w-64"
      onChange={(e) => {
        if (e.target.value) onPick(e.target.value);
      }}
    >
      <option value="">시연 파일에서 고르기</option>
      {shown.map((f) => (
        <option key={f.name} value={f.name}>
          {f.name}
        </option>
      ))}
    </Select>
  );
}
