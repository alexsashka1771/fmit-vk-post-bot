import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/manrope/cyrillic-400.css';
import '@fontsource/manrope/cyrillic-600.css';
import '@fontsource/manrope/cyrillic-700.css';
import '@fontsource/manrope/cyrillic-800.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-700.css';
import '@fontsource/golos-text/cyrillic-400.css';
import '@fontsource/golos-text/cyrillic-500.css';
import '@fontsource/golos-text/latin-400.css';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
