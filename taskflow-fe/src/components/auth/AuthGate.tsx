import React, { useEffect, useRef, useState } from 'react';
import AuthOverlay, { AuthOverlayStep } from './AuthOverlay';

interface AuthGateProps {
  children: React.ReactNode;
}

const BACKEND_URL = (() => {
  let url = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
  return url.replace(/\/api\/?$/, '').replace(/\/+$/, '');
})();

const PUBLIC_URL = (typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL) || '';

/**
 * AuthGate – wraps the entire app.
 *
 * Shows AuthOverlay (full-screen) while checking/performing authentication.
 * Renders children only when a valid Sanctum token is confirmed.
 *
 * Flow (no token in localStorage):
 * - NOT inside Bitrix iframe → redirect to /auth/redirect (OAuth) immediately
 * - Inside Bitrix iframe + BX24 SDK → try BX24.getAuth() silent SSO (timeout 4s)
 * - Inside Bitrix iframe, BX24 unavailable → redirect to OAuth
 *
 * Flow (session expired / 401 in api.ts):
 * - api.ts removes the token + triggers 'taskflow:session-expired' custom event
 * - AuthGate listens, switches to overlay, then redirects to OAuth
 */
const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [overlayStep, setOverlayStep] = useState<AuthOverlayStep | null>(() => {
    // Handle ?token= in URL (OAuth callback from backend)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      localStorage.setItem('taskflow_token', urlToken);
      window.history.replaceState({}, document.title, window.location.pathname);
      return null; // authenticated, no overlay
    }
    const existingToken = localStorage.getItem('taskflow_token');
    return existingToken ? null : 'preparing'; // show overlay if no token
  });

  const didAttemptRef = useRef(false);

  // ─── Handle session expired event from api.ts ─────────────────────────────
  useEffect(() => {
    const handleExpired = () => {
      setOverlayStep('session_expired');
      const origin = window.location.origin + PUBLIC_URL;
      setTimeout(() => {
        setOverlayStep('redirecting');
        window.location.href = `${BACKEND_URL}/auth/redirect?origin=${encodeURIComponent(origin)}`;
      }, 1800);
    };

    window.addEventListener('taskflow:session-expired', handleExpired);
    return () => window.removeEventListener('taskflow:session-expired', handleExpired);
  }, []);

  // ─── Initial auth check (no token at all) ─────────────────────────────────
  useEffect(() => {
    if (overlayStep === null) return; // already authenticated
    if (didAttemptRef.current) return;
    didAttemptRef.current = true;

    // Save intended destination to restore after login
    const currentFullPath = window.location.pathname + window.location.search + window.location.hash;
    if (currentFullPath && !currentFullPath.includes('token=')) {
      localStorage.setItem('taskflow_redirect_path', currentFullPath);
    }

    const doRedirect = () => {
      setOverlayStep('redirecting');
      const origin = window.location.origin + PUBLIC_URL;
      window.location.href = `${BACKEND_URL}/auth/redirect?origin=${encodeURIComponent(origin)}`;
    };

    const w = window as any;
    const isInsideIframe = window.self !== window.top;
    const hasBX24 = typeof w.BX24 !== 'undefined' && typeof w.BX24.init === 'function';

    // Not in Bitrix iframe → redirect immediately
    if (!isInsideIframe || !hasBX24) {
      doRedirect();
      return;
    }

    // In Bitrix iframe with BX24 → try silent SSO
    setOverlayStep('connecting');

    const bx24Timer = setTimeout(doRedirect, 4000);

    w.BX24.init(() => {
      clearTimeout(bx24Timer);
      const auth = w.BX24.getAuth();

      if (!auth || !auth.access_token) {
        setOverlayStep('error');
        setTimeout(doRedirect, 1500);
        return;
      }

      setOverlayStep('authenticating');

      fetch('/api/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          AUTH_ID: auth.access_token,
          REFRESH_ID: auth.refresh_token,
          AUTH_EXPIRES: auth.expires_in,
          DOMAIN: auth.domain,
          member_id: auth.member_id || '',
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.token) {
            localStorage.setItem('taskflow_token', data.token);
            const redirectPath = localStorage.getItem('taskflow_redirect_path') || '/';
            localStorage.removeItem('taskflow_redirect_path');
            window.history.replaceState({}, document.title, redirectPath);
            setOverlayStep(null); // authenticated!
          } else {
            setOverlayStep('error');
            setTimeout(doRedirect, 2000);
          }
        })
        .catch(() => {
          setOverlayStep('error');
          setTimeout(doRedirect, 2000);
        });
    });

    return () => clearTimeout(bx24Timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (overlayStep !== null) {
    return <AuthOverlay step={overlayStep} />;
  }

  return <>{children}</>;
};

export default AuthGate;
