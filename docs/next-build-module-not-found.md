# `module.compiled` / Next 14.2.33 빌드 오류

## 증상

- `Can't resolve 'next/dist/server/future/route-modules/pages/module.compiled'`
- 오버레이에 **Next.js 14.2.33** 이라고 나옴

## 원인 (둘 중 하나가 많음)

1. **전역 `next` CLI가 14** — 터미널에서 `next dev`만 치면 **프로젝트의 Next 16이 아니라** 전역 Next 14가 돌아감.
2. **옛날 `.next` 캐시** — 예전 버전으로 빌드된 캐시가 남아 있음.

## 해결 순서 (프로젝트 루트 `atockorea`에서)

1. **반드시 npm 스크립트로 실행** (전역 `next` 쓰지 않기):

   ```bash
   npm run dev
   ```

   또는 캐시까지 지우고:

   ```bash
   npm run dev:clean
   ```

2. **의존성 맞추기** (다른 PC에서 클론했거나 오래됐으면):

   ```bash
   npm install
   ```

3. **전역 Next 확인** (Windows PowerShell):

   ```powershell
   where.exe next
   npm list -g next
   ```

   전역에 Next 14만 있고 `next dev`로 띄우면 위 오류가 날 수 있음 → **`npm run dev`만 사용**.

4. **버전 확인** (로컬 설치):

   ```bash
   npx next --version
   ```

   **16.x** 가 나와야 함.

이 프로젝트는 **Next 16** + **`--webpack`** 이 `package.json`에 맞춰져 있습니다.
