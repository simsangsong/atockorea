import { redirect } from 'next/navigation';

export default async function ToursIndexRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();

  const resolvedSearchParams = (await searchParams) ?? {};

  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item != null) params.append(key, item);
      }
    } else if (value != null) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  redirect(query ? `/tours/list?${query}` : '/tours/list');
}
