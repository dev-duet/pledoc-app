import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { mockComplaints, mockClusters } from './mockData';
import type { Complaint, Cluster, VerificationStatus } from './types';

// ──────────────────────────────────────────────
// COMPLAINTS
// ──────────────────────────────────────────────

export async function addComplaint(
  data: Omit<Complaint, 'id' | 'created_at'>
): Promise<string> {
  try {
    if (!db) throw new Error('Firestore not configured');
    const docRef = await addDoc(collection(db, 'complaints'), {
      ...data,
      created_at: Date.now(),
    });
    return docRef.id;
  } catch (err) {
    console.error('Firestore write failed:', err);
    // Fallback: store in localStorage as mock
    const id = 'local-' + Math.random().toString(36).substring(2, 12);
    const complaint: Complaint = {
      ...data,
      id,
      created_at: Date.now(),
    };
    const existing = getLocalComplaints();
    existing.push(complaint);
    localStorage.setItem('pledoc_local_complaints', JSON.stringify(existing));
    return id;
  }
}

export async function getComplaints(): Promise<Complaint[]> {
  try {
    if (!db) throw new Error('Firestore not configured');
    const snap = await getDocs(collection(db, 'complaints'));
    if (snap.empty) throw new Error('No data');
    const results: Complaint[] = [];
    snap.forEach((d) => {
      const data = d.data() as Omit<Complaint, 'id'>;
      results.push({ ...data, id: d.id } as Complaint);
    });
    return results;
  } catch {
    // Fallback: merge mock + localStorage
    return [...mockComplaints, ...getLocalComplaints()];
  }
}

export async function getComplaintById(id: string): Promise<Complaint | null> {
  try {
    if (!db) throw new Error('Firestore not configured');
    const snap = await getDoc(doc(db, 'complaints', id));
    if (!snap.exists()) throw new Error('Not found');
    const data = snap.data() as Omit<Complaint, 'id'>;
    return { ...data, id: snap.id } as Complaint;
  } catch {
    // Fallback: search mock + local
    const all = [...mockComplaints, ...getLocalComplaints()];
    return all.find((c) => c.id === id) || null;
  }
}

export async function countSimilarComplaints(
  category: string,
  location: string,
  excludeId: string
): Promise<number> {
  try {
    if (!db) throw new Error('Firestore not configured');
    // Loose match: same category AND location text contains any word from the submitted location
    const q = query(
      collection(db, 'complaints'),
      where('category', '==', category)
    );
    const snap = await getDocs(q);
    let count = 0;
    snap.forEach((d) => {
      if (d.id === excludeId) return;
      const data = d.data() as Complaint;
      // Loose location match: check if any significant word overlaps
      const locWords = location.split(',').map((w) => w.trim().toLowerCase());
      const existingWords = (data.location || '').toLowerCase();
      const match = locWords.some(
        (w) => w.length > 2 && existingWords.includes(w)
      );
      if (match) count++;
    });
    return count;
  } catch {
    // Fallback: search mock + local
    const all = [...mockComplaints, ...getLocalComplaints()];
    const locWords = location.split(',').map((w) => w.trim().toLowerCase());
    return all.filter((c) => {
      if (c.id === excludeId) return false;
      if (c.category !== category) return false;
      const existingWords = (c.location || '').toLowerCase();
      return locWords.some(
        (w) => w.length > 2 && existingWords.includes(w)
      );
    }).length;
  }
}

export async function getComplaintsByClusterId(clusterId: string): Promise<Complaint[]> {
  try {
    if (!db) throw new Error('Firestore not configured');
    const q = query(
      collection(db, 'complaints'),
      where('cluster_id', '==', clusterId)
    );
    const snap = await getDocs(q);
    const results: Complaint[] = [];
    snap.forEach((d) => {
      const data = d.data() as Omit<Complaint, 'id'>;
      results.push({ ...data, id: d.id } as Complaint);
    });
    return results;
  } catch {
    const all = [...mockComplaints, ...getLocalComplaints()];
    return all.filter((c) => c.cluster_id === clusterId);
  }
}

