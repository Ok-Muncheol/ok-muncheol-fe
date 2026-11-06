// 폴링 스크립트 테스트 공용 — gh 대역과 출력 캡처
import { GhFailed } from "../bin/cli.mjs";

export const apiError = () => new GhFailed("gh exited with 1");
export const ghMissing = () => Object.assign(new Error("spawn gh ENOENT"), { code: "ENOENT" });
export const noSleep = async () => {};
export const json = (value) => JSON.stringify(value);

// 응답을 차례로 돌려주는 gh 대역 — 응답이 Error면 던진다. 받은 인자는 calls에 남는다.
export function fakeGh(...responses) {
  const calls = [];
  const gh = (args) => {
    calls.push(args);
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return response;
  };
  return { gh, calls };
}

// console.log·console.error를 줄 목록으로 가로챈다. t.mock이 테스트가 끝나면 원래대로 돌린다.
export function captureOutput(t) {
  const out = [];
  const err = [];
  t.mock.method(console, "log", (line) => out.push(String(line)));
  t.mock.method(console, "error", (line) => err.push(String(line)));
  return { out, err };
}
