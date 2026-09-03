import React from 'react';
import SettingsLegacy from './SettingsLegacy.jsx';
import CloudAccountPanel from '../components/CloudAccountPanel.jsx';
import ClassroomPanel from '../components/ClassroomPanel.jsx';
import AssignmentInboxPanel from '../components/AssignmentInboxPanel.jsx';
import StaffOperationsPanel from '../components/StaffOperationsPanel.jsx';

export default function Settings() {
  return (
    <>
      <SettingsLegacy />
      <CloudAccountPanel />
      <AssignmentInboxPanel />
      <ClassroomPanel />
      <StaffOperationsPanel />
    </>
  );
}