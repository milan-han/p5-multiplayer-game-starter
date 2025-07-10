const express = require("express");
const GameManager = require("./GameManager");
const configLoader = require("../shared/ConfigLoader");
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
console.log('The server is now running at http://localhost/');
app.use(express.static("public"));

// Load gameplay configuration once at server start
const config = configLoader.getAll();

// Ensure CSS variables are up to date
function ensureCSSUpToDate() {
  const yamlPath = path.join(__dirname, '../spec/blueprint-battle.yaml');
  const cssPath = path.join(__dirname, '../public/style-vars.css');
  
  try {
    // Check if CSS file exists
    if (!fs.existsSync(cssPath)) {
      console.log('⚠️  CSS variables file not found. Generating...');
      execSync('node build-css-vars.js', { cwd: path.join(__dirname, '..') });
      console.log('✅ CSS variables generated successfully');
      return;
    }
    
    // Check if YAML is newer than CSS
    const yamlStats = fs.statSync(yamlPath);
    const cssStats = fs.statSync(cssPath);
    
    if (yamlStats.mtime > cssStats.mtime) {
      console.log('⚠️  YAML configuration is newer than CSS. Rebuilding...');
      execSync('node build-css-vars.js', { cwd: path.join(__dirname, '..') });
      console.log('✅ CSS variables updated successfully');
    } else {
      console.log('✅ CSS variables are up to date');
    }
  } catch (error) {
    console.error('❌ Failed to ensure CSS is up to date:', error.message);
    console.log('💡 Run "npm run build:css" manually to generate CSS variables');
  }
}

// Ensure CSS is up to date before starting
ensureCSSUpToDate();

// Initialize GameManager with Socket.IO instance
const gameManager = new GameManager(io);

// Expose configuration to clients so they can stay in sync
app.get('/config', (req, res) => {
  res.json(config);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  gameManager.shutdown();
  server.close();
});

process.on('SIGINT', () => {
  console.log('Shutting down server...');
  gameManager.shutdown();
  server.close();
});

server.listen(config.server.port, () => {
  console.log(`Server is running on port ${config.server.port}`);
});


