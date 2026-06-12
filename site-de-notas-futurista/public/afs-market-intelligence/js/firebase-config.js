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
    apiKey: 'placeholder',
    authDomain: 'placeholder.firebaseapp.com',
    projectId: 'placeholder',
  },
);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const firebaseApp = app;

window.AFS_FB = { db, auth, app };
