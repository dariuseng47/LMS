import { AuthSplitLayout } from 'src/layouts/auth-split';

import { GuestGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export default function Layout({ children }) {
  return (
    <GuestGuard>
      <AuthSplitLayout
        header={{ sx: { display: 'none' } }}
        section={{
          title: 'ระบบบริหารจัดการผ้า RFID',
          subtitle: 'ติดตามและบริหารผ้าในเครือข่ายโรงพยาบาลของคุณแบบเรียลไทม์ ทุกขั้นตอนตั้งแต่ซักจนถึงตู้แผนก',
        }}
      >
        {children}
      </AuthSplitLayout>
    </GuestGuard>
  );
}
