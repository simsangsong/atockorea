'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUploader from '@/components/admin/ImageUploader';

export default function UploadPage() {
  const router = useRouter();
  const [productImageUrl, setProductImageUrl] = useState<string>('');
  const [galleryImageUrls, setGalleryImageUrls] = useState<string[]>([]);

  const handleProductUpload = (urls: string[]) => {
    if (urls.length > 0) {
      setProductImageUrl(urls[0]);
    }
  };

  const handleGalleryUpload = (urls: string[]) => {
    setGalleryImageUrls((prev) => [...prev, ...urls]);
  };

  const copyAllUrls = () => {
    const allUrls = [productImageUrl, ...galleryImageUrls].filter(Boolean);
    if (allUrls.length === 0) {
      alert('업로드된 이미지가 없습니다.');
      return;
    }
    
    const urlsText = allUrls.map((url, index) => 
      index === 0 ? `"${url}"` : `      "${url}"`
    ).join(',\n');
    
    const jsonArray = `[\n${urlsText}\n    ]`;
    navigator.clipboard.writeText(jsonArray);
    alert('모든 이미지 URL이 JSON 배열 형식으로 클립보드에 복사되었습니다!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">이미지 업로드</h1>
        <p className="text-gray-600 mt-2">투어에 사용할 이미지를 업로드하세요</p>
      </div>

      {/* Product Image Upload */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          메인 이미지 (Product Image)
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          투어의 대표 이미지입니다. 단일 파일만 업로드 가능합니다.
        </p>
        <ImageUploader
          onUploadComplete={handleProductUpload}
          multiple={false}
          type="product"
          folder="tours"
        />
        {productImageUrl && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800 mb-2">✅ 메인 이미지 업로드 완료</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white p-2 rounded border truncate">
                {productImageUrl}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(productImageUrl);
                  alert('URL 복사됨!');
                }}
                className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700"
              >
                복사
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Gallery Images Upload */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          갤러리 이미지 (Gallery Images)
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          투어 상세 페이지에 표시될 추가 이미지들입니다. 여러 파일을 한 번에 업로드할 수 있습니다.
        </p>
        <ImageUploader
          onUploadComplete={handleGalleryUpload}
          multiple={true}
          type="gallery"
          folder="tours/gallery"
          maxFiles={20}
        />
        {galleryImageUrls.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-blue-800">
                ✅ 갤러리 이미지 업로드 완료 ({galleryImageUrls.length}개)
              </p>
              <button
                onClick={copyAllUrls}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              >
                모든 URL 복사 (JSON)
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
              {galleryImageUrls.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Gallery ${index + 1}`}
                    className="w-full h-24 object-cover rounded border border-gray-200"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(url);
                      alert('URL 복사됨!');
                    }}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center"
                  >
                    <span className="text-white text-xs">복사</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Usage Guide */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-indigo-900 mb-3">
          📖 사용 방법
        </h3>
        <div className="space-y-2 text-sm text-indigo-800">
          <p>
            <strong>1. 이미지 업로드:</strong> 위의 영역에 이미지를 드래그하거나 클릭하여 업로드하세요.
          </p>
          <p>
            <strong>2. URL 복사:</strong> 업로드 완료 후 표시된 URL을 복사하세요.
          </p>
          <p>
            <strong>3. SQL에 사용:</strong> 복사한 URL을 SQL INSERT 문의 <code>image_url</code> 또는 <code>gallery_images</code> 필드에 사용하세요.
          </p>
          <p>
            <strong>예시:</strong>
          </p>
          <pre className="bg-white p-3 rounded border border-indigo-200 text-xs overflow-x-auto">
{`image_url = '${productImageUrl || '업로드된-이미지-URL'}',
gallery_images = '[
  "${galleryImageUrls[0] || '갤러리-이미지-URL-1'}",
  "${galleryImageUrls[1] || '갤러리-이미지-URL-2'}"
]'::jsonb`}
          </pre>
        </div>
      </div>
    </div>
  );
}


