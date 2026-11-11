/**
 * B 통합: 첫 화면 — 담당 사건(/cases)으로 바로 보낸다. 머리글의 로고가 여기로 온다.
 * TODO: 로그인이 붙으면 로그인 전에는 /login으로 보낸다.
 */
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/cases");
}
