import { CONFIG } from 'src/config-global';

import { AuditLogListView } from 'src/sections/security/view/audit-log-list-view';

// ----------------------------------------------------------------------

export const metadata = { title: `Security Audit Logs | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <AuditLogListView />;
}
