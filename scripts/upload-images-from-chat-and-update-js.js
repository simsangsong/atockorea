// ============================================
// Upload Images from Chat and Update JS File
// ============================================
// 이 스크립트는 대화창에 업로드된 이미지를 Supabase에 업로드하고
// 업로드된 경로를 add-jeju-private-car-tour.js 파일에 자동으로 반영합니다.
// 브라우저 콘솔에서 실행하세요 (admin 로그인 필요)

(async () => {
  // localStorage에서 토큰 가져오기
  let token = null;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes('auth-token')) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        token = data?.access_token || data?.accessToken || data?.session?.access_token;
        if (token) break;
      } catch (e) {}
    }
  }
  
  if (!token) {
    console.error('❌ 인증 토큰을 찾을 수 없습니다. /admin에서 로그인하세요.');
    return;
  }
  
  // Base64 이미지를 File 객체로 변환
  const base64ToFile = (base64String, filename, mimeType = 'image/png') => {
    const base64Data = base64String.includes(',') 
      ? base64String.split(',')[1] 
      : base64String;
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    return new File([blob], filename, { type: mimeType });
  };
  
  // 이미지 URL을 File 객체로 변환
  const urlToFile = async (url, filename) => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  };
  
  // 이미지 업로드 함수
  const uploadImage = async (file, folder = 'tours', type = 'product') => {
    if (!file) return null;
    
    console.log(`📤 업로드 중: ${file.name || 'image'}...`);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    formData.append('folder', folder);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: formData
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('❌ 업로드 실패:', result.error || result.message);
        return null;
      }
      
      const url = result.url || result.data?.url;
      console.log(`✅ 업로드 성공: ${url}`);
      return url;
    } catch (error) {
      console.error('❌ 에러 발생:', error);
      return null;
    }
  };
  
  // 여러 이미지 업로드 함수
  const uploadImages = async (files, folder = 'tours/gallery', type = 'gallery') => {
    if (!files || files.length === 0) return [];
    
    console.log(`📤 ${files.length}개 이미지 업로드 중...`);
    
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    formData.append('type', type);
    formData.append('folder', folder);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: formData
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('❌ 업로드 실패:', result.error || result.message);
        return [];
      }
      
      // API 응답 형식에 따라 URL 추출
      const urls = result.files?.map(f => f.url) || result.urls || [];
      console.log(`✅ ${urls.length}개 이미지 업로드 성공!`);
      return urls;
    } catch (error) {
      console.error('❌ 에러 발생:', error);
      return [];
    }
  };
  
  // 이미지 데이터 배열에서 업로드
  // images 배열 형식: [{ data: base64 또는 url, name: 'filename.png', type: 'thumbnail' 또는 'gallery' }]
  window.uploadImagesFromData = async (images) => {
    if (!images || !Array.isArray(images) || images.length === 0) {
      console.error('❌ 이미지 데이터가 없습니다.');
      return null;
    }
    
    console.log('🚀 이미지 업로드 시작...');
    console.log(`📸 총 ${images.length}개 이미지 처리 중...`);
    console.log('');
    
    const thumbnailImages = [];
    const galleryImages = [];
    
    // 이미지를 썸네일과 갤러리로 분류
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      let file = null;
      
      try {
        // Base64 데이터인 경우
        if (img.data && (img.data.startsWith('data:image') || img.data.startsWith('/9j/') || img.data.length > 100)) {
          const mimeType = img.data.startsWith('data:image') 
            ? img.data.split(';')[0].split(':')[1] 
            : 'image/png';
          const filename = img.name || `image-${i + 1}.png`;
          file = base64ToFile(img.data, filename, mimeType);
        }
        // URL인 경우
        else if (img.data && (img.data.startsWith('http://') || img.data.startsWith('https://'))) {
          const filename = img.name || `image-${i + 1}.png`;
          file = await urlToFile(img.data, filename);
        }
        // File 객체인 경우
        else if (img instanceof File || img.data instanceof File) {
          file = img instanceof File ? img : img.data;
        }
        
        if (file) {
          if (img.type === 'thumbnail' || i === 4) { // 5번째 이미지(인덱스 4)는 썸네일
            thumbnailImages.push({ file, index: i + 1 });
          } else {
            galleryImages.push({ file, index: i + 1 });
          }
        }
      } catch (error) {
        console.error(`❌ 이미지 ${i + 1} 처리 실패:`, error);
      }
    }
    
    // 썸네일 업로드 (5번째 이미지)
    let thumbnailUrl = null;
    if (thumbnailImages.length > 0) {
      console.log('📸 썸네일 이미지 업로드 중...');
      thumbnailUrl = await uploadImage(thumbnailImages[0].file, 'tours', 'product');
    }
    
    // 갤러리 이미지 업로드
    let galleryUrls = [];
    if (galleryImages.length > 0) {
      console.log('');
      console.log('📸 갤러리 이미지 업로드 중...');
      const galleryFiles = galleryImages.map(img => img.file);
      galleryUrls = await uploadImages(galleryFiles, 'tours/gallery', 'gallery');
    }
    
    console.log('');
    console.log('✅ 모든 이미지 업로드 완료!');
    console.log('');
    console.log('📋 업로드된 이미지 경로:');
    console.log('');
    console.log('// 썸네일 (5번째 사진)');
    console.log(`const thumbnailImage = "${thumbnailUrl || ''}";`);
    console.log('');
    console.log('// 갤러리 이미지');
    console.log('const galleryImages = [');
    galleryUrls.forEach((url, index) => {
      console.log(`  "${url}",`);
    });
    console.log('];');
    console.log('');
    
    // JS 파일 업데이트를 위한 코드 생성
    const updateCode = `
// 이미지 경로 설정 (자동 생성됨)
const thumbnailImage = "${thumbnailUrl || ''}";

const galleryImages = [
${galleryUrls.map(url => `  "${url}"`).join(',\n')}
];
`;
    
    console.log('📋 JS 파일에 붙여넣을 코드:');
    console.log('─'.repeat(60));
    console.log(updateCode);
    console.log('─'.repeat(60));
    console.log('');
    console.log('💡 이 코드를 복사하여 add-jeju-private-car-tour.js 파일의 이미지 경로 부분(39-53줄)에 붙여넣으세요.');
    console.log('');
    
    // 클립보드에 복사 시도
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(updateCode);
        console.log('✅ 클립보드에 복사되었습니다!');
      } catch (e) {
        console.log('⚠️  클립보드 복사 실패 (수동으로 복사하세요)');
      }
    }
    
    return {
      thumbnail: thumbnailUrl,
      gallery: galleryUrls,
      updateCode
    };
  };
  
  console.log('✅ 스크립트 준비 완료!');
  console.log('');
  console.log('🔧 사용 방법:');
  console.log('   uploadImagesFromData(images) 함수를 사용하세요');
  console.log('');
  console.log('📝 이미지 데이터 형식:');
  console.log('   [');
  console.log('     { data: "base64_string 또는 url", name: "image1.png", type: "gallery" },');
  console.log('     { data: "base64_string 또는 url", name: "image2.png", type: "gallery" },');
  console.log('     ...');
  console.log('     { data: "base64_string 또는 url", name: "image5.png", type: "thumbnail" }, // 5번째는 썸네일');
  console.log('     ...');
  console.log('   ]');
  console.log('');
  console.log('💡 예시:');
  console.log('   const images = [');
  console.log('     { data: "data:image/png;base64,...", name: "dolhareubang.png" },');
  console.log('     { data: "data:image/png;base64,...", name: "haenyeo.png" },');
  console.log('     // ...');
  console.log('   ];');
  console.log('   await uploadImagesFromData(images);');
  console.log('');
  
  return {
    uploadImagesFromData: window.uploadImagesFromData,
    uploadImage,
    uploadImages,
    base64ToFile,
    urlToFile
  };
})();





