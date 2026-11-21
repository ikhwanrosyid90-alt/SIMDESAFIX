import { initializeApp, getApps } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

// Explicitly persist Firebase Auth session across reloads, tabs, and PWA restarts
setPersistence(auth, browserLocalPersistence).catch(() => {
  // Ignore if browser restricts storage (e.g., strict private mode)
});

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
];

function buildGoogleProvider(options?: {
  loginHint?: string;
  forceAccountSelect?: boolean;
}): GoogleAuthProvider {
  const prov = new GoogleAuthProvider();
  for (const scope of WORKSPACE_SCOPES) {
    prov.addScope(scope);
  }
  const params: Record<string, string> = {};
  if (options?.loginHint) {
    params.login_hint = options.loginHint;
  }
  if (options?.forceAccountSelect) {
    params.prompt = 'select_account';
  }
  if (Object.keys(params).length > 0) {
    prov.setCustomParameters(params);
  }
  return prov;
}

let isSigningIn = false;
// Access token is strictly stored in memory only (never localStorage or sessionStorage)
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure(user);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure(null);
    }
  });
};

export function translateGoogleAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  switch (code) {
    case 'auth/unauthorized-domain':
      return `Domain "${host}" belum didaftarkan di Firebase Authorized Domains. Tambahkan domain ini di Firebase Console → Authentication → Settings → Authorized domains.`;
    case 'auth/popup-blocked':
      return 'Jendela login Google diblokir oleh browser/HP. Izinkan pop-up untuk situs ini lalu coba lagi.';
    case 'auth/popup-closed-by-user':
      return 'Jendela login Google ditutup sebelum proses masuk selesai.';
    case 'auth/cancelled-popup-request':
      return 'Permintaan login sebelumnya dibatalkan. Silakan klik tombol masuk sekali lagi.';
    case 'auth/network-request-failed':
      return 'Koneksi internet bermasalah saat menghubungi server Google. Periksa jaringan Anda.';
    default:
      return error instanceof Error
        ? error.message
        : 'Gagal masuk dengan akun Google. Pastikan pop-up diizinkan dan email terdaftar.';
  }
}

export const googleSignIn = async (options?: {
  loginHint?: string;
  forceAccountSelect?: boolean;
}): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const provider = buildGoogleProvider(options);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        'Gagal mendapatkan token akses Google Workspace. Silakan coba masuk kembali.'
      );
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: unknown) {
    console.error('Google Sign-In error:', error);
    throw new Error(translateGoogleAuthError(error));
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const clearCachedToken = () => {
  cachedAccessToken = null;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};
