// js/services/db.js
import {
  getFirestore, collection, doc,
  getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, limit,
  serverTimestamp, increment, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';
import { app } from './app.js';

const db      = getFirestore(app);
const storage = getStorage(app);

// ── helpers ─────────────────────────────
export function timeAgo(ts) {
  if (!ts) return 'just now';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
export const statusColor = s => ({ available:'#43A047', few:'#FB8C00', full:'#E53935' }[s] ?? '#29ABE2');
export const statusBg    = s => ({ available:'#E8F5E9', few:'#FFF3E0', full:'#FFEBEE' }[s] ?? '#E3F2FD');
export const statusLabel = s => ({ available:'Available', few:'Few Spots Left', full:'Full' }[s] ?? s);

function _isFresh(ts) {
  if (!ts) return false;
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  return (Date.now() - date.getTime()) < 1 * 60 * 1000; // 1 minute
}

function _docToGarage(d) {
  return { id: d.id, ...d.data() };
}

function _docToSpot(d) {
  const data = d.data();
  return { id: d.id, ...data, isFresh: _isFresh(data.reportedAt) };
}

// ══ GARAGES ════════════════════════════
export function onGarages(cb) {
  return onSnapshot(collection(db, 'garages'), snap => {
    cb(snap.docs.map(_docToGarage));
  });
}

export async function getGarage(id) {
  const snap = await getDoc(doc(db, 'garages', id));
  return snap.exists() ? _docToGarage(snap) : null;
}

export async function addGarage(data) {
  return addDoc(collection(db, 'garages'), {
    ...data,
    status:         'available',
    availableSpots: data.totalSpots ?? 0,
    isActive:       true,
    lastUpdated:    serverTimestamp(),
  });
}

export async function updateGarage(id, data) {
  return updateDoc(doc(db, 'garages', id), {
    ...data,
    lastUpdated: serverTimestamp(),
  });
}

export async function deleteGarage(id) {
  return deleteDoc(doc(db, 'garages', id));
}

export async function searchGarages(q) {
  const snap = await getDocs(collection(db, 'garages'));
  return snap.docs
    .map(_docToGarage)
    .filter(g => (g.name ?? '').toLowerCase().includes(q.toLowerCase()));
}

// ══ STREET SPOTS ═══════════════════════
export function onFreshSpots(cb) {
  let unsub = null;

  function _subscribe() {
    if (unsub) unsub();
    // WAIT spots live for 10 min, regular spots live for 1 min
    // Use the wider 10-min window so both types appear; filter freshness per-doc in _docToSpot
    const cutoff = Timestamp.fromDate(new Date(Date.now() - 10 * 60 * 1000));
    const q = query(
      collection(db, 'street_spots'),
      where('reportedAt', '>', cutoff),
      orderBy('reportedAt', 'desc')
    );
    unsub = onSnapshot(q, snap => {
      const now = Date.now();
      const spots = snap.docs
        .map(_docToSpot)
        .filter(sp => {
          if (!sp.reportedAt) return false;
          const date = sp.reportedAt?.toDate ? sp.reportedAt.toDate() : new Date(sp.reportedAt);
          const ageMs = now - date.getTime();
          // WAIT spots: 10 min max; regular spots: 1 min max
          return sp.isWaiting ? ageMs < 10 * 60 * 1000 : ageMs < 1 * 60 * 1000;
        });
      cb(spots);
    });
  }

  _subscribe();

  // Re-subscribe every minute so cutoff stays fresh → old spots disappear automatically
  const interval = setInterval(_subscribe, 60 * 1000);

  return () => {
    if (unsub) unsub();
    clearInterval(interval);
  };
}

export async function addStreetSpot({ uid, reporterName, lat, lng, address, type, photoFile, notes, isWaiting = false }) {
  let photoUrl  = null;
  let photoSaved = false;

  // Upload photo separately — spot is saved even if upload fails
  if (photoFile) {
    try {
      const r = ref(storage, `spot_photos/${uid}_${Date.now()}.jpg`);
      await uploadBytes(r, photoFile);
      photoUrl   = await getDownloadURL(r);
      photoSaved = true;
    } catch (e) {
      console.warn('[ParkUp] Photo upload failed, saving spot without photo:', e.message);
    }
  }

  const docRef = await addDoc(collection(db, 'street_spots'), {
    reportedBy: uid, reporterName,
    lat, lng, address, type,
    photoUrl, notes: notes || null,
    reportedAt: serverTimestamp(),
    confirmed: false, confirmCount: 0,
    isWaiting: isWaiting,
    waitExpiresAt: isWaiting
      ? Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000))
      : null,
  });

  if (isWaiting) {
    // WAIT spots → award points immediately (user is physically there)
    const pts  = photoSaved ? 25 : 20;
    const desc = photoSaved ? 'Waiting to hand off spot (with photo)' : 'Waiting to hand off spot';
    _awardPoints(uid, pts, 'report', desc).catch(e => console.warn('Points:', e.message));
  }
  // Regular spots → points awarded later when another user clicks Navigate (see awardSpotNavigation)

  return docRef.id;
}

