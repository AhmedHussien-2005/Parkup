// js/services/app.js
// Single Firebase app instance — imported by all services
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { firebaseConfig } from './firebase.js';

export const app = initializeApp(firebaseConfig);
