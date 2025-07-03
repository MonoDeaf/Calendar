// Main calendar application
import { createApp } from 'petite-vue';
import confetti from 'canvas-confetti';
import { EventManager } from './modules/event-manager.js';
import { ModalManager } from './modules/modal-manager.js';
import { CalendarUtils } from './modules/calendar-utils.js';
import { PointsManager } from './modules/points-manager.js';
import { TemplateLoader } from './modules/template-loader.js';

// Initialize templates before creating the app
async function initializeApp() {
  // Load all templates
  await TemplateLoader.loadAllTemplates();
  
  // Create the app instance
  const app = createApp({
    ...EventManager,
    ...ModalManager,
    ...CalendarUtils,
    ...PointsManager,

    // Core calendar state
    STORAGE_KEY: 'minimal-calendar-events',
    currentDate: new Date(),
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    events: (() => {
      const storedEvents = localStorage.getItem('minimal-calendar-events');
      return storedEvents ? JSON.parse(storedEvents) : {};
    })(),
    
    // UI state
    summaryOpen: false,
    settingsModal: {
      isOpen: false
    },
    crumbVisible: (() => {
      // Reset the localStorage to make crumb appear again
      localStorage.removeItem('crumb-dismissed');
      return true;
    })(),
    confetti,

    // Notification settings
    notificationSettings: {
      enabled: false,
      permission: 'default', // 'default', 'granted', 'denied'
      isChecking: false // To prevent race conditions
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

    // A computed property to determine if the warning should be shown
    get showNotificationWarning() {
      // Show warning if permission is denied, and the user is trying to enable notifications.
      return this.notificationSettings.permission === 'denied';
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

    closeCrumb() {
      this.crumbVisible = false;
      localStorage.setItem('crumb-dismissed', 'true');
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
      // Prevent multiple requests at once
      if (this.notificationSettings.isChecking) return;
      this.notificationSettings.isChecking = true;

      try {
        if (this.notificationSettings.enabled) {
          // If user is trying to enable notifications
          const permission = await Notification.requestPermission();
          this.notificationSettings.permission = permission;

          if (permission === 'granted') {
            this.scheduleNotificationCheck();
          } else {
            // Permission denied or dismissed, uncheck the box
            this.notificationSettings.enabled = false;
            this.clearNotificationCheck();
            if (permission === 'denied') {
               alert('Notifications were blocked. To enable them, you will need to go into your browser\'s site settings for this page.');
            }
          }
        } else {
          // If user is disabling notifications
          this.clearNotificationCheck();
        }
        this.saveNotificationSettings();
      } catch (error) {
        console.error("Error handling notification permissions:", error);
        // Reset state on error
        this.notificationSettings.enabled = false;
        this.clearNotificationCheck();
      } finally {
        this.notificationSettings.isChecking = false;
      }
    },

    scheduleNotificationCheck() {
      this.clearNotificationCheck(); // Ensure no multiple timers
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
        const storedSettings = JSON.parse(stored);
        this.notificationSettings.enabled = storedSettings.enabled || false;
      }
      
      // Always check current live permission status on load
      if ('Notification' in window) {
        this.notificationSettings.permission = Notification.permission;
      } else {
        this.notificationSettings.permission = 'denied';
      }
      
      // If permission is already denied, ensure the toggle is off.
      if (this.notificationSettings.permission === 'denied') {
        this.notificationSettings.enabled = false;
      }
      
      // Auto-enable if permission is already granted and was previously enabled
      if (this.notificationSettings.enabled && this.notificationSettings.permission === 'granted') {
        this.scheduleNotificationCheck();
      }
    },

    saveNotificationSettings() {
      // Only save the enabled state, not permission (always check live)
      localStorage.setItem('minimal-calendar-notifications', JSON.stringify({
        enabled: this.notificationSettings.enabled
      }));
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

    mounted() {
      this.loadEvents();
      this.loadPointsData();
      this.loadNotificationSettings();
      this.$nextTick(() => {
        this.pointsData = { ...this.pointsData };
        this.pointsData.dailyPoints = { ...this.pointsData.dailyPoints };
      });
    }
  });

  // Inject templates into the DOM before mounting
  TemplateLoader.injectTemplatesIntoContainer('app');
  
  // Mount the app
  app.mount('#app');
}

// Initialize the application
initializeApp().catch(console.error);