'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ChevronLeft, CheckCircle2, MailCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const INITIAL = {
  company_name: '',
  business_registration_number: '',
  contact_person: '',
  contact_email: '',
  contact_phone: '',
  address_line1: '',
  address_line2: '',
  city: '',
  province: '',
  postal_code: '',
  country: 'South Korea',
};

const inputClass =
  'min-h-11 w-full rounded-lg border border-admin-border bg-admin-surface px-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700';

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
        {hint && <span className="ml-1.5 text-xs font-normal text-slate-400">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

export default function CreateMerchantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState(INITIAL);

  const dirty = JSON.stringify(formData) !== JSON.stringify(INITIAL);

  // Dirty guard — warn before tab close / refresh while there are unsaved edits.
  useEffect(() => {
    if (!dirty || loading || success) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, loading, success]);

  const set = (key: keyof typeof INITIAL) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };

      if (!session) {
        toast.error('관리자로 로그인해 주세요');
        router.push('/signin?redirect=/admin/merchants/create');
        return;
      }

      const response = await fetch('/api/admin/merchants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          createUser: true,
          companyName: formData.company_name,
          businessRegistrationNumber: formData.business_registration_number || null,
          contactPerson: formData.contact_person,
          contactEmail: formData.contact_email,
          contactPhone: formData.contact_phone,
          addressLine1: formData.address_line1 || null,
          addressLine2: formData.address_line2 || null,
          city: formData.city || null,
          province: formData.province || null,
          postalCode: formData.postal_code || null,
          country: formData.country,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(data?.error || '업체를 생성하지 못했습니다');
        return;
      }

      setSuccess(true);
      toast.success('업체 계정을 생성했습니다');
      setTimeout(() => router.push('/admin/merchants'), 1800);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '네트워크 오류. 다시 시도해 주세요.';
      console.error('Error creating merchant:', err);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <div className="rounded-design-md border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
          <h2 className="mt-3 text-lg font-semibold text-emerald-900">업체 계정을 생성했습니다</h2>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-emerald-800">
            <MailCheck className="size-4" />
            로그인 정보(임시 비밀번호)를 <span className="font-medium">{formData.contact_email}</span> 로 발송했습니다.
          </p>
          <p className="mt-2 text-xs text-slate-500">목록으로 이동합니다…</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Link
          href="/admin/merchants"
          className="mb-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          <ChevronLeft className="size-4" /> 업체 목록
        </Link>
        <h1 className="text-xl font-bold text-slate-900">새 업체 등록</h1>
        <p className="mt-1 text-sm text-slate-500">새 여행사 계정을 생성합니다. 로그인 정보는 담당자 이메일로 발송됩니다.</p>
      </div>

      <section className="rounded-design-md border border-admin-border bg-admin-surface p-5 shadow-admin-card">
        <h2 className="mb-4 text-base font-semibold text-slate-900">회사 정보</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="회사명" required>
            <input type="text" required value={formData.company_name} onChange={set('company_name')} className={inputClass} />
          </Field>
          <Field label="사업자등록번호">
            <input type="text" value={formData.business_registration_number} onChange={set('business_registration_number')} className={inputClass} />
          </Field>
        </div>
      </section>

      <section className="rounded-design-md border border-admin-border bg-admin-surface p-5 shadow-admin-card">
        <h2 className="mb-4 text-base font-semibold text-slate-900">담당자 정보</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="담당자명" required>
            <input type="text" required value={formData.contact_person} onChange={set('contact_person')} className={inputClass} />
          </Field>
          <Field label="이메일" required hint="(로그인 계정으로 사용)">
            <input type="email" required inputMode="email" value={formData.contact_email} onChange={set('contact_email')} className={inputClass} />
          </Field>
          <Field label="연락처" required>
            <input type="tel" required inputMode="tel" value={formData.contact_phone} onChange={set('contact_phone')} className={inputClass} />
          </Field>
        </div>
      </section>

      <section className="rounded-design-md border border-admin-border bg-admin-surface p-5 shadow-admin-card">
        <h2 className="mb-4 text-base font-semibold text-slate-900">주소 정보</h2>
        <div className="space-y-4">
          <Field label="주소">
            <input type="text" value={formData.address_line1} onChange={set('address_line1')} className={inputClass} />
          </Field>
          <Field label="상세 주소">
            <input type="text" value={formData.address_line2} onChange={set('address_line2')} className={inputClass} />
          </Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="시/군/구">
              <input type="text" value={formData.city} onChange={set('city')} className={inputClass} />
            </Field>
            <Field label="시/도">
              <input type="text" value={formData.province} onChange={set('province')} className={inputClass} />
            </Field>
            <Field label="우편번호">
              <input type="text" inputMode="numeric" value={formData.postal_code} onChange={set('postal_code')} className={inputClass} />
            </Field>
          </div>
        </div>
      </section>

      {/* Sticky action bar (§8 sticky CTA) */}
      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-admin-border bg-admin-surface/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:-mx-5 md:px-5">
        <button
          type="button"
          onClick={() => router.push('/admin/merchants')}
          className="min-h-11 rounded-lg border border-admin-border px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="min-h-11 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '생성 중…' : '업체 계정 생성'}
        </button>
      </div>
    </form>
  );
}
