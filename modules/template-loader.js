// Template loading utility for modular HTML components
export const TemplateLoader = {
  loadedTemplates: new Map(),

  async loadTemplate(templatePath) {
    if (this.loadedTemplates.has(templatePath)) {
      return this.loadedTemplates.get(templatePath);
    }

    try {
      const response = await fetch(templatePath);
      if (!response.ok) {
        throw new Error(`Failed to load template: ${templatePath}`);
      }
      
      const templateContent = await response.text();
      this.loadedTemplates.set(templatePath, templateContent);
      return templateContent;
    } catch (error) {
      console.error('Error loading template:', error);
      return '';
    }
  },

  async injectTemplate(containerId, templatePath) {
    const template = await this.loadTemplate(templatePath);
    const container = document.getElementById(containerId);
    
    if (container && template) {
      container.innerHTML = template;
    }
  },

  async loadAllTemplates() {
    const templatePaths = [
      'templates/modal-templates.html',
      'templates/popup-templates.html',
      'templates/calendar-template.html'
    ];

    // Load all templates in parallel
    await Promise.all(templatePaths.map(path => this.loadTemplate(path)));
  },

  injectTemplatesIntoContainer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Inject all loaded templates
    const modalTemplates = this.loadedTemplates.get('templates/modal-templates.html') || '';
    const popupTemplates = this.loadedTemplates.get('templates/popup-templates.html') || '';
    const calendarTemplate = this.loadedTemplates.get('templates/calendar-template.html') || '';

    // Find the calendar grid placeholder and replace it
    const calendarGridPlaceholder = container.querySelector('#calendar-grid-placeholder');
    if (calendarGridPlaceholder && calendarTemplate) {
      calendarGridPlaceholder.outerHTML = calendarTemplate;
    }

    // Append modals and popups to the container
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalTemplates + popupTemplates;
    
    while (tempDiv.firstChild) {
      container.appendChild(tempDiv.firstChild);
    }
  }
};