'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export type UploadKind = 'product' | 'gallery';

export type UploadedImage = {
  url: string;
  path: string;
  name: string;
};

/**
 * Hook for uploading a single image (or many) to the admin upload endpoint.
 * Routes to Supabase Storage (`tour-images` for `product`, `tour-gallery` for
 * `gallery`). Returns ready-to-use public URLs.
 *
 * The endpoint already handles auto-compression and admin auth.
 */
export function useImageUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadOne = async (
    file: File,
    opts: { kind?: UploadKind; folder?: string } = {},
  ): Promise<UploadedImage> => {
    const kind = opts.kind ?? 'product';
    const folder = opts.folder ?? `tours/${kind}`;
    const sess = await supabase?.auth.getSession();
    const token = sess?.data.session?.access_token;
    if (!token) throw new Error('세션이 만료되었습니다. 다시 로그인하세요.');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', kind);
    fd.append('folder', folder);

    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
      body: fd,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `업로드 실패 (${res.status})`);
    }
    return { url: json.url, path: json.path, name: json.name } as UploadedImage;
  };

  /**
   * Upload many files sequentially so progress is reportable. Returns the
   * uploaded results in input order; failed files are returned as `null`.
   */
  const uploadMany = async (
    files: File[],
    opts: { kind?: UploadKind; folder?: string } = {},
  ): Promise<Array<UploadedImage | null>> => {
    setUploading(true);
    setError(null);
    setProgress({ done: 0, total: files.length });
    const out: Array<UploadedImage | null> = [];
    let firstError: string | null = null;
    for (let i = 0; i < files.length; i++) {
      try {
        const r = await uploadOne(files[i]!, opts);
        out.push(r);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!firstError) firstError = msg;
        out.push(null);
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setUploading(false);
    setProgress(null);
    if (firstError) setError(firstError);
    return out;
  };

  return { uploading, progress, error, uploadOne, uploadMany };
}
