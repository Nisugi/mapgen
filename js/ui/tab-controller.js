// Tab Controller - handles tab navigation
export class TabController {
    constructor() {
        this.tabs = {};
        this.activeTab = 'setup';
    }

    init() {
        // Get all tab buttons and panels
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabPanels = document.querySelectorAll('.tab-panel');
        
        // Store references
        tabButtons.forEach(button => {
            const tabName = button.dataset.tab;
            this.tabs[tabName] = {
                button: button,
                panel: document.getElementById(`${tabName}-tab`)
            };
        });
        
        // Add click handlers
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.switchTab(button.dataset.tab);
            });
        });
        
        // Ensure initial tab is shown
        this.switchTab(this.activeTab);
    }
    
    switchTab(tabName) {
        // Deactivate all tabs
        Object.values(this.tabs).forEach(tab => {
            tab.button.classList.remove('active');
            tab.panel.classList.remove('active');
        });
        
        // Activate selected tab
        if (this.tabs[tabName]) {
            this.tabs[tabName].button.classList.add('active');
            this.tabs[tabName].panel.classList.add('active');
            this.activeTab = tabName;
        }
    }
    
    getCurrentTab() {
        return this.activeTab;
    }
}