import { redirect } from 'next/navigation';

export default function SmallGroupToursRedirectPage() {
  redirect('/tours/list?type=join');
}
