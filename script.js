// Main calendar application
import { createApp } from 'petite-vue';
import confetti from 'canvas-confetti';
import { EventManager } from './modules/event-manager.js';
import { ModalManager } from './modules/modal-manager.js';
import { CalendarUtils } from './modules/calendar-utils.js';
import { PointsManager } from './modules/points-manager.js';
import { TemplateLoader } from './modules/template-loader.js';
import { AuthManager } from './modules/auth-manager.js';

// Initialize Firebase and authentication first
await AuthManager.init();

// Set up global reference to AuthManager
window.authManager = AuthManager;

// Store app instance globally
let appInstance = null;
let appReactiveObject = null;

// Initialize templates before creating the app
async function initializeApp() {
  // Load all templates
  await TemplateLoader.loadAllTemplates();
  
  // Create the app instance
  const reactiveObject = {
    ...EventManager,
    ...ModalManager,
    ...CalendarUtils,
    ...PointsManager,
    ...AuthManager,

    // Core calendar state
    STORAGE_KEY: 'minimal-calendar-events',
    currentDate: new Date(),
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    
    // UI state
    summaryOpen: false,
    settingsModal: {
      isOpen: false
    },
    confetti,

    // Notification settings
    notificationSettings: {
      enabled: false,
      permission: 'default',
      lastCheck: null
    },

    // Core computed properties
    get monthYear() {
      return this.currentDate.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
      });
    },

    get calendarDays() {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);
      const lastDayOfPrevMonth = new Date(year, month, 0);

      const days = [];
      const startDayOfWeek = firstDayOfMonth.getDay();

      // Days from previous month
      for (let i = startDayOfWeek; i > 0; i--) {
          const day = lastDayOfPrevMonth.getDate() - i + 1;
          const date = new Date(year, month - 1, day);
          days.push({ day, date: this.formatDate(date), isCurrentMonth: false });
      }

      // Days of current month
      for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
          const date = new Date(year, month, i);
          days.push({
              day: i,
              date: this.formatDate(date),
              isCurrentMonth: true,
              isToday: date.getTime() === today.getTime(),
          });
      }

      // Days from next month
      const gridCells = 42; // 6 rows * 7 columns
      const nextMonthDays = gridCells - days.length;
      for (let i = 1; i <= nextMonthDays; i++) {
          const date = new Date(year, month + 1, i);
          days.push({ day: i, date: this.formatDate(date), isCurrentMonth: false });
      }
      
      return days;
    },

    get upcomingEvents() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcoming = [];

      // Get all events from today forward
      Object.keys(this.events).forEach(dateStr => {
          const eventDate = new Date(dateStr + 'T00:00:00');
          if (eventDate >= today) {
              this.events[dateStr].forEach(event => {
                  upcoming.push({
                      ...event,
                      date: dateStr,
                      sortDate: eventDate
                  });
              });
          }
      });

      // Sort by date and time, limit to next 10 events
      return upcoming
          .sort((a, b) => {
              if (a.sortDate.getTime() !== b.sortDate.getTime()) {
                  return a.sortDate.getTime() - b.sortDate.getTime();
              }
              // If same date, sort by time if available
              if (a.time && b.time) {
                  return a.time.localeCompare(b.time);
              }
              return 0;
          })
          .slice(0, 10);
    },

    // Core navigation methods
    changeMonth(direction) {
      this.currentDate.setMonth(this.currentDate.getMonth() + direction);
      // Create a new date object to trigger reactivity
      this.currentDate = new Date(this.currentDate);
    },

    // Summary and UI methods
    toggleSummary() {
      this.summaryOpen = !this.summaryOpen;
    },

    // Override completeTask to include confetti and points
    completeTask() {
      if (this.modal.isViewing && this.modal.eventIndex !== null) {
        // Mark only this specific event as completed
        this.events[this.modal.date][this.modal.eventIndex].completed = true;
        this.modal.completed = true;
        this.saveEvents();
        
        // Award points and track completion
        this.awardTaskCompletion();
        
        // Trigger confetti celebration
        this.confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          zIndex: 1001
        });
      }
    },

    // Points modal methods
    togglePoints() {
      if (this.pointsModal.isOpen) {
        this.closePointsModal();
      } else {
        this.openPointsModal();
      }
    },

    // Settings modal methods
    toggleSettings() {
      if (this.settingsModal.isOpen) {
        this.closeSettingsModal();
      } else {
        this.openSettingsModal();
      }
    },

    openSettingsModal() {
      this.settingsModal.isOpen = true;
    },

    closeSettingsModal() {
      this.settingsModal.isOpen = false;
    },

    // Notification methods
    async toggleNotifications() {
      if (this.notificationSettings.enabled) {
        if (this.notificationSettings.permission !== 'granted') {
          const permission = await Notification.requestPermission();
          this.notificationSettings.permission = permission;
          
          if (permission !== 'granted') {
            this.notificationSettings.enabled = false;
            alert('Notifications need to be enabled in your browser to receive task reminders.');
            return;
          }
        }
        this.scheduleNotificationCheck();
      } else {
        this.clearNotificationCheck();
      }
      this.saveNotificationSettings();
    },

    scheduleNotificationCheck() {
      this.notificationTimer = setInterval(() => {
        this.checkUpcomingTasks();
      }, 15 * 60 * 1000);
      this.checkUpcomingTasks();
    },

    clearNotificationCheck() {
      if (this.notificationTimer) {
        clearInterval(this.notificationTimer);
        this.notificationTimer = null;
      }
    },

    checkUpcomingTasks() {
      if (!this.notificationSettings.enabled || this.notificationSettings.permission !== 'granted') {
        return;
      }

      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const todayEvents = this.getEventsForDate(today);
      
      todayEvents.forEach(event => {
        if (event.completed || !event.time) return;
        
        const eventDateTime = new Date(event.time);
        const notifyTime = new Date(eventDateTime.getTime() - 30 * 60 * 1000);
        const shouldNotify = now >= notifyTime && now < eventDateTime;
        
        const notificationKey = `notified-${today}-${event.title}-${event.time}`;
        const alreadyNotified = localStorage.getItem(notificationKey);
        
        if (shouldNotify && !alreadyNotified) {
          this.sendTaskNotification(event, eventDateTime);
          localStorage.setItem(notificationKey, 'true');
          this.cleanupOldNotificationFlags();
        }
      });

      if (currentHour === 9 && currentMinute < 15) {
        const todayTasksCount = todayEvents.filter(e => !e.completed).length;
        if (todayTasksCount > 0) {
          const dailyReminderKey = `daily-reminder-${today}`;
          const alreadyReminded = localStorage.getItem(dailyReminderKey);
          
          if (!alreadyReminded) {
            this.sendDailyReminder(todayTasksCount);
            localStorage.setItem(dailyReminderKey, 'true');
          }
        }
      }
    },

    sendTaskNotification(event, eventDateTime) {
      const timeStr = eventDateTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      
      new Notification('Upcoming Task Reminder', {
        body: `"${event.title}" is due at ${timeStr}`,
        icon: '/favicon.ico',
        tag: `task-${event.title}-${event.time}`,
        requireInteraction: false
      });
    },

    sendDailyReminder(taskCount) {
      new Notification('Daily Task Reminder', {
        body: `You have ${taskCount} task${taskCount > 1 ? 's' : ''} scheduled for today`,
        icon: '/favicon.ico',
        tag: 'daily-reminder',
        requireInteraction: false
      });
    },

    cleanupOldNotificationFlags() {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const cutoffDate = sevenDaysAgo.toISOString().slice(0, 10);
      
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('notified-') || key.startsWith('daily-reminder-')) {
          const match = key.match(/\d{4}-\d{2}-\d{2}/);
          if (match && match[0] < cutoffDate) {
            localStorage.removeItem(key);
          }
        }
      });
    },

    loadNotificationSettings() {
      const stored = localStorage.getItem('minimal-calendar-notifications');
      if (stored) {
        this.notificationSettings = { ...this.notificationSettings, ...JSON.parse(stored) };
      }
      
      if ('Notification' in window) {
        this.notificationSettings.permission = Notification.permission;
      }
      
      if (this.notificationSettings.enabled && this.notificationSettings.permission === 'granted') {
        this.scheduleNotificationCheck();
      }
    },

    saveNotificationSettings() {
      localStorage.setItem('minimal-calendar-notifications', JSON.stringify(this.notificationSettings));
    },

    // Export/Import functionality
    exportTasks() {
      const data = {
        events: this.events,
        pointsData: this.pointsData,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };
      
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `calendar-tasks-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },

    importTasks() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            
            // Validate the imported data structure
            if (data.events && typeof data.events === 'object') {
              // Overwrite existing events
              this.events = data.events;
              this.saveEvents();
              
              // Optionally import points data if available
              if (data.pointsData && typeof data.pointsData === 'object') {
                this.pointsData = {
                  totalPoints: data.pointsData.totalPoints || 0,
                  dailyPoints: data.pointsData.dailyPoints || {},
                  streaks: data.pointsData.streaks || { current: 0, longest: 0 },
                  lastActiveDate: data.pointsData.lastActiveDate || null,
                  tasksCreated: data.pointsData.tasksCreated || 0,
                  tasksCompleted: data.pointsData.tasksCompleted || 0
                };
                this.savePointsData();
              }
              
              // Force reactivity update
              this.currentDate = new Date(this.currentDate);
              
              alert('Tasks imported successfully!');
              this.closeSettingsModal();
            } else {
              alert('Invalid file format. Please select a valid calendar export file.');
            }
          } catch (error) {
            alert('Error reading file. Please make sure it\'s a valid JSON file.');
            console.error('Import error:', error);
          }
        };
        reader.readAsText(file);
      };
      
      input.click();
    },

    async initializeUserData() {
      if (this.user) {
        // Wait for user data to load from Firebase
        await this.loadUserData();
        
        // Force reactivity updates
        this.currentDate = new Date(this.currentDate);
        this.$nextTick(() => {
          // Ensure reactive updates for points data
          this.pointsData = { ...this.pointsData };
          this.pointsData.dailyPoints = { ...this.pointsData.dailyPoints };
        });
      }
    },

    mounted() {
      this.loadNotificationSettings();
      this.initializeUserData();
    }
  };

  const app = createApp(reactiveObject);
  
  // Store reference to reactive object for external access
  appReactiveObject = reactiveObject;

  // Inject templates into the DOM before mounting
  TemplateLoader.injectTemplatesIntoContainer('app');
  
  // Mount the app
  app.mount('#app');
  
  // Return the app instance for later use
  return app;
}

// Wait for authentication state to be determined
AuthManager.onAuthStateChanged(async (user) => {
  // Always show the calendar app
  document.getElementById('app').style.display = 'flex';
  
  if (user) {
    // User is signed in, hide the login overlay
    document.getElementById('login-page').style.display = 'none';
    
    // Initialize the app if not already done
    if (!window.appInitialized) {
      appInstance = await initializeApp();
      window.appInitialized = true;
    }
    
    // Initialize user data in the app
    if (appReactiveObject) {
      await appReactiveObject.initializeUserData();
    }
  } else {
    // User is signed out, show the login overlay
    document.getElementById('login-page').style.display = 'flex';
  }
});

// Set up Google Sign-In button
document.getElementById('google-sign-in').addEventListener('click', async () => {
  try {
    await AuthManager.signInWithGoogle();
  } catch (error) {
    console.error('Sign-in failed:', error);
    const errorDiv = document.getElementById('login-error');
    errorDiv.textContent = 'Sign-in failed. Please try again.';
    errorDiv.style.display = 'block';
  }
});