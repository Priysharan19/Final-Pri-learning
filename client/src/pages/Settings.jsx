import React from 'react';
import SettingsLegacy from './SettingsLegacy.jsx';
import CloudAccountPanel from '../components/CloudAccountPanel.jsx';
import ClassroomPanel from '../components/ClassroomPanel.jsx';
import AssignmentInboxPanel from '../components/AssignmentInboxPanel.jsx';
import StaffOperationsPanel from '../components/StaffOperationsPanel.jsx';
import PilotEvidencePanel from '../components/PilotEvidencePanel.jsx';

export default function Settings() {
  return (
    <>
      <SettingsLegacy />
      <PilotEvidencePanel />
      <CloudAccountPanel />
      <AssignmentInboxPanel />
      <ClassroomPanel />
      <StaffOperationsPanel />
    </>
  );
}