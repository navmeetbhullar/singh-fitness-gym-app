import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { Member, GymAnnouncement, GymNotification, PlanChangeRequest, WorkoutPlan, DietPlan } from "./types";

const firebaseConfig = {
  apiKey: "AIzaSyBHaBcS_qhAgJ3PWhjqpgSSMDaol3zQzng",
  authDomain: "singh-fitness.firebaseapp.com",
  projectId: "singh-fitness",
  storageBucket: "singh-fitness.firebasestorage.app",
  messagingSenderId: "389000954327",
  appId: "1:389000954327:web:dc5aecc77de06766b94b92"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  }
);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Generic helper to get a single document from Firestore
export async function getDocument<T>(collectionName: string, id: string): Promise<T | null> {
  try {
    const docRef = doc(db, collectionName, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as unknown as T;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching document ${id} from ${collectionName}:`, error);
    return null;
  }
}

// Generic helpers for Firestore collections
export async function getCollectionData<T>(collectionName: string): Promise<T[]> {
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    const items: T[] = [];
    querySnapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() } as unknown as T);
    });
    return items;
  } catch (error) {
    console.error(`Error fetching collection ${collectionName}:`, error);
    return [];
  }
}

export async function saveDocument<T extends { id: string }>(collectionName: string, item: T): Promise<void> {
  try {
    const docRef = doc(db, collectionName, item.id);
    await setDoc(docRef, item, { merge: true });
  } catch (error) {
    console.error(`Error saving document in ${collectionName}:`, error);
  }
}

export async function deleteDocument(collectionName: string, id: string): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting document from ${collectionName}:`, error);
  }
}

// Real-time listener — calls callback whenever collection changes
export function subscribeCollection<T>(collectionName: string, callback: (items: T[]) => void): () => void {
  const colRef = collection(db, collectionName);
  const unsubscribe = onSnapshot(colRef, (snapshot) => {
    const items: T[] = [];
    snapshot.forEach((d) => {
      items.push({ id: d.id, ...d.data() } as unknown as T);
    });
    callback(items);
  }, (error) => {
    console.error(`Error in realtime listener for ${collectionName}:`, error);
  });
  return unsubscribe;
}

// Batch seeding helper
export async function seedCollectionIfEmpty<T extends { id: string }>(
  collectionName: string,
  initialData: T[]
): Promise<T[]> {
  try {
    const existing = await getCollectionData<T>(collectionName);
    if (existing.length > 0) {
      return existing;
    }

    console.log(`Seeding initial data for ${collectionName}...`);
    const batch = writeBatch(db);
    initialData.forEach((item) => {
      const docRef = doc(db, collectionName, item.id);
      batch.set(docRef, item);
    });
    await batch.commit();
    return initialData;
  } catch (error) {
    console.error(`Error seeding collection ${collectionName}:`, error);
    return initialData;
  }
}
