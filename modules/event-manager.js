// Event management functionality
export const EventManager = {
  STORAGE_KEY: 'minimal-calendar-events',
  events: {},
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
    completed: false,
    recurring: {
      enabled: false,
      type: 'weekly',
      interval: 1,
      unit: 'weeks',
      endType: 'forever',
      endDate: ''
    }
  },
  deleteConfirmation: {
    isOpen: false
  },

  loadEvents() {
    const storedEvents = localStorage.getItem(this.STORAGE_KEY);
    this.events = storedEvents ? JSON.parse(storedEvents) : {};
  },

  saveEvents() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.events));
  },

  getEventsForDate(dateStr) {
    return this.events[dateStr] || [];
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
        // Don't mark future recurring events as completed
        const recurringEventData = { ...eventData, completed: false };
        this.events[dateStr].push(recurringEventData);
      }
      
      count++;
    }
  },

  completeTask() {
    if (this.modal.isViewing && this.modal.eventIndex !== null) {
      // Mark only this specific event as completed
      this.events[this.modal.date][this.modal.eventIndex].completed = true;
      this.modal.completed = true;
      this.saveEvents();
    }
  },

  confirmDelete() {
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
    this.deleteConfirmation.isOpen = false;
    this.closeModal();
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
        completed: this.modal.completed || false,
        recurring: this.modal.recurring.enabled ? { ...this.modal.recurring } : null
    };

    if(this.modal.isEditing) {
        this.events[this.modal.date][0] = eventData;
    } else {
        this.events[this.modal.date].push(eventData);
        
        // Award points for creating a new task
        if (this.awardTaskCreation) {
            this.awardTaskCreation();
        }
        
        // Generate recurring events if enabled
        if (this.modal.recurring.enabled) {
            this.generateRecurringEvents(eventData, this.modal.date);
        }
    }
    
    this.saveEvents();
    this.closeModal();
  },

  formatDate(date) {
    return date.toISOString().slice(0, 10);
  },

  closeModal() {
    this.modal.isOpen = false;
  }
};