//server.js           → จัดการ HTTP Server, WebSocket, Routes
//├── serialHandler.js    → จัดการ Serial Port, Parse ข้อมูล

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const SerialHandler = require('./serialHandler');

const app = express();
app.use(cors());
app.use(express.static('../frontend'));

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// สร้าง Serial Handler
const serialHandler = new SerialHandler({
  portName: process.env.SERIAL_PORT || null, // null = auto-detect
  baudRate: 9600,
  autoReconnect: true,
  reconnectDelay: 3000
});

// Event: เมื่อเชื่อมต่อสำเร็จ
serialHandler.on('connected', (info) => {
  console.log('✅ Serial connected:', info.port);
  io.emit('serialStatus', {
    port: info.port,
    isOpen: true,
    status: 'connected'
  });
});

// Event: เมื่อได้รับข้อมูล
serialHandler.on('data', (sensorData) => {
  console.log('📊 Sensor data:', sensorData);
  io.emit('sensorData', sensorData);
});

// Event: เมื่อเกิด Error
serialHandler.on('error', (err) => {
  console.error('❌ Serial error:', err.message);
  io.emit('serialStatus', {
    port: serialHandler.portName,
    isOpen: false,
    status: 'error',
    error: err.message
  });
});

// Event: เมื่อถูก Disconnect
serialHandler.on('disconnected', () => {
  console.log('🔌 Serial disconnected');
  io.emit('serialStatus', {
    port: serialHandler.portName,
    isOpen: false,
    status: 'disconnected'
  });
});

// เริ่มเชื่อมต่อ Serial Port
serialHandler.connect();

// WebSocket Connection
io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);
  
  // ส่งสถานะ Serial Port ไปให้ Client
  socket.emit('serialStatus', serialHandler.getStatus());
  
  // รับคำสั่งจาก Client (ถ้าต้องการส่งข้อมูลไป Arduino)
  socket.on('sendCommand', (command) => {
    console.log('📥 Command from client:', command);
    serialHandler.write(command);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// HTTP Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/../frontend/index.html');
});

app.get('/api/status', (req, res) => {
  res.json(serialHandler.getStatus());
});

app.get('/api/ports', async (req, res) => {
  try {
    const { SerialPort } = require('serialport');
    const ports = await SerialPort.list();
    res.json(ports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await serialHandler.disconnect();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

const SERVER_PORT = 3000;
server.listen(SERVER_PORT, () => {
  console.log(`🚀 Server running on http://localhost:${SERVER_PORT}`);
  console.log(`🐧 Platform: ${process.platform}`);
});