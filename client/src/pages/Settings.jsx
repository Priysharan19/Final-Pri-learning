import React from 'react';
import SettingsLegacy from './SettingsLegacy.jsx';
import CloudAccountPanel from '../components/CloudAccountPanel.jsx';

export default function Settings() {
  return (
    <>
      <SettingsLegacy />
      <CloudAccountPanel />
    </>
  );
}
