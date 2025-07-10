const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

/**
 * Centralized configuration loader for Blueprint Battle
 * Implements singleton pattern to ensure YAML is loaded only once
 */
class ConfigLoader {
  constructor() {
    this.config = null;
    this.isLoaded = false;
    this.configPath = path.join(__dirname, '../spec/blueprint-battle.yaml');
  }

  /**
   * Load and parse the YAML configuration file
   * @returns {Object} The parsed configuration object
   */
  load() {
    if (this.isLoaded) {
      return this.config;
    }

    try {
      // Check if configuration file exists
      if (!fs.existsSync(this.configPath)) {
        throw new Error(`Configuration file not found: ${this.configPath}`);
      }

      // Load and parse YAML file
      const yamlContent = fs.readFileSync(this.configPath, 'utf8');
      this.config = yaml.load(yamlContent);

      // Validate that configuration was parsed successfully
      if (!this.config || typeof this.config !== 'object') {
        throw new Error('Invalid configuration: parsed YAML is not an object');
      }

      // Validate essential configuration sections
      const requiredSections = ['server', 'arena', 'player', 'bullet', 'combat', 'colors'];
      for (const section of requiredSections) {
        if (!this.config[section]) {
          throw new Error(`Missing required configuration section: ${section}`);
        }
      }

      this.isLoaded = true;
      console.log('✓ Configuration loaded successfully from:', this.configPath);
      
      return this.config;
    } catch (error) {
      console.error('✗ Failed to load configuration:', error.message);
      throw error;
    }
  }

  /**
   * Get configuration value by path (dot notation)
   * @param {string} path - Configuration path (e.g., 'server.port', 'arena.tile_size')
   * @returns {*} The configuration value
   */
  get(path) {
    const config = this.load();
    
    if (!path) {
      return config;
    }

    return path.split('.').reduce((obj, key) => {
      return obj && obj[key] !== undefined ? obj[key] : undefined;
    }, config);
  }

  /**
   * Check if configuration is loaded
   * @returns {boolean} True if configuration is loaded
   */
  isConfigLoaded() {
    return this.isLoaded;
  }

  /**
   * Get the full configuration object
   * @returns {Object} The complete configuration object
   */
  getAll() {
    return this.load();
  }

  /**
   * Reload configuration from file (useful for development)
   * @returns {Object} The reloaded configuration object
   */
  reload() {
    this.config = null;
    this.isLoaded = false;
    console.log('♻ Reloading configuration...');
    return this.load();
  }
}

// Create singleton instance
const configLoader = new ConfigLoader();

// Export both the instance and the class
module.exports = configLoader;
module.exports.ConfigLoader = ConfigLoader;