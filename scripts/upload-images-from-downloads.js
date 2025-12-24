// ============================================
// Upload Images from Downloads Folder
// ============================================
// 다운로드 폴더의 이미지를 읽어서 Supabase에 업로드하고
// 업로드된 경로를 add-jeju-private-car-tour.js 파일에 자동 반영
//
// 사용 방법:
// node scripts/upload-images-from-downloads.js

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
// 환경 변수 로드 (.env.local 파일 직접 읽기)
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const match = trimmedLine.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        process.env[key] = value;
      }
    }
  });
}

// Supabase 클라이언트 생성
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.');
  console.error('   .env.local 파일에 NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 설정하세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 다운로드 폴더 경로 (Windows)
const downloadsPath = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads');

// 이미지 파일 확장자
const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// 이미지 파일 찾기
function findImageFiles(dir) {
  const files = [];
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (imageExtensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`❌ 폴더 읽기 실패: ${dir}`, error.message);
  }
  return files;
}

// 파일을 Supabase Storage에 업로드
async function uploadToSupabase(filePath, bucketName, folder = 'tours') {
  try {
    const fileName = path.basename(filePath);
    const fileExt = path.extname(fileName);
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const newFileName = `${timestamp}-${randomString}${fileExt}`;
    const storagePath = `${folder}/${newFileName}`;

    // 파일 읽기
    const fileBuffer = fs.readFileSync(filePath);

    // MIME 타입 결정
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif'
    };
    const contentType = mimeTypes[fileExt.toLowerCase()] || 'image/jpeg';

    console.log(`📤 업로드 중: ${fileName} → ${storagePath}`);

    // Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, fileBuffer, {
        contentType: contentType,
        upsert: false
      });

    if (error) {
      console.error(`❌ 업로드 실패: ${fileName}`, error.message);
      return null;
    }

    // Public URL 가져오기
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;
    console.log(`✅ 업로드 성공: ${publicUrl}`);

    return publicUrl;
  } catch (error) {
    console.error(`❌ 에러 발생: ${filePath}`, error.message);
    return null;
  }
}

