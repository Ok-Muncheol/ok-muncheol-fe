"use client";

import { Button } from "@/ui/controls";

/** 청구서 인쇄 — 브라우저 인쇄 창(PDF로 저장 포함). 인쇄할 때는 앱 메뉴 · 이 버튼이 빠진다(print:hidden). */
export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      인쇄 · PDF로 저장
    </Button>
  );
}
