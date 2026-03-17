// ============================================
// Upload Email Logo to Supabase Storage
// ============================================
// 이메일 템플릿용 AtoC Korea 로고를 Supabase Storage(public)에 업로드하고
// public URL과 적용된 HTML 템플릿을 출력합니다.
//
// 사용 방법:
//   1. Supabase Dashboard → Storage → "email-assets" 버킷 생성 (Public)
//   2. 로고 이미지를 scripts/email-assets/atoc-logo-email.png 에 넣거나
//      경로를 인자로 전달: node scripts/upload-email-logo.js "경로/파일.png"
//   3. node scripts/upload-email-logo.js
//
// 출력: public URL + scripts/email-template-confirm-signup.html 생성

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const m = trimmed.match(/^([^=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ .env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY를 설정하세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET = 'email-assets';
const STORAGE_PATH = 'atoc-logo-email.png';

const defaultLogoPath = path.join(__dirname, 'email-assets', 'atoc-logo-email.png');
const logoPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultLogoPath;

if (!fs.existsSync(logoPath)) {
  console.error('❌ 이미지 파일을 찾을 수 없습니다:', logoPath);
  console.error('   scripts/email-assets/atoc-logo-email.png 에 넣거나 경로를 인자로 주세요.');
  process.exit(1);
}

async function uploadLogo() {
  const ext = path.extname(logoPath).toLowerCase();
  const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
  const contentType = mimeTypes[ext] || 'image/png';

  const buffer = fs.readFileSync(logoPath);
  const { error } = await supabase.storage.from(BUCKET).upload(STORAGE_PATH, buffer, { contentType, upsert: true });

  if (error) {
    console.error('❌ 업로드 실패:', error.message);
    console.error('   Storage에 "email-assets" 버킷(Public)을 만든 뒤 다시 시도하세요.');
    process.exit(1);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(STORAGE_PATH);
  return data.publicUrl;
}

const EMAIL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your verification code – AtoC Korea</title>
    <style>
        body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
        .wrap { max-width: 560px; margin: 0 auto; padding: 48px 24px; }
        .card { background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0; }
        .brand-bar { height: 4px; background: linear-gradient(90deg, #1e3a8a 0%, #2563eb 100%); }
        .inner { padding: 40px 36px 36px; }
        .logo-wrapper { text-align: center; margin-bottom: 40px; }
        .logo-wrapper img { display: block; margin: 0 auto; border: 0; outline: none; width: 220px; height: auto; }
        .heading { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; line-height: 1.35; text-align: center; }
        .subheading { font-size: 17px; font-weight: 500; color: #475569; margin: 0 0 28px 0; line-height: 1.5; text-align: center; }
        .content { font-size: 17px; line-height: 1.65; color: #334155; margin: 0 0 24px 0; }
        .content p { margin: 0 0 16px 0; }
        .content p:last-child { margin-bottom: 0; }
        .token-label { font-size: 15px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; text-align: center; }
        .token-box { background-color: #1e3a8a; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: 0.2em; text-align: center; padding: 28px 24px; margin: 24px 0 32px 0; border-radius: 12px; font-variant-numeric: tabular-nums; }
        .notice { font-size: 15px; color: #64748b; line-height: 1.6; margin: 0; padding: 20px 20px 0; border-top: 1px solid #e2e8f0; }
        .footer { padding: 28px 36px 32px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0; }
        .footer-company { font-size: 14px; font-weight: 600; color: #334155; margin: 0 0 4px 0; }
        .footer-tagline { font-size: 13px; color: #64748b; margin: 0 0 12px 0; line-height: 1.5; }
        .footer-link { font-size: 14px; font-weight: 600; color: #2563eb; text-decoration: none; }
        .footer-copy { font-size: 12px; color: #94a3b8; margin: 16px 0 0 0; line-height: 1.5; }
        .strong-brand { color: #1e3a8a; font-weight: 700; }
    </style>
</head>
<body>
    <div class="wrap">
        <div class="card">
            <div class="brand-bar"></div>
            <div class="inner">
                <div class="logo-wrapper">
                    <img src="__LOGO_URL__" alt="AtoC Korea Logo" width="220">
                </div>
                <h1 class="heading">Verification code</h1>
                <p class="subheading">Use this code to complete your sign-up</p>
                <div class="content">
                    <p>Hello,</p>
                    <p>You requested a verification code for <strong class="strong-brand">AtoC Korea</strong>. Enter the code below on the sign-up page to continue.</p>
                    <p class="token-label">Your 6-digit code</p>
                    <div class="token-box">{{ .Token }}</div>
                    <p>This code expires in 3 minutes. If you didn't request it, you can ignore this email—your account is secure.</p>
                </div>
                <p class="notice">We never ask for this code by phone or email. Do not share it with anyone.</p>
            </div>
            <div class="footer">
                <p class="footer-company">AtoC Korea (ATOCTRAVEL)</p>
                <p class="footer-tagline">Agency To Customer · Wyoming LLC</p>
                <a href="https://atockorea.com" class="footer-link">atockorea.com</a>
                <p class="footer-copy">&copy; 2026 AtoC Korea. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>
`;

async function main() {
  console.log('📤 Uploading email logo to Supabase Storage...');
  const publicUrl = await uploadLogo();
  console.log('✅ Logo URL:', publicUrl);

  const htmlPath = path.join(__dirname, 'email-template-confirm-signup.html');
  const html = EMAIL_HTML.replace('__LOGO_URL__', publicUrl);
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('✅ Written:', htmlPath);
  console.log('\nSupabase Dashboard → Authentication → Email Templates 에서 위 파일 내용을 붙여넣으세요.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
