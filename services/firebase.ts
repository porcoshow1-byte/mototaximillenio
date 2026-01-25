import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Helper para ler variáveis de ambiente de forma segura
const getEnv = (key: string) => {
  // @ts-ignore
  return (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) || '';
};

// Configuração do Firebase via Variáveis de Ambiente
// Configure estas variáveis no arquivo .env ou no painel do Vercel
const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID'),
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID')
};

// Se não houver configuração válida, ativamos o modo Mock para o app não quebrar
export const isMockMode = !firebaseConfig.apiKey || firebaseConfig.apiKey.length < 5;

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

try {
  if (!isMockMode) {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("Firebase conectado:", firebaseConfig.projectId);
  } else {
    console.warn("⚠️ Firebase não configurado (Faltam variáveis de ambiente). O app rodará em modo MOCK/DEMO.");
  }
} catch (error: any) {
  console.error("ERRO CRÍTICO FIREBASE:", error);
  // Não relançamos o erro para permitir que o app carregue a UI
}

// Inicializar Storage apenas se não estiver em modo mock (ou mockar se necessário)
import { getStorage, FirebaseStorage } from 'firebase/storage';
let storage: FirebaseStorage | undefined;
if (app && !isMockMode) {
  storage = getStorage(app);
}

import { getDatabase, Database } from 'firebase/database';
let rtdb: Database | undefined;
if (app && !isMockMode) {
  rtdb = getDatabase(app);
}

export { app, db, auth, storage, rtdb };