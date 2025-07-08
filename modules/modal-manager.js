// Modal and UI management functionality
export const ModalManager = {
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

  iframeModal: {
    isOpen: false,
    url: ''
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
    this.modal.completed = false;
    this.modal.recurring = { enabled: false, type: 'weekly', interval: 1, unit: 'weeks', endType: 'forever', endDate: '' };
  },

  closeModal() {
    this.modal.isOpen = false;
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
    this.modal.completed = event.completed || false;
    this.modal.recurring = event.recurring || { enabled: false, type: 'weekly', interval: 1, unit: 'weeks', endType: 'forever', endDate: '' };
  },

  deleteEvent() {
    this.deleteConfirmation.isOpen = true;
  },

  cancelDelete() {
    this.deleteConfirmation.isOpen = false;
  },

  openEventLink(event) {
    if (event.link) {
      if (event.linkTarget === 'iframe') {
        this.iframeModal.url = event.link;
        this.iframeModal.isOpen = true;
        // Add class to body to trigger repositioning animation
        document.body.classList.add('iframe-open');
      } else if (event.linkTarget === 'popup') {
        // Calculate center position
        const popupWidth = 1200;
        const popupHeight = 720;
        const left = (screen.width - popupWidth) / 2;
        const top = (screen.height - popupHeight) / 2;
        // Minimal restrictions to allow session sharing
        const popupFeatures = `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no`;
        window.open(event.link, '_blank', popupFeatures);
      } else {
        // Open in new tab with full browser context
        window.open(event.link, '_blank');
      }
    }
  },

  closeIframeModal() {
    this.iframeModal.isOpen = false;
    this.iframeModal.url = '';
    // Remove class from body to reset positioning
    document.body.classList.remove('iframe-open');
  },

  editEvent() {
    this.modal.isViewing = false;
    this.modal.isEditing = true;
  },

  completeTask() {
    if (this.modal.isViewing && this.modal.eventIndex !== null) {
      // Mark only this specific event as completed
      this.events[this.modal.date][this.modal.eventIndex].completed = true;
      this.modal.completed = true;
      this.saveEvents();
      
      // Trigger confetti celebration
      if (window.confetti) {
        window.confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          zIndex: 1001
        });
      }
    }
  }
};