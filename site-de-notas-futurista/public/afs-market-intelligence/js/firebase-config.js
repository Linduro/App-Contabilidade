/**
 * Firebase SDK v9+ modular — credenciais via window.__AFS_FB_CONFIG__
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const config = window.__AFS_FB_CONFIG__;
if (!config || !config.apiKey) {
  console.warn('[AFS-ERROR] window.__AFS_FB_CONFIG__ ausente — defina em config.json ou no host.');
}

const app = initializeApp(
  config || {
    apiKey: 'AIzaSyAQS75d3hx5mDQwixNRjyRPLOSVWpyDpvk',
    authDomain: 'contabilidade-ebed6.firebaseapp.com',
    projectId: 'contabilidade-ebed6',
    storageBucket: 'contabilidade-ebed6.firebasestorage.app',
    messagingSenderId: '92104290412',
    appId: '1:92104290412:web:e99492aeb27bd9f1902849',
  },
);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const firebaseApp = app;

window.AFS_FB = { db, auth, app };
