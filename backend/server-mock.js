const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

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

console.log('🧪 Mock Server Mode - Generating fake data');

// ฟังก์ชันสุ่มข้อมูล
function generateMockData() {
  return {
    toucher: Math.random() > 0.7 ? 1 : 0, // 30% โอกาสที่จะสัมผัส
    voltage: 3.0 + Math.random() * 2.0,  // สุ่มระหว่าง 3.0-5.0V
    timestamp: Date.now()
  };
}

// WebSocket Connection
io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);
  
  socket.emit('serialStatus', {
    port: 'MOCK',
    isOpen: true
  });
  
  // ส่งข้อมูลปลอมทุก 500ms
  const interval = setInterval(() => {
    const mockData = generateMockData();
    console.log('📊 Mock data:', mockData);
    socket.emit('sensorData', mockData);
  }, 500);
  
  socket.on('disconnect', () => {
    clearInterval(interval);
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// HTTP Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/../frontend/index.html');
});

app.get('/api/status', (req, res) => {
  res.json({
    serialPort: 'MOCK',
    isOpen: true,
    mode: 'mock'
  });
});

const SERVER_PORT = 3000;
server.listen(SERVER_PORT, () => {
  console.log(`🚀 Mock Server running on http://localhost:${SERVER_PORT}`);
  console.log(`🧪 Generating fake sensor data every 500ms`);
});