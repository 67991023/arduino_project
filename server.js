const { SerialPort } = require('serialport');
const WebSocket = require('ws');
const express = require('express');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static('public'));

const port = new SerialPort({
  path: '/dev/ttyUSB0',
  baudRate: 115200
});

port.on('data', (data) => {
  const line = data.toString().trim();
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(line);
    }
  });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));   