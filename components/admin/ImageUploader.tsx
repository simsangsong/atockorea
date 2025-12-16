'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface ImageUploaderProps {
  onUploadComplete: (urls: string[]) => void;
  multiple?: boolean;
  type?: 'product' | 'gallery';
  folder?: string;
  maxFiles?: number;
}

export default function ImageUploader({
  onUploadComplete,
  multiple = false,
  type = 'product',
  folder = 'uploads',
  maxFiles = 10,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length > maxFiles) {
      setError(`최대 ${maxFiles}개의 파일만 업로드할 수 있습니다.`);
      return;
    }

    await uploadFiles(Array.from(files));
  };

  const uploadFiles = async (files: File[]) => {
    try {
      setUploading(true);
      setError(null);

      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        setError('로그인이 필요합니다.');
        return;
      }

      const formData = new FormData();
      
      if (files.length === 1 && !multiple) {
        formData.append('file', files[0]);
      } else {
        files.forEach((file) => {
          formData.append('files', file);
        });
      }
      
      formData.append('type', type);
      formData.append('folder', folder);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '업로드 실패');
      }

      const result = await response.json();
      
      let urls: string[] = [];
      if (result.url) {
        // Single file upload
        urls = [result.url];
      } else if (result.files) {
        // Multiple files upload
        urls = result.files.map((f: any) => f.url);
      }

      setUploadedUrls((prev) => [...prev, ...urls]);
      onUploadComplete(urls);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || '이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/')
    );

    if (files.length === 0) return;

    if (!multiple && files.length > 1) {
      setError('단일 파일만 업로드할 수 있습니다.');
      return;
    }

    if (files.length > maxFiles) {
      setError(`최대 ${maxFiles}개의 파일만 업로드할 수 있습니다.`);
      return;
    }

    await uploadFiles(files);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-500 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />
        {uploading ? (
          <div className="space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-sm text-gray-600">업로드 중...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-4xl">📷</div>
            <p className="text-sm font-medium text-gray-700">
              클릭하거나 드래그하여 이미지 업로드
            </p>
            <p className="text-xs text-gray-500">
              {multiple ? `최대 ${maxFiles}개 파일` : '단일 파일'} (JPG, PNG, WebP)
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">❌ {error}</p>
        </div>
      )}

      {uploadedUrls.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            ✅ 업로드 완료 ({uploadedUrls.length}개)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {uploadedUrls.map((url, index) => (
              <div key={index} className="relative group">
                <img
                  src={url}
                  alt={`Uploaded ${index + 1}`}
                  className="w-full h-24 object-cover rounded-lg border border-gray-200"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(url);
                    alert('이미지 URL이 클립보드에 복사되었습니다!');
                  }}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center"
                >
                  <span className="text-white text-xs">URL 복사</span>
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
            <p className="font-medium mb-1">업로드된 이미지 URL:</p>
            {uploadedUrls.map((url, index) => (
              <div key={index} className="flex items-center gap-2 mb-1">
                <code className="flex-1 text-xs bg-white p-1 rounded border truncate">
                  {url}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(url);
                    alert('URL 복사됨!');
                  }}
                  className="px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
                >
                  복사
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
