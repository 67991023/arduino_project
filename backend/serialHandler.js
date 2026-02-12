const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const EventEmitter = require('events');

class SerialHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.portName = options.portName || null;
    this.baudRate = options.baudRate || 9600;
    this.serialPort = null;
    this.parser = null;
    this.isConnected = false;
    this.autoReconnect = options.autoReconnect || true;
    this.reconnectDelay = options.reconnectDelay || 3000;
  }

  /**
   * หา Arduino Port อัตโนมัติ
   */
  async findArduinoPort() {
    try {
      const ports = await SerialPort.list();
      console.log('🔍 Scanning for Serial Ports...');
      
      ports.forEach(port => {
        console.log(`  - ${port.path}${port.manufacturer ? ` (${port.manufacturer})` : ''}`);
      });

      // หา Arduino port
      const arduinoPort = ports.find(port => 
        port.path.includes('ttyACM') || 
        port.path.includes('ttyUSB') ||
        (port.manufacturer && (
          port.manufacturer.toLowerCase().includes('arduino') ||
          port.manufacturer.toLowerCase().includes('ch340') ||
          port.manufacturer.toLowerCase().includes('ftdi')
        ))
      );

      if (arduinoPort) {
        console.log(`✅ Found Arduino at: ${arduinoPort.path}`);
        return arduinoPort.path;
      } else {
        console.log('⚠️ Arduino not found');
        return null;
      }
    } catch (err) {
      console.error('❌ Error scanning ports:', err.message);
      return null;
    }
  }

  /**
   * เชื่อมต่อ Serial Port
   */
  async connect() {
    try {
      // ถ้าไม่ระบุ port ให้หาอัตโนมัติ
      if (!this.portName) {
        this.portName = await this.findArduinoPort();
        
        if (!this.portName) {
          throw new Error('No Arduino port found. Please check connection.');
        }
      }

      // สร้าง Serial Port
      this.serialPort = new SerialPort({
        path: this.portName,
        baudRate: this.baudRate,
        autoOpen: false
      });

      // เปิด Serial Port
      await this.openPort();
      
      // Setup Parser
      this.parser = this.serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));
      
      // Setup Event Handlers
      this.setupEventHandlers();
      
      this.isConnected = true;
      this.emit('connected', { port: this.portName });
      
      return true;
      
    } catch (err) {
      console.error('❌ Connection failed:', err.message);
      this.emit('error', err);
      
      if (this.autoReconnect) {
        this.scheduleReconnect();
      }
      
      return false;
    }
  }

  /**
   * เปิด Serial Port (Promise wrapper)
   */
  openPort() {
    return new Promise((resolve, reject) => {
      this.serialPort.open((err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`✅ Serial Port ${this.portName} opened successfully`);
          resolve();
        }
      });
    });
  }

  /**
   * Setup Event Handlers
   */
  setupEventHandlers() {
    // เมื่อได้รับข้อมูล
    this.parser.on('data', (data) => {
      const parsed = this.parseData(data);
      if (parsed) {
        this.emit('data', parsed);
      }
    });

    // เมื่อเกิด Error
    this.serialPort.on('error', (err) => {
      console.error('❌ Serial Port Error:', err.message);
      this.isConnected = false;
      this.emit('error', err);
      
      if (this.autoReconnect) {
        this.scheduleReconnect();
      }
    });

    // เมื่อ Port ถูกปิด
    this.serialPort.on('close', () => {
      console.log('🔌 Serial Port closed');
      this.isConnected = false;
      this.emit('disconnected');
      
      if (this.autoReconnect) {
        this.scheduleReconnect();
      }
    });
  }

  /**
   * Parse ข้อมูลจาก Arduino
   * รูปแบบที่รองรับ: "toucher: 1, voltage: 3.45"
   */
  parseData(rawData) {
    try {
      const data = rawData.trim();
      console.log('📡 Raw data:', data);
      
      // Parse format: "toucher: 1, voltage: 3.45"
      const toucherMatch = data.match(/toucher:\s*(\d+)/i);
      const voltageMatch = data.match(/voltage:\s*([\d.]+)/i);
      
      if (toucherMatch && voltageMatch) {
        const sensorData = {
          toucher: parseInt(toucherMatch[1]),
          voltage: parseFloat(voltageMatch[1]),
          timestamp: Date.now(),
          raw: data
        };
        
        console.log('📊 Parsed data:', sensorData);
        return sensorData;
      }
      
      return null;
      
    } catch (err) {
      console.error('❌ Parse error:', err.message);
      return null;
    }
  }

  /**
   * ตั้งเวลาเชื่อมต่อใหม่
   */
  scheduleReconnect() {
    if (this.reconnectTimeout) {
      return; // มีการตั้งเวลาอยู่แล้ว
    }
    
    console.log(`🔄 Reconnecting in ${this.reconnectDelay / 1000} seconds...`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      console.log('🔄 Attempting to reconnect...');
      this.connect();
    }, this.reconnectDelay);
  }

  /**
   * ส่งข้อมูลไป Arduino
   */
  write(data) {
    if (!this.isConnected || !this.serialPort) {
      console.error('❌ Cannot write: Port not connected');
      return false;
    }
    
    try {
      this.serialPort.write(data + '\n');
      console.log('📤 Sent:', data);
      return true;
    } catch (err) {
      console.error('❌ Write error:', err.message);
      return false;
    }
  }

  /**
   * ปิด Serial Port
   */
  async disconnect() {
    this.autoReconnect = false; // ปิด auto reconnect
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.serialPort && this.serialPort.isOpen) {
      return new Promise((resolve) => {
        this.serialPort.close((err) => {
          if (err) {
            console.error('❌ Close error:', err.message);
          } else {
            console.log('✅ Serial Port closed successfully');
          }
          this.isConnected = false;
          resolve();
        });
      });
    }
  }

  /**
   * ตรวจสอบสถานะการเชื่อมต่อ
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      portName: this.portName,
      baudRate: this.baudRate,
      isOpen: this.serialPort ? this.serialPort.isOpen : false
    };
  }
}

module.exports = SerialHandler;