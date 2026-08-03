/**
 * 번들 분석 빌드 — `npm run analyze` 의 실행부.
 *
 * 🔴 왜 스크립트가 됐나. 원래는 package.json 에 이렇게 있었다:
 *
 *     "analyze": "ANALYZE=true next build"
 *
 * 두 가지가 깨져 있었고, 둘 다 조용했다 —
 *
 *  ① `VAR=value cmd` 는 **POSIX 셸 문법**이다. Windows 에서는
 *     `'ANALYZE' is not recognized as an internal or external command` 로 죽는다.
 *     이 저장소의 런북은 Windows 를 전제로 쓰여 있는데 이 스크립트만 그렇지 않았다.
 *
 *  ② **`--webpack` 이 빠져 있었다.** `build` 는 `next build --webpack` 인데 이쪽만 bare 라,
 *     설령 ①을 우회해서 돌렸어도 Turbopack 으로 들어간다. 런북이 *"Turbopack 은 이 레포에서
 *     즉사"* 라고 적어 둔 그 경로다. 즉 **고쳐도 다른 이유로 죽는** 상태였다.
 *
 * 아무도 못 본 이유는 단순하다 — 번들을 분석해야만 실행되는 스크립트이고, 이 저장소는
 * 번들 수치를 *"미계측"* 으로 계속 넘겨 왔다(§P-3 #6). **안 돌리는 명령은 안 썩는 게 아니라
 * 썩은 줄 모르는 것이다.**
 *
 * 의존성을 새로 넣지 않는다(`cross-env` 등) — 이 저장소는 xlsx 작성기도 직접 만들어 쓴다.
 */
import { spawnSync } from 'node:child_process';

const result = spawnSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ANALYZE: 'true' },
});

if (result.error) {
  console.error('analyze: 빌드를 시작하지 못했다 —', result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
