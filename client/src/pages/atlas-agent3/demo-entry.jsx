import React from 'react';
import { createRoot } from 'react-dom/client';
import AtlasAgent3Demo from './index.jsx';

const mount = document.getElementById('pri-atlas-agent3');
if (mount) createRoot(mount).render(
  <React.StrictMode><AtlasAgent3Demo /></React.StrictMode>
);
