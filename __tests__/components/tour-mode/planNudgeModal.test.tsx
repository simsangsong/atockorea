import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PlanNudgeModal from '@/components/tour-mode/PlanNudgeModal';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function installPlanFetch(plan: {
  status?: string;
  can_edit?: boolean;
  is_lead?: boolean;
  guide_curated?: boolean;
}) {
  global.fetch = jest.fn(async () =>
    jsonResponse({
      day_plan: plan.status ? { status: plan.status } : null,
      viewer: { can_edit: plan.can_edit ?? false, is_lead: plan.is_lead ?? false },
      tour: { guide_curated: plan.guide_curated ?? false },
    }),
  ) as jest.Mock;
}

function renderNudge() {
  return render(
    <PlanNudgeModal bookingId="booking-1" roomSession="sess" locale="en" theme="light" />,
  );
}

beforeEach(() => {
  push.mockClear();
});

it('nudges the lead guest to plan when the plan is still open, and routes to /plan', async () => {
  installPlanFetch({ status: 'guest_draft', can_edit: true, is_lead: true });
  renderNudge();

  const cta = await screen.findByRole('button', { name: /Plan my day/i });
  fireEvent.click(cta);
  expect(push).toHaveBeenCalledWith('/tour-mode/plan/booking-1');
});

it('stays hidden once the plan is delegated to the guide', async () => {
  installPlanFetch({ status: 'guest_draft', can_edit: true, is_lead: true, guide_curated: true });
  renderNudge();

  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  expect(screen.queryByTestId('plan-nudge')).not.toBeInTheDocument();
});

it('stays hidden after the plan has been submitted', async () => {
  installPlanFetch({ status: 'guest_submitted', can_edit: false, is_lead: true });
  renderNudge();

  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  expect(screen.queryByTestId('plan-nudge')).not.toBeInTheDocument();
});

it('stays hidden for a non-lead member who cannot edit the plan', async () => {
  installPlanFetch({ status: 'guest_draft', can_edit: false, is_lead: false });
  renderNudge();

  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  expect(screen.queryByTestId('plan-nudge')).not.toBeInTheDocument();
});
