-- 공개 버킷 3종이 **파일 목록 전체**를 익명에게 열어 두고 있었다.
-- 라이브에는 이미 적용됐다(2026-07-26, MCP). 이 파일은 그 상태를 레포에 고정한다.
--
-- 실증 (적용 전, 공개 anon 키만으로):
--   POST /storage/v1/object/list/tour-gallery → 파일명·크기·타임스탬프·id 전부 반환
--
-- 원인: storage.objects 에 `for select using (bucket_id = '...')` 정책이 PUBLIC
-- 롤로 걸려 있었다. 이름이 "Public read access" 라 공개 이미지 서빙에 필요한
-- 것처럼 보이지만 아니다:
--   · 오브젝트 서빙(/object/public/<bucket>/<path>)은 버킷의 public=true 로
--     동작하고 RLS 를 타지 않는다.
--   · 이 SELECT 정책이 여는 것은 목록 API(/object/list/...) 하나뿐이다.
-- 즉 이미지 표시에 기여하는 바가 없고, 대신 어떤 파일이 있는지 통째로 알려 준다.
-- 파일명에 투어 id·업로드 시각이 들어가 있다.
--
-- 안전 근거:
--   ① 코드베이스 전체에 스토리지 `.list()` 호출이 0건이다.
--   ② 서버는 service role 로 붙어 RLS 를 우회한다 — 영향 없음.
--   ③ tour-gallery/tour-images 는 authenticated 용 SELECT 정책이 따로 남아 있다.
--   ④ 적용 전/후 실측: 공개 오브젝트 URL 200 유지, 익명 목록조회 3버킷 모두 0건.
--
-- 되돌리려면 같은 이름·같은 표현식으로 다시 만들면 된다:
--   "Public Access"                → using (bucket_id = 'product-images')
--   "Public read access 1u735ct_0" → using (bucket_id = 'tour-gallery')
--   "Public read access ur7pfx_0"  → using (bucket_id = 'tour-images')

drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Public read access 1u735ct_0" on storage.objects;
drop policy if exists "Public read access ur7pfx_0" on storage.objects;