// 메인 함수
async function main() {
  console.log('🚀 이미지 업로드 시작...');
  console.log(`📁 다운로드 폴더: ${downloadsPath}`);
  console.log('');

  // 다운로드 폴더에서 이미지 파일 찾기
  const imageFiles = findImageFiles(downloadsPath);

  if (imageFiles.length === 0) {
    console.error('❌ 다운로드 폴더에서 이미지 파일을 찾을 수 없습니다.');
    return;
  }

  console.log(`📸 찾은 이미지 파일: ${imageFiles.length}개`);
  imageFiles.forEach((file, index) => {
    console.log(`   ${index + 1}. ${path.basename(file)}`);
  });
  console.log('');

  // 이미지 파일들을 이름순으로 정렬 (일관된 순서 보장)
  imageFiles.sort();

  // 이미지 매핑 (파일명 기반으로 추정)
  // 실제 파일명에 따라 조정 필요
  const imageMapping = {
    thumbnail: null,  // 5번째 이미지 (검은색 미니밴)
    gallery: []       // 나머지 6장
  };

  // 파일명에서 이미지 타입 추정
  for (let i = 0; i < imageFiles.length; i++) {
    const fileName = path.basename(imageFiles[i]).toLowerCase();
    
    // 썸네일 이미지 찾기 (5번째 또는 파일명에 'minivan', 'road', 'car' 등이 포함된 경우)
    if (i === 4 || fileName.includes('minivan') || fileName.includes('road') || fileName.includes('car') || fileName.includes('vehicle')) {
      if (!imageMapping.thumbnail) {
        imageMapping.thumbnail = imageFiles[i];
      } else {
        imageMapping.gallery.push(imageFiles[i]);
      }
    } else {
      imageMapping.gallery.push(imageFiles[i]);
    }
  }

  // 썸네일이 없으면 5번째 이미지를 썸네일로 사용
  if (!imageMapping.thumbnail && imageFiles.length >= 5) {
    imageMapping.thumbnail = imageFiles[4];
    imageMapping.gallery = imageFiles.filter((_, i) => i !== 4);
  } else if (!imageMapping.thumbnail) {
    // 5번째가 없으면 첫 번째를 썸네일로
    imageMapping.thumbnail = imageFiles[0];
    imageMapping.gallery = imageFiles.slice(1);
  }

  console.log('📋 이미지 분류:');
  console.log(`   썸네일: ${path.basename(imageMapping.thumbnail)}`);
  console.log(`   갤러리: ${imageMapping.gallery.length}장`);
  console.log('');

  // 썸네일 업로드
  console.log('📸 썸네일 이미지 업로드 중...');
  const thumbnailUrl = await uploadToSupabase(imageMapping.thumbnail, 'tour-images', 'tours');
  
  if (!thumbnailUrl) {
    console.error('❌ 썸네일 업로드 실패');
    return;
  }

  console.log('');

  // 갤러리 이미지 업로드
  console.log('📸 갤러리 이미지 업로드 중...');
  const galleryUrls = [];
  for (const galleryFile of imageMapping.gallery) {
    const url = await uploadToSupabase(galleryFile, 'tour-gallery', 'tours/gallery');
    if (url) {
      galleryUrls.push(url);
    }
  }

  console.log('');
  console.log('✅ 모든 이미지 업로드 완료!');
  console.log('');

  // JS 파일 업데이트 코드 생성
  const updateCode = `  // 이미지 경로 설정 (자동 생성됨)
  const thumbnailImage = "${thumbnailUrl}";
  
  const galleryImages = [
${galleryUrls.map(url => `    "${url}"`).join(',\n')}
  ];`;

  console.log('📝 add-jeju-private-car-tour.js 파일에 업데이트할 코드:');
  console.log('─'.repeat(60));
  console.log(updateCode);
  console.log('─'.repeat(60));
  console.log('');

  // JS 파일 자동 업데이트
  const jsFilePath = path.join(__dirname, 'add-jeju-private-car-tour.js');
  try {
    let jsContent = fs.readFileSync(jsFilePath, 'utf8');
    
    // 이미지 경로 부분 찾아서 교체
    const imagePathRegex = /\/\/ ============================================\s*\/\/ 이미지 경로 설정[\s\S]*?const galleryImages = \[[\s\S]*?\];/;
    
    const newImageSection = `// ============================================
  // 이미지 경로 설정
  // ============================================
  // 5번째 사진: 검은색 미니밴이 해안 도로를 달리는 사진 (썸네일/首图)
  const thumbnailImage = "${thumbnailUrl}";
  
  // 갤러리 이미지: 나머지 6장 사진들 (5번째 제외)
  const galleryImages = [
${galleryUrls.map(url => `    "${url}"`).join(',\n')}
  ];`;
    
    if (imagePathRegex.test(jsContent)) {
      jsContent = jsContent.replace(imagePathRegex, newImageSection);
      fs.writeFileSync(jsFilePath, jsContent, 'utf8');
      console.log('✅ add-jeju-private-car-tour.js 파일이 자동으로 업데이트되었습니다!');
    } else {
      console.log('⚠️  JS 파일에서 이미지 경로 섹션을 찾을 수 없습니다. 수동으로 업데이트하세요.');
    }
  } catch (error) {
    console.error('❌ JS 파일 업데이트 실패:', error.message);
    console.log('💡 위의 코드를 수동으로 복사하여 add-jeju-private-car-tour.js 파일에 붙여넣으세요.');
  }

  console.log('');
  console.log('📋 업로드 결과:');
  console.log(`   썸네일: ${thumbnailUrl}`);
  console.log(`   갤러리: ${galleryUrls.length}장`);
  console.log('');
}

// 실행
main().catch(console.error);

