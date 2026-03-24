// js/services/auth.js
import {
  getAuth, signInWithPopup, GoogleAuthProvider,
  signOut, onAuthStateChanged,
  updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { app } from './app.js';

const auth = getAuth(app);
const db   = getFirestore(app);

// ── Google Sign-In ──────────────────────
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const result   = await signInWithPopup(auth, provider);
  await _ensureUserDoc(result.user);
  return result.user;
}

// ── Sign Out ────────────────────────────
export async function logout() {
  await signOut(auth);
  window.location.href = '/pages/login.html';
}

// ── Auth listener ───────────────────────
export function onAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export function currentUser() {
  return auth.currentUser;
}

// ── Create/update user doc (exported) ───────────────
export async function ensureUserDoc(user) {
  const ref  = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      name:         user.displayName ?? 'ParkUp User',
      email:        user.email       ?? '',
      photoUrl:     user.photoURL    ?? null,
      role:         'user',
      points:       0,
      reportsCount: 0,
      weeklyRank:   0,
      level:        'Bronze Spotter',
      createdAt:    serverTimestamp(),
    });
  } else {
    await updateDoc(ref, {
      photoUrl: user.photoURL ?? null,
      lastSeen: serverTimestamp(),
    });
  }
}

// ── Create/update user doc ───────────────
async function _ensureUserDoc(user) {
  return ensureUserDoc(user);
}
// ── Update display name ─────────────────
export async function updateDisplayName(newName) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  await updateProfile(user, { displayName: newName });
  await updateDoc(doc(db, 'users', user.uid), { name: newName });
}

// ── Update password ─────────────────────
export async function changePassword(currentPwd, newPwd) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No email account');
  const cred = EmailAuthProvider.credential(user.email, currentPwd);
  await reauthenticateWithCredential(user, cred);
  await updatePassword(user, newPwd);
}

// ── Check if password-based account ────
export function hasPasswordProvider() {
  const user = auth.currentUser;
  return user?.providerData?.some(p => p.providerId === 'password') ?? false;
}
