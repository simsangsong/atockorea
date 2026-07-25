/**
 * ops_* 테이블의 테넌트 식별자.
 *
 * 별도 파일인 이유: 이 상수는 `lib/ops/guides/registry.ts`에 있었는데, 그 파일은
 * `pii.ts`(server-only, node:crypto)를 끌고 온다. 그래서 **테넌트 문자열 하나가
 * 필요할 뿐인 순수 모듈이 서버 전용이 되어 버렸다** — 스크립트·테스트에서
 * import하면 `Cannot find module 'server-only'`로 죽는다.
 *
 * 상수 하나 때문에 의존성 그래프가 오염되지 않도록 여기로 분리한다.
 */
export const OPS_TENANT_ID = 'atockorea';
