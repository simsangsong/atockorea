import OpsApp from '@/components/tour-ops/OpsApp';

/**
 * W3 — the ops center is now the OpsApp shell (dark app chrome, bottom tabs,
 * multi-room broadcast subscription). The v1 single-file console this page
 * used to hold lives on in the tab components under components/tour-ops/.
 */

export default function TourOpsPage() {
  return <OpsApp />;
}
