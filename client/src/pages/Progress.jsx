import React from 'react';
import { useApp } from '../App.jsx';
import IndiaProgress from './IndiaProgress.jsx';
import ProgressAustralia from './ProgressAustralia.jsx';

export default function Progress() {
  const { user } = useApp();
  return user?.course === 'in' ? <IndiaProgress /> : <ProgressAustralia />;
}
