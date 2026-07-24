/**
 * 공용 렌더 헬퍼.
 *
 * 🔴 `__tests__/` **밖에** 산다. 안에 두면 jest의 testMatch가 이 파일을 스위트로
 * 집어 "Your test suite must contain at least one test"로 매번 실패한다 —
 * 실제로 그 상태로 오래 방치돼 있었고, 여러 세션이 "사전존재 실패"로 무시했다.
 * `lib/ops/report/test-support/supabase-mock.ts`가 같은 이유로 이미 밖에 있다.
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n';

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <I18nProvider>
      {children}
    </I18nProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };













