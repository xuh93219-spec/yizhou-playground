import React from 'react';
import { createRoot } from 'react-dom/client';
import Studio from './app/studio';
import './app/globals.css';
import './app/studio.css';
createRoot(document.getElementById('root')!).render(<Studio/>);
