# 사이트 전면 비공개 (`/home-private` rewrite)

## 기본 동작

**기본값은 공개**입니다. `atockorea.com` 등 프로덕션에서 별도 env 없이 홈·투어·마이페이지가 정상 노출됩니다.

## 전면 비공개를 켤 때

스테이징에서 UI를 막거나 “업그레이드 중” 안내만 보이게 하려면 Vercel 등에 다음 중 하나를 설정합니다.

| 변수 | 값 |
|------|-----|
| `SITE_GATED` | `true` 또는 `1` |
| `SITE_HOME_PRIVATE` | `true` 또는 `1` |

설정 시 `/`, `/tours`, `/tour/...`, `/mypage` 등 **UI 경로 전부**가 내부적으로 `/home-private`로 rewrite됩니다 (주소창 URL은 유지, `noindex`).

- **`/api/*`**, **`/_next/*`**, **확장자 있는 정적 파일**은 rewrite 없이 통과합니다.

## 레거시

`SITE_HOME_PUBLIC=true`가 있으면 **항상 공개**이며, 위 게이트는 적용되지 않습니다.
