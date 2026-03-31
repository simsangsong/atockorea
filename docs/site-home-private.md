# 사이트 외부 비공개 (로컬만 실제 UI)

## 동작

`SITE_HOME_PUBLIC`이 **`true` / `1`이 아닌 경우**:

| Host | `/`, `/tours`, `/tour/...` 등 UI 경로 |
|------|----------------------------------------|
| **localhost**, **127.0.0.1**, **::1** (`:3000` 등) | **정상 앱** |
| **그 외** (atockorea.com, Vercel Preview, LAN IP 등) | **`/home-private`로 rewrite** (주소창은 요청 경로 유지, `noindex`) |

- **`/api/*`**, **`/_next/*`**, **확장자 있는 정적 파일**은 rewrite 없이 통과.
- `next dev -H 0.0.0.0` 후 **휴대폰에서 PC IP로 접속**하면 비공개 화면 → **`http://localhost:3000`** 또는 **`http://127.0.0.1:3000`** 사용.

## 공개 오픈 시

배포 환경(Vercel Production/Preview)에 **`SITE_HOME_PUBLIC=true`** (또는 `1`) 설정 후 재배포.

다시 비공개로 두려면 변수 제거 또는 `false` 후 재배포.
