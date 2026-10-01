import React, { useEffect, useState } from 'react';
import SettingsLegacy from './SettingsLegacy.jsx';
import CloudAccountPanel from '../components/CloudAccountPanel.jsx';
import ClassroomPanel from '../components/ClassroomPanel.jsx';
import AssignmentInboxPanel from '../components/AssignmentInboxPanel.jsx';
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';
import { onCloudSessionChange } from '../platform/cloudSession.js';

// The content-operations and admin console is for support and admin accounts
// only, and the server enforces that on every call it makes. A student never
// sees it, so a student's device never downloads it either: the panel is
// fetched on demand (vite.config.js names it in ON_DEMAND) and only once the
// cloud account it is signed in with reports a staff role. The panel still
// checks the role itself and still clears what it holds when the session
// changes; this gate only decides whether its code is worth asking for.
const StaffOperationsPanel = React.lazy(() => import('../components/StaffOperationsPanel.jsx'));
const STAFF_ROLES = ['support', 'admin'];

function StaffOperations() {
  const [staff, setStaff] = useState(false);

  useEffect(() => {
    if (!cloudAvailable()) return undefined;
    let live = true;
    const check = () => {
      cloud.me().then(
        me => { if (live) setStaff(STAFF_ROLES.includes(me?.account?.role)); },
        () => { if (live) setStaff(false); }
      );
    };
    check();
    const stop = onCloudSessionChange(check);
    return () => { live = false; stop(); };
  }, []);

  if (!staff) return null;
  return (
    <React.Suspense fallback={null}>
      <StaffOperationsPanel />
    </React.Suspense>
  );
}

export default function Settings() {
  return (
    <>
      <SettingsLegacy />
      <CloudAccountPanel />
      <AssignmentInboxPanel />
      <ClassroomPanel />
      <StaffOperations />
    </>
  );
}
