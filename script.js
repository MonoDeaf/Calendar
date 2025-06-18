import { createApp } from 'petite-vue';

createApp({
  STORAGE_KEY: 'minimal-calendar-events',
  currentDate: new Date(),
  weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  events: (() => {
    const storedEvents = localStorage.getItem('minimal-calendar-events');
    return storedEvents ? JSON.parse(storedEvents) : {};
  })(),
  modal: {
    isOpen: false,
    date: null,
    title: '',
    description: '',
    time: '',
    link: '',
    linkTarget: 'new-window',
    isEditing: false,
    isViewing: false,
    eventIndex: null,
    recurring: {
      enabled: false,
      type: 'weekly',
      interval: 1,
      unit: 'weeks',
      endType: 'forever',
      endDate: ''
    }
  },
  summaryOpen: false,

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

  mounted() {
    this.loadEvents();
  },

  loadEvents() {
    const storedEvents = localStorage.getItem(this.STORAGE_KEY);
    this.events = storedEvents ? JSON.parse(storedEvents) : {};
  },

  saveEvents() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.events));
  },
  
  formatDate(date) {
      // YYYY-MM-DD format
      return date.toISOString().slice(0, 10);
  },

  changeMonth(direction) {
    this.currentDate.setMonth(this.currentDate.getMonth() + direction);
    // Create a new date object to trigger reactivity
    this.currentDate = new Date(this.currentDate);
  },

  formatTime(timeStr) {
    if (!timeStr) return '';
    
    // Handle datetime-local format (YYYY-MM-DDTHH:MM)
    if (timeStr.includes('T')) {
      const dateTime = new Date(timeStr);
      const date = dateTime.toLocaleDateString();
      const time = dateTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return `${date} ${time}`;
    }
    
    // Fallback for old time-only format (HH:MM)
    const [hour, minute] = timeStr.split(':');
    const h = parseInt(hour, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minute} ${ampm}`;
  },

  viewEvent(dateStr, eventIndex) {
    const event = this.events[dateStr][eventIndex];
    this.modal.isOpen = true;
    this.modal.isViewing = true;
    this.modal.isEditing = false;
    this.modal.date = dateStr;
    this.modal.eventIndex = eventIndex;
    this.modal.title = event.title;
    this.modal.description = event.description;
    this.modal.time = event.time;
    this.modal.link = event.link || '';
    this.modal.linkTarget = event.linkTarget || 'new-window';
    this.modal.recurring = event.recurring || { enabled: false, type: 'weekly', interval: 1, unit: 'weeks', endType: 'forever', endDate: '' };
  },

  openModal(dateStr) {
    this.modal.isOpen = true;
    this.modal.isViewing = false;
    this.modal.isEditing = false;
    this.modal.date = dateStr;
    this.modal.eventIndex = null;
    this.modal.title = '';
    this.modal.description = '';
    this.modal.time = '';
    this.modal.link = '';
    this.modal.linkTarget = 'new-window';
    this.modal.recurring = { enabled: false, type: 'weekly', interval: 1, unit: 'weeks', endType: 'forever', endDate: '' };
  },

  closeModal() {
    this.modal.isOpen = false;
  },

  saveEvent() {
    if (!this.modal.title.trim()) {
        alert('Event title is required.');
        return;
    }
    
    if (!this.events[this.modal.date]) {
        this.events[this.modal.date] = [];
    }
    
    const eventData = {
        title: this.modal.title.trim(),
        description: this.modal.description.trim(),
        time: this.modal.time,
        link: this.modal.link.trim(),
        linkTarget: this.modal.linkTarget,
        recurring: this.modal.recurring.enabled ? { ...this.modal.recurring } : null
    };

    if(this.modal.isEditing) {
        this.events[this.modal.date][0] = eventData;
    } else {
        this.events[this.modal.date].push(eventData);
        
        // Generate recurring events if enabled
        if (this.modal.recurring.enabled) {
            this.generateRecurringEvents(eventData, this.modal.date);
        }
    }
    
    this.saveEvents();
    this.closeModal();
  },

  generateRecurringEvents(eventData, startDate) {
    const start = new Date(startDate + 'T00:00:00');
    const endDate = this.modal.recurring.endType === 'until' && this.modal.recurring.endDate 
      ? new Date(this.modal.recurring.endDate + 'T00:00:00')
      : new Date(start.getTime() + (365 * 24 * 60 * 60 * 1000)); // Default to 1 year if forever

    let current = new Date(start);
    let interval = this.modal.recurring.interval || 1;
    
    // Determine increment based on type
    const getIncrement = () => {
      switch (this.modal.recurring.type) {
        case 'daily': return { days: interval };
        case 'weekly': return { days: interval * 7 };
        case 'bi-weekly': return { days: 14 };
        case 'monthly': return { months: interval };
        case 'custom':
          if (this.modal.recurring.unit === 'days') return { days: interval };
          if (this.modal.recurring.unit === 'weeks') return { days: interval * 7 };
          if (this.modal.recurring.unit === 'months') return { months: interval };
          break;
        default: return { days: 7 };
      }
    };

    const increment = getIncrement();
    
    // Generate recurring events (limit to 100 to prevent infinite loops)
    let count = 0;
    while (current <= endDate && count < 100) {
      // Move to next occurrence
      if (increment.days) {
        current.setDate(current.getDate() + increment.days);
      } else if (increment.months) {
        current.setMonth(current.getMonth() + increment.months);
      }
      
      if (current <= endDate) {
        const dateStr = this.formatDate(current);
        if (!this.events[dateStr]) {
          this.events[dateStr] = [];
        }
        this.events[dateStr].push({ ...eventData });
      }
      
      count++;
    }
  },

  getRecurringText(recurring) {
    if (!recurring || !recurring.enabled) return '';
    
    let text = '';
    switch (recurring.type) {
      case 'daily': text = 'Daily'; break;
      case 'weekly': text = 'Weekly'; break;
      case 'bi-weekly': text = 'Bi-weekly'; break;
      case 'monthly': text = 'Monthly'; break;
      case 'custom':
        const unit = recurring.unit === 'days' ? 'day' : recurring.unit === 'weeks' ? 'week' : 'month';
        text = `Every ${recurring.interval} ${unit}${recurring.interval > 1 ? 's' : ''}`;
        break;
    }
    
    if (recurring.endType === 'until' && recurring.endDate) {
      text += ` until ${new Date(recurring.endDate).toLocaleDateString()}`;
    } else {
      text += ', forever';
    }
    
    return text;
  },

  deleteEvent() {
    if (confirm('Are you sure you want to delete this event?')) {
        if (this.modal.isViewing && this.modal.eventIndex !== null) {
            const eventToDelete = this.events[this.modal.date][this.modal.eventIndex];
            
            // Check if this is a recurring event
            if (eventToDelete.recurring && eventToDelete.recurring.enabled) {
                // Delete all future recurring instances
                const currentDate = new Date(this.modal.date + 'T00:00:00');
                
                // Iterate through all dates and remove matching recurring events
                Object.keys(this.events).forEach(dateStr => {
                    const eventDate = new Date(dateStr + 'T00:00:00');
                    
                    // Only delete events on or after the current date
                    if (eventDate >= currentDate) {
                        this.events[dateStr] = this.events[dateStr].filter(event => {
                            // Keep events that don't match the recurring event pattern
                            return !(event.recurring && 
                                   event.recurring.enabled &&
                                   event.title === eventToDelete.title &&
                                   event.description === eventToDelete.description &&
                                   JSON.stringify(event.recurring) === JSON.stringify(eventToDelete.recurring));
                        });
                        
                        // Clean up empty date arrays
                        if (this.events[dateStr].length === 0) {
                            delete this.events[dateStr];
                        }
                    }
                });
            } else {
                // Non-recurring event - delete only this instance
                this.events[this.modal.date].splice(this.modal.eventIndex, 1);
                // Clean up empty date arrays
                if (this.events[this.modal.date].length === 0) {
                    delete this.events[this.modal.date];
                }
            }
        } else {
            // Legacy behavior for editing mode
            delete this.events[this.modal.date];
        }
        this.saveEvents();
        this.closeModal();
    }
  },

  openEventLink(event) {
    if (event.link) {
      if (event.linkTarget === 'popup') {
        window.open(event.link, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
      } else {
        window.open(event.link, '_blank', 'noopener,noreferrer');
      }
    }
  },

  getEventsForDate(dateStr) {
      return this.events[dateStr] || [];
  },

  toggleSummary() {
    this.summaryOpen = !this.summaryOpen;
  },

  formatSummaryDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.getTime() === today.getTime()) {
        return 'Today';
    } else if (date.getTime() === tomorrow.getTime()) {
        return 'Tomorrow';
    } else {
        return date.toLocaleDateString(undefined, { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
    }
  }

}).mount('#app');