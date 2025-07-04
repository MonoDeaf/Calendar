// Firebase authentication and data management
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getDatabase, ref, set, get, onValue, off } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCPPpBlUnWgZdV0G3qJIawAYHmAaawEA4A",
  authDomain: "bcc-calendar-app.firebaseapp.com",
  databaseURL: "https://bcc-calendar-app-default-rtdb.firebaseio.com",
  projectId: "bcc-calendar-app",
  storageBucket: "bcc-calendar-app.firebasestorage.app",
  messagingSenderId: "433360281750",
  appId: "1:433360281750:web:6228cf89d818fb5083a2b7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

export const AuthManager = {
  user: null,
  events: {},
  pointsData: {
    totalPoints: 0,
    dailyPoints: {},
    streaks: { current: 0, longest: 0 },
    lastActiveDate: null,
    tasksCreated: 0,
    tasksCompleted: 0
  },

  async init() {
    // Firebase is initialized above
    return new Promise((resolve) => {
      onAuthStateChanged(auth, (user) => {
        this.user = user;
        if (user) {
          this.loadUserData();
        }
        resolve();
      });
    });
  },

  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      this.user = result.user;
      await this.loadUserData();
      return result.user;
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  },

  async signOut() {
    try {
      await signOut(auth);
      this.user = null;
      this.events = {};
      this.pointsData = {
        totalPoints: 0,
        dailyPoints: {},
        streaks: { current: 0, longest: 0 },
        lastActiveDate: null,
        tasksCreated: 0,
        tasksCompleted: 0
      };
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  },

  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, callback);
  },

  async loadUserData() {
    if (!this.user) return;

    try {
      // Load events
      const eventsRef = ref(database, `users/${this.user.uid}/events`);
      const eventsSnapshot = await get(eventsRef);
      this.events = eventsSnapshot.val() || {};

      // Load points data
      const pointsRef = ref(database, `users/${this.user.uid}/points`);
      const pointsSnapshot = await get(pointsRef);
      if (pointsSnapshot.exists()) {
        this.pointsData = { ...this.pointsData, ...pointsSnapshot.val() };
      }

      // Set up real-time listeners
      this.setupRealtimeListeners();
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  },

  setupRealtimeListeners() {
    if (!this.user) return;

    // Listen for events changes
    const eventsRef = ref(database, `users/${this.user.uid}/events`);
    onValue(eventsRef, (snapshot) => {
      this.events = snapshot.val() || {};
    });

    // Listen for points changes
    const pointsRef = ref(database, `users/${this.user.uid}/points`);
    onValue(pointsRef, (snapshot) => {
      if (snapshot.exists()) {
        this.pointsData = { ...this.pointsData, ...snapshot.val() };
      }
    });
  },

  async saveEvents() {
    if (!this.user) return;

    try {
      const eventsRef = ref(database, `users/${this.user.uid}/events`);
      await set(eventsRef, this.events);
    } catch (error) {
      console.error('Failed to save events:', error);
    }
  },

  async savePointsData() {
    if (!this.user) return;

    try {
      const pointsRef = ref(database, `users/${this.user.uid}/points`);
      await set(pointsRef, this.pointsData);
    } catch (error) {
      console.error('Failed to save points data:', error);
    }
  },

  loadEvents() {
    // This method is called by other modules, but data is loaded via Firebase
    // Keep for compatibility
  },

  loadPointsData() {
    // This method is called by other modules, but data is loaded via Firebase
    // Keep for compatibility
  }
};