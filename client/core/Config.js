// =================================================================================
// CLIENT CONFIGURATION LOADER - Blueprint Battle
// =================================================================================

export class Config {
    constructor() {
        this.config = null;
        this.isLoaded = false;
        this.loadPromise = null;
    }
    
    // Load configuration from server
    async load() {
        if (this.isLoaded) {
            return this.config;
        }
        
        // If already loading, return the existing promise
        if (this.loadPromise) {
            return this.loadPromise;
        }
        
        this.loadPromise = this._fetchConfig();
        return this.loadPromise;
    }
    
    async _fetchConfig() {
        try {
            const response = await fetch('/config');
            
            if (!response.ok) {
                throw new Error(`Failed to load configuration: ${response.status} ${response.statusText}`);
            }
            
            this.config = await response.json();
            
            // Validate essential configuration sections
            const requiredSections = ['server', 'arena', 'player', 'bullet', 'combat', 'colors', 'ui'];
            for (const section of requiredSections) {
                if (!this.config[section]) {
                    throw new Error(`Missing required configuration section: ${section}`);
                }
            }
            
            this.isLoaded = true;
            console.log('✓ Client configuration loaded successfully');
            
            return this.config;
        } catch (error) {
            console.error('✗ Failed to load client configuration:', error.message);
            throw error;
        }
    }
    
    // Get configuration value by path (dot notation)
    get(path) {
        if (!this.isLoaded) {
            console.warn('Configuration not loaded yet. Use await config.load() first.');
            return undefined;
        }
        
        if (!path) {
            return this.config;
        }
        
        return path.split('.').reduce((obj, key) => {
            return obj && obj[key] !== undefined ? obj[key] : undefined;
        }, this.config);
    }
    
    // Get the full configuration object
    getAll() {
        if (!this.isLoaded) {
            console.warn('Configuration not loaded yet. Use await config.load() first.');
            return null;
        }
        
        return this.config;
    }
    
    // Check if configuration is loaded
    isConfigLoaded() {
        return this.isLoaded;
    }
    
    // Wait for configuration to be loaded
    async waitForLoad() {
        if (this.isLoaded) {
            return this.config;
        }
        
        return this.load();
    }
}

// Create and export singleton instance
export const config = new Config();