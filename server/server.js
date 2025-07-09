const express = require("express");
const GameManager = require("./GameManager");
const yaml = require('js-yaml');
const fs = require('fs');

const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
console.log('The server is now running at http://localhost/');
app.use(express.static("public"));

// Load gameplay configuration once at server start
const config = yaml.load(fs.readFileSync('./spec/blueprint-battle.yaml', 'utf8'));

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


