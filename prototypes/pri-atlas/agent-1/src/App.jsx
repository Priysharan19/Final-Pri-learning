import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { NavigationProvider } from './lib/navigation.jsx';
import Shell from './components/Shell.jsx';
import CommandPage from './pages/Command.jsx';
import AtlasPage from './pages/Atlas.jsx';
import DestinationPage from './pages/Destination.jsx';

export default function App() {
  return <NavigationProvider><Shell>
    <Routes>
      <Route path="/" element={<CommandPage />} />
      <Route path="/atlas" element={<AtlasPage />} />
      <Route path="/laboratory" element={<DestinationPage kind="laboratory" />} />
      <Route path="/paper" element={<DestinationPage kind="paper" />} />
      <Route path="/insight" element={<DestinationPage kind="insight" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Shell></NavigationProvider>;
}
