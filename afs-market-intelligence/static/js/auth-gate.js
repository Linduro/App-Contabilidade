/**
 * Portão de autenticação — roda antes do app.js (sessão compartilhada com o portal).
 */
import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const ALLOWED_EMAILS = ['cartoonhq@gmail.com', 'gabrieldouran@gmail.com'];

export function portalBasePath() {
  return window.__AFS_BASE_PATH__ || '';
}

export function portalSignInUrl() {
  const base = portalBasePath();
  const ret = encodeURIComponent(window.location.pathname + window.location.search);
  return base + '/sign-in/?redirect=' + ret;
}

export function portalHomeUrl() {
  return portalBasePath() + '/dashboard/';
}

window.AFS_portalSignInUrl = portalSignInUrl;
window.AFS_portalHomeUrl = portalHomeUrl;

function setLoginStatus(msg) {
  const el = document.getElementById('login-status');
  if (el) el.textContent = msg;
}

function showSignInFallback() {
  const signIn = portalSignInUrl();
  const fallback = document.getElementById('login-fallback');
  const link = document.getElementById('login-fallback-link');
  if (link) link.href = signIn;
  if (fallback) fallback.classList.remove('hidden');
  return signIn;
}

/**
 * @param {() => void | Promise<void>} onAuthorized
 */
export function startAuthGate(onAuthorized) {
  showSignInFallback();

  let settled = false;
  const signIn = portalSignInUrl();

  const redirectTimer = setTimeout(function () {
    if (settled) return;
    setLoginStatus('Sessão não detectada. Redirecionando para o login…');
    window.location.replace(signIn);
  }, 3500);

  const failTimer = setTimeout(function () {
    if (settled) return;
    setLoginStatus('Não foi possível conectar ao Firebase Auth. Use o botão abaixo.');
  }, 12000);

  try {
    onAuthStateChanged(auth, function (user) {
      settled = true;
      clearTimeout(redirectTimer);
      clearTimeout(failTimer);

      const email = (user && user.email ? user.email : '').toLowerCase();
      if (user && ALLOWED_EMAILS.includes(email)) {
        setLoginStatus('Sessão válida. Carregando…');
        document.getElementById('afs-login')?.classList.add('hidden');
        document.getElementById('afs-app')?.classList.remove('hidden');
        Promise.resolve(onAuthorized()).catch(function (err) {
          console.error('[AFS-ERROR] boot', err);
          setLoginStatus('Erro ao carregar o app. Recarregue a página.');
          document.getElementById('afs-login')?.classList.remove('hidden');
          document.getElementById('afs-app')?.classList.add('hidden');
        });
        return;
      }

      if (user) {
        setLoginStatus('Usuário sem permissão. Saindo…');
        signOut(auth).then(function () {
          window.location.href = portalHomeUrl();
        });
        return;
      }

      setLoginStatus('Redirecionando para o login do portal…');
      window.location.replace(signIn);
    });
  } catch (err) {
    settled = true;
    clearTimeout(redirectTimer);
    clearTimeout(failTimer);
    console.error('[AFS-ERROR] auth-gate', err);
    setLoginStatus('Erro de autenticação. Use o botão para entrar.');
    showSignInFallback();
  }
}
