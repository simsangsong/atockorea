// AtoC 통합 플랜 §6.3 — PDF 한글 폰트 등록.
//
// 문서 본문이 한국어다(라벨·법인명·주소·'미입력' 자리표시). @react-pdf의 기본
// Helvetica에는 한글 글리프가 없어서 등록을 빼먹으면 **빈칸이 찍힌 PDF**가
// 나온다 — 세무사에게 보내는 문서에서 이보다 나쁜 실패는 없으므로, 폰트 파일이
// 없으면 조용히 넘어가지 않고 즉시 실패한다.
//
// 파일: assets/fonts/NotoSansKR-{Regular,Bold}.ttf (SIL OFL 1.1, 재배포 허용).
// Vercel 번들에 포함시키려면 next.config.js의 outputFileTracingIncludes가
// 이 경로를 잡아야 한다(정적 public/ 자산은 서버 함수 파일시스템에 없다).

import { existsSync } from 'node:fs'
import path from 'node:path'
import { Font } from '@react-pdf/renderer'

export const PDF_FONT_FAMILY = 'NotoSansKR'

const FONT_DIR = path.join(process.cwd(), 'assets', 'fonts')
const FONT_FILES = [
  { file: 'NotoSansKR-Regular.ttf', fontWeight: 400 as const },
  { file: 'NotoSansKR-Bold.ttf', fontWeight: 700 as const },
]

let registered = false

/** Idempotent — Font.register is global and re-registering re-parses the TTF. */
export function registerPdfFonts(): void {
  if (registered) return
  const fonts = FONT_FILES.map(({ file, fontWeight }) => {
    const src = path.join(FONT_DIR, file)
    if (!existsSync(src)) {
      throw new Error(
        `PDF font missing: ${src}. Korean text would render blank, so generation is refused.`,
      )
    }
    return { src, fontWeight }
  })
  Font.register({ family: PDF_FONT_FAMILY, fonts })
  // Korean has no spaces inside a clause; without this the layout engine keeps
  // a whole sentence on one unbreakable line and it overflows the page box.
  Font.registerHyphenationCallback((word) => [word])
  registered = true
}
