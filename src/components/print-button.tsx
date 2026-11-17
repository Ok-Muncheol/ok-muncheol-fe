"use client";

import { Button } from "@/ui/controls";

/**
 * 인쇄 · PDF로 저장 — 브라우저 인쇄 창(PDF로 저장 포함)을 연다. 구상 청구서 · 검토 보고서가 쓴다.
 * 인쇄할 때는 앱 메뉴와 이 버튼 같은 화면 조작이 빠진다(print:hidden). 저장되는 PDF 이름은 화면 제목(metadata title)을 따른다.
 */
export function PrintButton({ size }: { size?: "sm" | "md" }) {
  return (
    <Button variant="secondary" size={size} className="print:hidden" onClick={() => window.print()}>
      인쇄 · PDF로 저장
    </Button>
  );
}
