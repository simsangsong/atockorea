'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, BookOpen } from 'lucide-react';
import ImageUploader from '@/components/admin/ImageUploader';

export default function UploadPage() {
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

  const copyUrl = (url: string) => {
    void navigator.clipboard.writeText(url);
    toast.success('URL을 복사했습니다.');
  };

  const copyAllUrls = () => {
    const allUrls = [productImageUrl, ...galleryImageUrls].filter(Boolean);
    if (allUrls.length === 0) {
      toast.error('업로드된 이미지가 없습니다.');
      return;
    }

    const urlsText = allUrls
      .map((url, index) => (index === 0 ? `"${url}"` : `      "${url}"`))
      .join(',\n');

    const jsonArray = `[\n${urlsText}\n    ]`;
    void navigator.clipboard.writeText(jsonArray);
    toast.success('모든 이미지 URL을 JSON 배열로 복사했습니다.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">이미지 업로드</h1>
        <p className="mt-1 text-sm text-slate-600">투어에 사용할 이미지를 업로드하세요</p>
      </div>

      {/* Product Image Upload */}
      <div className="rounded-design-md border border-admin-border bg-admin-surface p-6 shadow-admin-card">
        <h2 className="mb-1 text-base font-semibold text-slate-900">메인 이미지 (Product Image)</h2>
        <p className="mb-4 text-sm text-slate-600">
          투어의 대표 이미지입니다. 단일 파일만 업로드 가능합니다.
        </p>
        <ImageUploader
          onUploadComplete={handleProductUpload}
          multiple={false}
          type="product"
          folder="tours"
        />
        {productImageUrl && (
          <div className="mt-4 rounded-design-sm border border-emerald-200 bg-emerald-50 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-emerald-800">
              <Check className="size-4" strokeWidth={2} /> 메인 이미지 업로드 완료
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded border border-admin-border bg-admin-surface p-2 text-xs">
                {productImageUrl}
              </code>
              <button
                type="button"
                onClick={() => copyUrl(productImageUrl)}
                className="inline-flex min-h-9 flex-shrink-0 items-center gap-1 rounded-design-sm bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700"
              >
                <Copy className="size-3.5" /> 복사
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Gallery Images Upload */}
      <div className="rounded-design-md border border-admin-border bg-admin-surface p-6 shadow-admin-card">
        <h2 className="mb-1 text-base font-semibold text-slate-900">갤러리 이미지 (Gallery Images)</h2>
        <p className="mb-4 text-sm text-slate-600">
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
          <div className="mt-4 rounded-design-sm border border-blue-200 bg-blue-50 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-medium text-blue-800">
                <Check className="size-4" strokeWidth={2} /> 갤러리 이미지 업로드 완료 ({galleryImageUrls.length}개)
              </p>
              <button
                type="button"
                onClick={copyAllUrls}
                className="inline-flex min-h-9 items-center gap-1 rounded-design-sm bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700"
              >
                <Copy className="size-3.5" /> 모든 URL 복사 (JSON)
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
              {galleryImageUrls.map((url, index) => (
                <div key={index} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Gallery ${index + 1}`}
                    className="h-24 w-full rounded border border-admin-border object-cover"
                  />
                  {/* hover→tap: always tappable on touch, hover overlay on desktop */}
                  <button
                    type="button"
                    onClick={() => copyUrl(url)}
                    aria-label={`갤러리 이미지 ${index + 1} URL 복사`}
                    className="absolute inset-0 flex items-center justify-center rounded bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100 sm:opacity-0"
                  >
                    <span className="inline-flex items-center gap-1 text-xs text-white">
                      <Copy className="size-3.5" /> 복사
                    </span>
                  </button>
                  {/* Persistent corner copy button so touch users aren't stuck with a hover-only overlay */}
                  <button
                    type="button"
                    onClick={() => copyUrl(url)}
                    aria-label={`갤러리 이미지 ${index + 1} URL 복사`}
                    className="absolute right-1 top-1 inline-flex size-7 items-center justify-center rounded-md bg-black/55 text-white sm:hidden"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Usage Guide */}
      <div className="rounded-design-md border border-admin-border bg-admin-surface p-6 shadow-admin-card">
        <h3 className="mb-3 flex items-center gap-1.5 text-base font-semibold text-slate-900">
          <BookOpen className="size-4 text-slate-400" strokeWidth={1.75} /> 사용 방법
        </h3>
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            <strong className="font-medium text-slate-800">1. 이미지 업로드:</strong> 위의 영역에 이미지를 드래그하거나 클릭하여 업로드하세요.
          </p>
          <p>
            <strong className="font-medium text-slate-800">2. URL 복사:</strong> 업로드 완료 후 표시된 URL을 복사하세요.
          </p>
          <p>
            <strong className="font-medium text-slate-800">3. SQL에 사용:</strong> 복사한 URL을 SQL INSERT 문의 <code className="rounded bg-slate-100 px-1">image_url</code> 또는 <code className="rounded bg-slate-100 px-1">gallery_images</code> 필드에 사용하세요.
          </p>
          <p>
            <strong className="font-medium text-slate-800">예시:</strong>
          </p>
          <pre className="overflow-x-auto rounded border border-admin-border bg-slate-50 p-3 text-xs">
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