export async function deleteSpot(spotId) {
  return deleteDoc(doc(db, 'street_spots', spotId));
}

// Called explicitly when a user navigates to a spot — awards the reporter their points
export async function awardSpotNavigation(spotId) {
  console.log('[ParkUp] awardSpotNavigation called, spotId:', spotId);
  try {
    const spotRef  = doc(db, 'street_spots', spotId);
    const spotSnap = await getDoc(spotRef);
    console.log('[ParkUp] spot exists?', spotSnap.exists());
    if (!spotSnap.exists()) return;

    const spotData    = spotSnap.data();
    const reporterUid = spotData.reportedBy;
    console.log('[ParkUp] reporterUid:', reporterUid, '| isWaiting:', spotData.isWaiting);
    if (!reporterUid) return;

    if (spotData.isWaiting === true) {
      console.log('[ParkUp] WAIT spot — skipping, already awarded');
      return;
    }

    const hasPhoto = !!spotData.photoUrl;
    const pts      = hasPhoto ? 15 : 10;
    const desc     = hasPhoto ? 'Someone navigated to your spot (with photo)' : 'Someone navigated to your spot';
    console.log('[ParkUp] awarding', pts, 'pts to', reporterUid);

    await _awardPoints(reporterUid, pts, 'report', desc);
    console.log('[ParkUp] _awardPoints done ✓');
  } catch(e) {
    console.error('[ParkUp] awardSpotNavigation FAILED:', e.message, e);
  }
}

export async function confirmSpot(spotId, uid) {
  await updateDoc(doc(db, 'street_spots', spotId), {
    confirmCount: increment(1), confirmed: true,
  });
  await _awardPoints(uid, 5, 'confirmed', 'Confirmed a spot');
}

// ══ USERS ══════════════════════════════
export function onUser(uid, cb) {
  return onSnapshot(doc(db, 'users', uid), snap => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() });
  });
}

export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function onAllUsers(cb) {
  return onSnapshot(collection(db, 'users'), snap => {
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cb(users);
  });
}

export async function setUserRole(uid, role, ownedGarageId = null) {
  const data = { role };
  if (ownedGarageId) data.ownedGarageId = ownedGarageId;
  return updateDoc(doc(db, 'users', uid), data);
}

// ══ POINTS ═════════════════════════════
export function onPointsHistory(uid, cb) {
  // Try with orderBy first; fallback if composite index missing
  try {
    const q = query(
      collection(db, 'points_history'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    return onSnapshot(q,
      snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => {
        console.warn('[ParkUp] onPointsHistory index missing, using fallback:', err.message);
        // Fallback: simple where query, sort in JS
        const q2 = query(collection(db, 'points_history'), where('uid', '==', uid));
        return onSnapshot(q2, snap2 => {
          const items = snap2.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => {
              const ta = a.createdAt?.toMillis?.() ?? 0;
              const tb = b.createdAt?.toMillis?.() ?? 0;
              return tb - ta;
            })
            .slice(0, 50);
          cb(items);
        });
      }
    );
  } catch (e) {
    const q2 = query(collection(db, 'points_history'), where('uid', '==', uid));
    return onSnapshot(q2, snap2 => {
      const items = snap2.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
        .slice(0, 50);
      cb(items);
    });
  }
}

export async function getLeaderboard() {
  // Sort by weeklyPoints for weekly ranking
  try {
    const q    = query(collection(db, 'users'), orderBy('weeklyPoints', 'desc'), limit(10));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('[ParkUp] Leaderboard index missing, using fallback:', e.message);
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.weeklyPoints || 0) - (a.weeklyPoints || 0))
      .slice(0, 10);
  }
}

