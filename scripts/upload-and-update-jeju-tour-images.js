// ============================================
// Upload Images and Update Jeju Private Tour
// ============================================
// 이 스크립트는 이미지를 Supabase에 업로드하고
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
  
  console.log('📤 제주 프라이빗 투어 이미지 업로드 및 경로 업데이트');
  console.log('');
  console.log('📋 업로드할 이미지:');
  console.log('   1. 돌하르방과 바다 (갤러리)');
  console.log('   2. 해녀 행진 (갤러리)');
  console.log('   3. 눈 덮인 풍경에서 말 타는 사진 (갤러리)');
  console.log('   4. 핑크 뮬리 풀 (갤러리)');
  console.log('   5. 검은색 미니밴이 해안 도로를 달리는 사진 (썸네일) ⭐');
  console.log('   6. 일출/일몰 다리 (갤러리)');
  console.log('   7. 성산일출봉 (갤러리)');
  console.log('');
  
  // 이미지 업로드 함수
  const uploadImage = async (file, folder = 'tours', type = 'product') => {
    if (!file) {
      console.error('❌ 파일이 없습니다.');
      return null;
    }
    
    console.log(`📤 업로드 중: ${file.name}...`);
    
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
  const uploadImages = async (files, folder = 'tours', type = 'gallery') => {
    if (!files || files.length === 0) {
      console.error('❌ 파일이 없습니다.');
      return [];
    }
    
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
  
  // 파일 선택 헬퍼
  const selectFiles = () => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = (e) => {
        resolve(Array.from(e.target.files || []));
      };
      input.click();
    });
  };
  
  console.log('📝 사용 방법:');
  console.log('   1. 아래 startUpload() 함수를 실행하세요');
  console.log('   2. 파일 선택 창에서 이미지들을 선택하세요');
  console.log('   3. 업로드된 경로가 자동으로 복사됩니다');
  console.log('');
  
  // 메인 업로드 함수
  window.startUpload = async () => {
    console.log('🚀 이미지 업로드 시작...');
    console.log('');
    
    // 썸네일 이미지 업로드 (5번째)
    console.log('📸 1/2: 썸네일 이미지 업로드 (5번째 사진)');
    console.log('   → 검은색 미니밴이 해안 도로를 달리는 사진을 선택하세요');
    const thumbnailFiles = await selectFiles();
    if (thumbnailFiles.length === 0) {
      console.error('❌ 썸네일 이미지를 선택하지 않았습니다.');
      return;
    }
    
    const thumbnailUrl = await uploadImage(thumbnailFiles[0], 'tours', 'product');
    if (!thumbnailUrl) {
      console.error('❌ 썸네일 업로드 실패');
      return;
    }
    
    console.log('');
    console.log('📸 2/2: 갤러리 이미지 업로드 (나머지 6장)');
    console.log('   → 나머지 6장의 이미지를 모두 선택하세요');
    const galleryFiles = await selectFiles();
    if (galleryFiles.length === 0) {
      console.error('❌ 갤러리 이미지를 선택하지 않았습니다.');
      return;
    }
    
    if (galleryFiles.length !== 6) {
      console.warn(`⚠️  갤러리 이미지는 6장이어야 하는데 ${galleryFiles.length}장 선택되었습니다.`);
    }
    
    const galleryUrls = await uploadImages(galleryFiles, 'tours/gallery', 'gallery');
    if (galleryUrls.length === 0) {
      console.error('❌ 갤러리 이미지 업로드 실패');
      return;
    }
    
    console.log('');
    console.log('✅ 모든 이미지 업로드 완료!');
    console.log('');
    console.log('📋 업로드된 이미지 경로:');
    console.log('');
    console.log('// 썸네일 (5번째 사진)');
    console.log(`const thumbnailImage = "${thumbnailUrl}";`);
    console.log('');
    console.log('// 갤러리 이미지 (6장)');
    console.log('const galleryImages = [');
    galleryUrls.forEach((url, index) => {
      console.log(`  "${url}",${index < galleryUrls.length - 1 ? '' : ' // ' + (index + 1) + '번'}`);
    });
    console.log('];');
    console.log('');
    console.log('📝 위 경로를 복사하여 add-jeju-private-car-tour.js 파일에 붙여넣으세요.');
    console.log('');
    
    // 클립보드에 복사할 수 있는 형식으로 출력
    const codeToCopy = `// 이미지 경로 설정
const thumbnailImage = "${thumbnailUrl}";

const galleryImages = [
${galleryUrls.map(url => `  "${url}"`).join(',\n')}
];`;
    
    console.log('📋 복사용 코드:');
    console.log('─'.repeat(50));
    console.log(codeToCopy);
    console.log('─'.repeat(50));
    console.log('');
    console.log('💡 이 코드를 복사하여 add-jeju-private-car-tour.js 파일의 이미지 경로 부분에 붙여넣으세요.');
    
    return {
      thumbnail: thumbnailUrl,
      gallery: galleryUrls
    };
  };
  
  console.log('✅ 스크립트 준비 완료!');
  console.log('');
  console.log('🔧 사용 방법:');
  console.log('   startUpload() 함수를 실행하세요');
  console.log('');
  console.log('💡 예시:');
  console.log('   await startUpload();');
  console.log('');
  
  return {
    startUpload: window.startUpload,
    uploadImage,
    uploadImages
  };
})();










