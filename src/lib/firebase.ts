import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// Only initialize if projectId is filled in — otherwise Firestore calls will fail gracefully
// and the app falls back to mock data via the try/catch in each data function.
let app: FirebaseApp | null = null;
let db: Firestore | null = null;

const isConfigured = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch {
    app = null;
    db = null;
  }
}

export { db, isConfigured };

// Convenience flag for the UI to know whether we're in mock mode
export const usingMockData = !isConfigured;
