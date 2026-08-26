'use client';

import { DashboardContent } from 'src/layouts/dashboard';

import { HospitalProfileView } from 'src/sections/hq/view';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <DashboardContent maxWidth="xl">
      <HospitalProfileView />
    </DashboardContent>
  );
}
