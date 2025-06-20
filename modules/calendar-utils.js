// Utility functions for calendar and formatting
export const CalendarUtils = {
  formatDate(date) {
    // YYYY-MM-DD format
    return date.toISOString().slice(0, 10);
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

  getLinkTargetText(linkTarget) {
    switch (linkTarget) {
      case 'new-window': return '(New window)';
      case 'popup': return '(Popup)';
      case 'iframe': return '(Iframe)';
      default: return '(New window)';
    }
  }
};