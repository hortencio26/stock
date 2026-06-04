import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, doc, getDocFromServer, collection, getDocs, limit, query, writeBatch } from 'firebase/firestore';
import { INITIAL_USERS, INITIAL_PRODUCTS } from './initialData';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Client Firebase credentials defined as configuration environment variables
const metaEnv = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey || metaEnv.VITE_FIREBASE_API_KEY || "",
  authDomain: firebaseConfigJson.authDomain || metaEnv.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: firebaseConfigJson.projectId || metaEnv.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: firebaseConfigJson.storageBucket || metaEnv.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: firebaseConfigJson.messagingSenderId || metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: firebaseConfigJson.appId || metaEnv.VITE_FIREBASE_APP_ID || "",
  firestoreDatabaseId: firebaseConfigJson.firestoreDatabaseId || ""
};

// Initialize Firebase App securely (avoiding duplicate instances in hot-reloading)
export const app = firebaseConfig.apiKey ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()) : null;

export const db = app ? (
  firebaseConfig.firestoreDatabaseId 
    ? initializeFirestore(app, { localCache: memoryLocalCache() }, firebaseConfig.firestoreDatabaseId)
    : initializeFirestore(app, { localCache: memoryLocalCache() })
) : null;

export const auth = app ? getAuth(app) : null;

// Operational and robust Error handling system conformant to the Firebase Skill guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

/**
 * Handles Firestore security and database access errors securely.
 * Re-throws structured errors parsing auth attributes so debugging state transitions is trivial.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error Incident Captured:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Ensures a silent anonymous session is established when Firebase is configured.
 */
let isAuthReadyPromise: Promise<void> | null = null;

export function ensureAuthReady(): Promise<void> {
  if (isAuthReadyPromise) {
    return isAuthReadyPromise;
  }

  isAuthReadyPromise = new Promise((resolve) => {
    const apiKey = firebaseConfig.apiKey;
    if (!apiKey || !auth) {
      resolve();
      return;
    }

    // Check if user is already populated synchronously
    if (auth.currentUser) {
      resolve();
      return;
    }

    // Unsubscribe helper to prevent memory leaks and ensure singleness of resolution
    let resolved = false;
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      unsubscribe();
      if (!resolved) {
        resolved = true;
        if (user) {
          console.log("Sessão persistida recuperada com sucesso para UID:", user.uid);
          resolve();
        } else {
          try {
            await signInAnonymously(auth);
            console.log("Nova sessão anônima estabelecida com sucesso para acesso seguro.");
          } catch (authError: any) {
            console.warn("Autenticação anônima não pôde ser estabelecida na inicialização:", authError.message || authError);
          }
          resolve();
        }
      }
    }, (err) => {
      unsubscribe();
      if (!resolved) {
        resolved = true;
        resolve();
      }
    });

    // Fallback if the connection is slow or taking too long
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    }, 2500);
  });

  return isAuthReadyPromise;
}

export async function ensureAnonymousLogin(): Promise<void> {
  await ensureAuthReady();
}

/**
 * Tests the connection to the Firestore server upon app initialization
 * and validates database reachability.
 */
export async function testConnection() {
  if (!firebaseConfig.apiKey || !db) {
    console.warn("Firebase configuration credentials not set in environment variables.");
    return;
  }
  try {
    await ensureAnonymousLogin();
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore reachability validation checked.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please double check your client connectivity and Firebase configuration.");
    }
  }
}

// Automatically trigger local connection verify tests
testConnection();

/**
 * Verifies if the Firestore database is empty and automatically loads initial parish products and users.
 * Meets security rules by utilizing anonymous authentication safely.
 */
export async function seedDatabaseIfEmpty(onProgress?: (msg: string) => void): Promise<{ seeded: boolean; error?: string }> {
  const apiKey = firebaseConfig.apiKey;
  if (!apiKey || !auth || !db) {
    console.warn("Sem credenciais do Firebase configuradas (.env). Pulando carga inicial automática.");
    return { seeded: false };
  }

  try {
    onProgress?.("Conectando e autenticando temporariamente no Cloud Firebase...");
    // Ensure the client has an active session to pass the firestore security rules
    await ensureAuthReady();

    if (!auth.currentUser) {
      console.warn("Nenhum usuário autenticado detectado após inicialização.");
    }

    onProgress?.("Verificando integridade das coleções no Firestore...");
    
    // Check locally first for fast bypass response
    if (localStorage.getItem('stock_parocos_sys_seeded') === 'true') {
      console.log("Sistema já sincronizou semente inicialmente. Ignorando seeding.");
      return { seeded: false };
    }

    const seedDocRef = doc(db, 'system_config', 'seeding');
    let hasSeededMarker = false;
    try {
      const seedDocSnap = await getDocFromServer(seedDocRef);
      if (seedDocSnap.exists() && (seedDocSnap.data() as any)?.seeded) {
        hasSeededMarker = true;
      }
    } catch (e) {
      console.warn("Erro ao ler marcador de semente do Cloud Firestore, verificando coleções:", e);
    }

    if (hasSeededMarker) {
      console.log("Base de dados paroquial já semeada anteriormente. Carga automática pulada.");
      localStorage.setItem('stock_parocos_sys_seeded', 'true');
      return { seeded: false };
    }

    const productsRef = collection(db, 'products');
    const q = query(productsRef, limit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      console.log("Firebase Firestore já contém produtos cadastrados. Carga inicial ignorada.");
      localStorage.setItem('stock_parocos_sys_seeded', 'true');
      return { seeded: false };
    }

    onProgress?.("Carga inicial iniciada! Sincronizando dados de simulação...");
    const batch = writeBatch(db);

    // 1. Seed Initial Authorization Users/Operators
    for (const u of INITIAL_USERS) {
      const userDocRef = doc(db, 'users', u.id);
      batch.set(userDocRef, u);
    }

    // 2. Seed Initial Products (Velas, Bíblias, Vinho Litúrgico, etc)
    for (const p of INITIAL_PRODUCTS) {
      const prodDocRef = doc(db, 'products', p.id);
      batch.set(prodDocRef, p);
    }

    // 3. Mark the database as seeded to allow complete user wipe outs
    batch.set(seedDocRef, { seeded: true, timestamp: new Date().toISOString() });

    onProgress?.("Gravando e aplicando documentos sincronizados no Firestore...");
    await batch.commit();

    localStorage.setItem('stock_parocos_sys_seeded', 'true');
    console.log("Base de dados paroquial sincronizada com o Cloud Firestore com sucesso.");
    onProgress?.("Sincronização paroquial concluída!");
    return { seeded: true };
  } catch (error: any) {
    const errorStr = error?.message || String(error);
    if (errorStr.includes('admin-restricted-operation') || errorStr.includes('auth/')) {
      console.warn(
        "💡 [Firebase Setup Info]: Não foi possível autenticar anonimamente para a sincronização inicial automática ocorrer no Firebase.\n" +
        "Certifique-se de que o provedor 'Anonymous' está ativo em Authentication > Sign-in Method no Painel do Firebase.\n" +
        "Mais detalhes do erro:", errorStr
      );
    } else {
      console.warn("Aviso na carga inicial do Firebase (Sincronização adiada):", errorStr);
    }
    return { seeded: false, error: errorStr };
  }
}

