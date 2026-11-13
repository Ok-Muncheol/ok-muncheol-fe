/**
 * 왼쪽 메뉴 접힘 — 담당자 화면 습관이라 이 브라우저에만 남긴다(localStorage).
 * 상태는 <html data-sidebar="closed">이고 화면은 CSS(in-data-[sidebar=closed])로 바뀐다(src/ui/app-shell.tsx).
 * 서버 컴포넌트(layout.tsx)도 SIDEBAR_SCRIPT를 읽어야 해서 "use client" 파일과 떼어 둔다.
 */
export const SIDEBAR_KEY = "okm:sidebar";

/** layout.tsx <head>에 넣는 한 줄 — 첫 그림 전에 저장한 접힘을 <html>에 옮겨 펼침→접힘이 번쩍이지 않게 한다. 저장소가 막혀 있으면 펼친 채다. */
export const SIDEBAR_SCRIPT = `try{if(localStorage.getItem("${SIDEBAR_KEY}")==="closed")document.documentElement.dataset.sidebar="closed"}catch(e){}`;

/** 접기·펼치기 — 화면(<html> 속성)과 저장소를 한 번에 바꾼다. 저장이 막혀도 이번 방문 동안은 그대로 된다. */
export function setSidebarClosed(closed: boolean) {
  const root = document.documentElement;
  if (closed) root.dataset.sidebar = "closed";
  else delete root.dataset.sidebar;
  try {
    if (closed) localStorage.setItem(SIDEBAR_KEY, "closed");
    else localStorage.removeItem(SIDEBAR_KEY);
  } catch {
    // 저장이 막혀도 접기·펼치기는 된다.
  }
}
