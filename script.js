// Main calendar application
import { createApp } from 'petite-vue';
import confetti from 'canvas-confetti';
import { EventManager } from './modules/event-manager.js';
import { ModalManager } from './modules/modal-manager.js';
import { CalendarUtils } from './modules/calendar-utils.js';
import { PointsManager } from './modules/points-manager.js';

createApp({
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
  crumbVisible: (() => {
    // Reset the localStorage to make crumb appear again
    localStorage.removeItem('crumb-dismissed');
    return true;
  })(),
  confetti,

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

  mounted() {
    this.loadEvents();
    this.loadPointsData();
    // Ensure points data is properly reactive by updating the component state
    this.$nextTick(() => {
      // Force reactivity update for points data
      this.pointsData = { ...this.pointsData };
      // also re-wrap dailyPoints so nested daily values stay reactive
      this.pointsData.dailyPoints = { ...this.pointsData.dailyPoints };
    });
  }

}).mount('#app');