// Points system management
export const PointsManager = {
  POINTS_STORAGE_KEY: 'minimal-calendar-points',
  
  get pointsData() {
    // Get points data from AuthManager instead of local storage
    return window.authManager?.pointsData || {
      totalPoints: 0,
      dailyPoints: {},
      streaks: { current: 0, longest: 0 },
      lastActiveDate: null,
      tasksCreated: 0,
      tasksCompleted: 0
    };
  },

  set pointsData(value) {
    // Set points data through AuthManager
    if (window.authManager) {
      window.authManager.pointsData = value;
    }
  },

  pointsModal: {
    isOpen: false
  },

  pointsIndicator: {
    visible: false,
    timeout: null
  },

  loadPointsData() {
    // Points data is loaded via Firebase in AuthManager
    // Keep for compatibility
  },

  savePointsData() {
    // Save points data through AuthManager to Firebase
    if (window.authManager) {
      window.authManager.savePointsData();
    }
  },

  getTodayString() {
    return new Date().toISOString().slice(0, 10);
  },

  awardPoints(points = 10) {
    const today = this.getTodayString();
    
    // Add to total points
    this.pointsData.totalPoints += points;
    
    // Add to daily points
    if (!this.pointsData.dailyPoints[today]) {
      this.pointsData.dailyPoints[today] = 0;
    }
    this.pointsData.dailyPoints[today] += points;
    
    // Update last active date and streak
    this.pointsData.lastActiveDate = today;
    this.updateDailyStreak();
    
    // Show indicator dot
    this.showPointsIndicator();
    
    this.savePointsData();
  },

  showPointsIndicator() {
    this.pointsIndicator.visible = true;
    
    // Clear existing timeout - dot should stay until modal is opened
    if (this.pointsIndicator.timeout) {
      clearTimeout(this.pointsIndicator.timeout);
      this.pointsIndicator.timeout = null;
    }
  },

  updateDailyStreak() {
    const today = this.getTodayString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toISOString().slice(0, 10);

    if (this.pointsData.lastActiveDate === today) {
      // Active today, check if we were active yesterday to continue streak
      if (this.pointsData.dailyPoints[yesterdayString] > 0) {
        // Continue streak
        this.pointsData.streaks.current++;
      } else {
        // Start new streak
        this.pointsData.streaks.current = 1;
      }
    } else if (this.pointsData.lastActiveDate === yesterdayString) {
      // Was active yesterday but not today, streak continues but don't increment
    } else {
      // Streak broken
      this.pointsData.streaks.current = 0;
    }

    // Update longest streak
    if (this.pointsData.streaks.current > this.pointsData.streaks.longest) {
      this.pointsData.streaks.longest = this.pointsData.streaks.current;
    }
  },

  getTodayPoints() {
    const today = this.getTodayString();
    return this.pointsData.dailyPoints[today] || 0;
  },

  getWeeklyPoints() {
    const today = new Date();
    let weeklyTotal = 0;
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().slice(0, 10);
      weeklyTotal += this.pointsData.dailyPoints[dateString] || 0;
    }
    
    return weeklyTotal;
  },

  getRecentDays() {
    const days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().slice(0, 10);
      const points = this.pointsData.dailyPoints[dateString] || 0;
      
      days.push({
        date: dateString,
        points,
        dayName: d.toLocaleDateString(undefined, { weekday: 'short' }),
        isToday: i === 0
      });
    }
    
    return days;
  },

  openPointsModal() {
    this.pointsModal.isOpen = true;
    // Hide indicator when modal is opened
    this.pointsIndicator.visible = false;
    if (this.pointsIndicator.timeout) {
      clearTimeout(this.pointsIndicator.timeout);
      this.pointsIndicator.timeout = null;
    }
  },

  closePointsModal() {
    this.pointsModal.isOpen = false;
  },

  awardTaskCreation() {
    this.pointsData.tasksCreated++;
    this.awardPoints(5);
  },

  awardTaskCompletion() {
    this.pointsData.tasksCompleted++;
    this.awardPoints(10);
  }
};

// Immediately load persistent points data on module import
PointsManager.loadPointsData();