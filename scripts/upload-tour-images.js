// ============================================
// Upload Tour Images
// ============================================
// This script uploads images for the private tour
// Run this in browser console after logging in as admin

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
  
  console.log('📤 이미지 업로드 스크립트');
  console.log('');
  console.log('⚠️  이 스크립트는 브라우저에서 직접 파일을 선택하여 업로드합니다.');
  console.log('');
  console.log('📝 사용 방법:');
  console.log('   1. 이미지 파일들을 준비하세요');
  console.log('   2. 아래 uploadImage() 함수를 사용하여 각 이미지를 업로드하세요');
  console.log('   3. 업로드된 이미지 경로를 복사하여 썸네일/갤러리 스크립트에 입력하세요');
  console.log('');
  console.log('💡 예시:');
  console.log('   await uploadImage(file, "tours", "product");');
  console.log('   // file은 <input type="file">에서 선택한 File 객체');
  console.log('');
  
  // 이미지 업로드 함수
  window.uploadImage = async (file, folder = 'tours', type = 'product') => {
    if (!file) {
      console.error('❌ 파일을 선택해주세요.');
      return;
    }
    
    console.log(`📤 이미지 업로드 중: ${file.name}...`);
    
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
      
      console.log('✅ 업로드 성공!');
      console.log('📸 이미지 경로:', result.url || result.data?.url);
      console.log('');
      
      return result.url || result.data?.url;
    } catch (error) {
      console.error('❌ 에러 발생:', error);
      return null;
    }
  };
  
  // 여러 이미지 업로드 함수
  window.uploadImages = async (files, folder = 'tours', type = 'gallery') => {
    if (!files || files.length === 0) {
      console.error('❌ 파일을 선택해주세요.');
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
      
      const urls = result.urls || result.data?.urls || [];
      console.log(`✅ ${urls.length}개 이미지 업로드 성공!`);
      urls.forEach((url, index) => {
        console.log(`   ${index + 1}. ${url}`);
      });
      console.log('');
      
      return urls;
    } catch (error) {
      console.error('❌ 에러 발생:', error);
      return [];
    }
  };
  
  // 파일 선택 헬퍼 함수
  window.selectAndUploadImage = async (folder = 'tours', type = 'product') => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          const url = await window.uploadImage(file, folder, type);
          resolve(url);
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  };
  
  console.log('✅ 업로드 함수 준비 완료!');
  console.log('');
  console.log('🔧 사용 가능한 함수:');
  console.log('   - uploadImage(file, folder, type): 단일 이미지 업로드');
  console.log('   - uploadImages(files, folder, type): 여러 이미지 업로드');
  console.log('   - selectAndUploadImage(folder, type): 파일 선택 후 업로드');
  console.log('');
  console.log('📝 예시 사용법:');
  console.log('   // 파일 선택 후 업로드');
  console.log('   const url = await selectAndUploadImage("tours", "product");');
  console.log('   console.log("업로드된 경로:", url);');
  console.log('');
  
  return {
    uploadImage: window.uploadImage,
    uploadImages: window.uploadImages,
    selectAndUploadImage: window.selectAndUploadImage
  };
})();