// ── Weekly reset — call this every Sunday or via a scheduled check ──────────
// ── Update weekly ranks without resetting points ──────────
export async function updateWeeklyRanks() {
  try {
    const snap  = await getDocs(collection(db, 'users'));
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                           .sort((a, b) => (b.weeklyPoints || 0) - (a.weeklyPoints || 0));
    await Promise.all(users.map((u, i) =>
      updateDoc(doc(db, 'users', u.id), { weeklyRank: i + 1 })
    ));
  } catch(e) {
    console.warn('[ParkUp] updateWeeklyRanks failed:', e.message);
  }
}

export async function checkAndResetWeeklyPoints() {
  const metaRef   = doc(db, 'meta', 'weeklyReset');
  const metaSnap  = await getDoc(metaRef);
  const now       = new Date();
  const lastReset = metaSnap.exists() ? metaSnap.data().lastReset?.toDate() : null;

  const shouldReset = !lastReset || (now - lastReset) / (1000 * 60 * 60 * 24) >= 7;

  if (!shouldReset) {
    // Rank updates require admin — skip silently on client
    return;
  }

  // Get all users, compute weeklyRank, then reset weeklyPoints
  const snap  = await getDocs(collection(db, 'users'));
  const users = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                         .sort((a, b) => (b.weeklyPoints || 0) - (a.weeklyPoints || 0));

  await Promise.all(users.map((u, i) =>
    updateDoc(doc(db, 'users', u.id), { weeklyRank: i + 1, weeklyPoints: 0 })
  ));

  await setDoc(metaRef, { lastReset: serverTimestamp() }, { merge: true });
  console.log('[ParkUp] Weekly points reset done ✓');
}

export async function redeemReward(uid, cost, rewardName) {
  const snap    = await getDoc(doc(db, 'users', uid));
  const current = snap.data()?.points ?? 0;
  if (current < cost) return false;
  await updateDoc(doc(db, 'users', uid), { weeklyPoints: increment(-cost) }); // deduct from weekly only
  await addDoc(collection(db, 'points_history'), {
    uid, action: 'redeemed', points: -cost,
    description: `Redeemed: ${rewardName}`,
    createdAt: serverTimestamp(),
  });
  return true;
}

async function _awardPoints(uid, pts, action, description) {
  const userRef = doc(db, 'users', uid);

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      await updateDoc(userRef, {
        points:       increment(pts),       // total — never decreases
        weeklyPoints: increment(pts),       // weekly — resets every week
        reportsCount: action === 'report' ? increment(1) : increment(0),
      });
    } else {
      // User doc missing — create it first then award points
      await setDoc(userRef, {
        points:       pts,
        weeklyPoints: pts,
        reportsCount: action === 'report' ? 1 : 0,
        role:         'user',
        level:        'Bronze Spotter',
        weeklyRank:   0,
        createdAt:    serverTimestamp(),
      });
    }
  } catch (e) {
    console.warn('Points update failed:', e.message);
  }

  // Always log to history regardless
  try {
    await addDoc(collection(db, 'points_history'), {
      uid, action, points: pts, description, createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('History log failed:', e.message);
  }
}
// ── Get user's own spots ─────────────────
export async function getUserSpots(uid) {
  try {
    const q = query(
      collection(db, 'street_spots'),
      where('reportedBy', '==', uid),
      orderBy('reportedAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) {
    // Fallback: no orderBy (avoids composite index requirement)
    console.warn('[ParkUp] getUserSpots index missing, using fallback:', e.message);
    const q2   = query(collection(db, 'street_spots'), where('reportedBy', '==', uid));
    const snap = await getDocs(q2);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.reportedAt?.toMillis?.() ?? 0) - (a.reportedAt?.toMillis?.() ?? 0))
      .slice(0, 50);
  }
}

// ── Update notification preference ──────
export async function setNotificationPref(uid, enabled) {
  return updateDoc(doc(db, 'users', uid), { notificationsEnabled: enabled });
}