export async function updateComplaintsByCluster(
  clusterId: string,
  verificationStatus: VerificationStatus,
  priorityScore: number
): Promise<void> {
  try {
    if (!db) throw new Error('Firestore not configured');
    const q = query(
      collection(db, 'complaints'),
      where('cluster_id', '==', clusterId)
    );
    const snap = await getDocs(q);
    const firestore = db;
    const batch = writeBatch(firestore);
    snap.forEach((d) => {
      batch.update(doc(firestore, 'complaints', d.id), {
        verification_status: verificationStatus,
        priority_score: priorityScore,
      });
    });
    await batch.commit();
  } catch {
    // Fallback: update local complaints
    const local = getLocalComplaints();
    let changed = false;
    local.forEach((c) => {
      if (c.cluster_id === clusterId) {
        c.verification_status = verificationStatus;
        c.priority_score = priorityScore;
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem('pledoc_local_complaints', JSON.stringify(local));
    }
    // Also update mock data in memory
    mockComplaints.forEach((c) => {
      if (c.cluster_id === clusterId) {
        c.verification_status = verificationStatus;
        c.priority_score = priorityScore;
      }
    });
  }
}

// ──────────────────────────────────────────────
// CLUSTERS
// ──────────────────────────────────────────────

export async function getClusters(): Promise<Cluster[]> {
  try {
    if (!db) throw new Error('Firestore not configured');
    const snap = await getDocs(collection(db, 'clusters'));
    if (snap.empty) throw new Error('No data');
    const results: Cluster[] = [];
    snap.forEach((d) => {
      const data = d.data() as Omit<Cluster, 'id'>;
      results.push({ ...data, id: d.id } as Cluster);
    });
    return results;
  } catch {
    return [...mockClusters, ...getLocalClusters()];
  }
}

export async function updateClusterVerification(
  clusterId: string,
  verificationStatus: VerificationStatus,
  priorityScore: number
): Promise<void> {
  try {
    if (!db) throw new Error('Firestore not configured');
    await updateDoc(doc(db, 'clusters', clusterId), {
      verification_status: verificationStatus,
      priority_score: priorityScore,
    });
  } catch {
    // Fallback: update local
    const local = getLocalClusters();
    let found = false;
    local.forEach((c) => {
      if (c.id === clusterId) {
        c.verification_status = verificationStatus;
        c.priority_score = priorityScore;
        found = true;
      }
    });
    if (!found) {
      // Update mock in memory
      mockClusters.forEach((c) => {
        if (c.id === clusterId) {
          c.verification_status = verificationStatus;
          c.priority_score = priorityScore;
        }
      });
    } else {
      localStorage.setItem('pledoc_local_clusters', JSON.stringify(local));
    }
  }
}

// ──────────────────────────────────────────────
// DEMO DATA SEEDING
// ──────────────────────────────────────────────

export async function seedDemoData(): Promise<void> {
  const demoComplaints = mockComplaints;
  const demoClusters = mockClusters;

  try {
    if (!db) throw new Error('Firestore not configured');

    // Idempotency: check for existing demo-tagged docs and remove them first
    const existingComplaints = await getDocs(collection(db, 'complaints'));
    const batch = writeBatch(db);
    let hasDemo = false;
    existingComplaints.forEach((d) => {
      const data = d.data();
      if (data.is_demo === true) {
        batch.delete(d.ref);
        hasDemo = true;
      }
    });
    if (hasDemo) await batch.commit();

    // Seed clusters first to get their IDs
    const clusterIdMap: Record<string, string> = {};
    for (const cl of demoClusters) {
      const ref = await addDoc(collection(db, 'clusters'), {
        ...cl,
        is_demo: true,
      });
      clusterIdMap[cl.id] = ref.id;
    }

    // Seed complaints with mapped cluster IDs
    for (const c of demoComplaints) {
      await addDoc(collection(db, 'complaints'), {
        ...c,
        cluster_id: c.cluster_id ? clusterIdMap[c.cluster_id] || null : null,
        is_demo: true,
      });
    }
  } catch {
    // Fallback: seed into localStorage
    const local = getLocalComplaints();
    // Remove existing demo entries
    const filtered = local.filter((c) => !c.id.startsWith('demo-'));
    demoComplaints.forEach((c) => {
      filtered.push({ ...c, id: 'demo-' + c.id });
    });
    localStorage.setItem('pledoc_local_complaints', JSON.stringify(filtered));

    const localClusters = getLocalClusters();
    const filteredClusters = localClusters.filter((c) => !c.id.startsWith('demo-'));
    demoClusters.forEach((c) => {
      filteredClusters.push({ ...c, id: 'demo-' + c.id });
    });
    localStorage.setItem('pledoc_local_clusters', JSON.stringify(filteredClusters));
  }
}

// ──────────────────────────────────────────────
// LOCAL STORAGE HELPERS
// ──────────────────────────────────────────────

function getLocalComplaints(): Complaint[] {
  try {
    const raw = localStorage.getItem('pledoc_local_complaints');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getLocalClusters(): Cluster[] {
  try {
    const raw = localStorage.getItem('pledoc_local_clusters');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────
// PSEUDONYMOUS ID
// ──────────────────────────────────────────────

export function getOrCreatePseudonymousId(): string {
  let id = localStorage.getItem('pledoc_pseudo_id');
  if (!id) {
    id = 'anon-' + Math.random().toString(36).substring(2, 12);
    localStorage.setItem('pledoc_pseudo_id', id);
  }
  return id;
}
