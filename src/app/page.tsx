/**
 * B 통합: 첫 화면 — 계정 역할의 첫 화면으로 바로 보낸다(src/lib/auth/next-path.ts homePath). 관리자는 사건 관제(/admin),
 * 그 밖(대물·대인 담당자, 로그인 전)은 담당 사건(/cases). 머리글의 로고와 로그인 뒤 기본 이동이 여기로 온다.
 * TODO: 로그인이 붙으면 로그인 전에는 /login으로 보낸다.
 */
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/features/profile/profile-source";
import { homePath } from "@/lib/auth/next-path";

export default async function Home() {
  const profile = await getCurrentProfile();
  redirect(homePath(profile?.staffRole));
}
