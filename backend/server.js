const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
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

// 🔌 USB Serial Port (ไม��ใช่ Bluetooth)
const PORT_NAME = process.env.SERIAL_PORT || '/dev/ttyUSB0'; // เปลี่ยนตาม port ของคุณ
const BAUD_RATE = 115200; // ต้องตรงกับ Arduino (115200)

let serialPort;
let parser;

// ฟังก์ชันหา Serial Port อัตโนมัติ
async function findSerialPort() {
  try {
    const ports = await SerialPort.list();
    console.log('🔍 Available Serial Ports:');
    ports.forEach(port => {
      console.log(`  - ${port.path}${port.manufacturer ? ` (${port.manufacturer})` : ''}`);
    });

    // หา ESP32 port
    const esp32Port = ports.find(port => 
      port.path.includes('ttyUSB') || 
      port.path.includes('ttyACM') ||
      (port.manufacturer && (
        port.manufacturer.toLowerCase().includes('silicon labs') ||
        port.manufacturer.toLowerCase().includes('ch340') ||
        port.manufacturer.toLowerCase().includes('cp210')
      ))
    );

    if (esp32Port) {
      console.log(`✅ Found ESP32 at: ${esp32Port.path}`);
      return esp32Port.path;
    } else {
      console.log('⚠️ ESP32 not found. Using default:', PORT_NAME);
      return PORT_NAME;
    }
  } catch (err) {
    console.error('❌ Error listing ports:', err.message);
    return PORT_NAME;
  }
}

// เริ่มต้น Serial Port
async function initSerialPort() {
  try {
    const portName = await findSerialPort();

    serialPort = new SerialPort({
      path: portName,
      baudRate: BAUD_RATE
    });

    parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

    serialPort.on('open', () => {
      console.log(`✅ Serial Port ${portName} opened successfully`);
    });

    serialPort.on('error', (err) => {
      console.error('❌ Serial Port Error:', err.message);
      console.log('💡 Tips:');
      console.log('   1. Check if ESP32 is connected: ls /dev/ttyUSB* /dev/ttyACM*');
      console.log('   2. Set permission: sudo chmod 666 /dev/ttyUSB0');
      console.log('   3. Add user to dialout group: sudo usermod -a -G dialout $USER');
    });

    // อ่านข้อมูลจาก ESP32
    parser.on('data', (data) => {
      console.log('📡 Raw data:', data);
      
      // Parse ข้อมูล: "toucher: 1, voltage: 3.45"
      const toucherMatch = data.match(/toucher:\s*(\d+)/);
      const voltageMatch = data.match(/voltage:\s*([\d.]+)/);
      
      if (toucherMatch && voltageMatch) {
        const sensorData = {
          toucher: parseInt(toucherMatch[1]),
          voltage: parseFloat(voltageMatch[1]),
          timestamp: Date.now()
        };
        
        console.log('📊 Parsed data:', sensorData);
        
        // ส่งข้อมูลไปยัง Frontend ผ่าน WebSocket
        io.emit('sensorData', sensorData);
      }
    });

  } catch (err) {
    console.error('❌ Failed to initialize serial port:', err.message);
  }
}

// เริ่มต้น Serial Port
initSerialPort();

// WebSocket Connection
io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// HTTP Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/../frontend/index.html');
});

app.get('/api/status', (req, res) => {
  res.json({
    serialPort: PORT_NAME,
    isOpen: serialPort ? serialPort.isOpen : false,
    platform: process.platform
  });
});

app.get('/api/ports', async (req, res) => {
  try {
    const ports = await SerialPort.list();
    res.json(ports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const SERVER_PORT = 3000;
server.listen(SERVER_PORT, () => {
  console.log(`🚀 Server running on http://localhost:${SERVER_PORT}`);
  console.log(`🔌 Using USB Serial (not Bluetooth)`);
});