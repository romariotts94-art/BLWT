import React from 'react';
import {createRoot} from 'react-dom/client';
import CareGuide from '../components/CareGuide';
import '../app/globals.css';
createRoot(document.getElementById('root')!).render(<CareGuide homeHref="./"/>);
