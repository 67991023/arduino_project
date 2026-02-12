#include <BluetoothSerial.h>

// ตรวจสอบว่า Bluetooth ถูก Enable หรือไม่
#if !defined(CONFIG_BT_ENABLED) || !defined(CONFIG_BLUEDROID_ENABLED)
#error Bluetooth is not enabled! Please run `make menuconfig` to and enable it.
#endif

BluetoothSerial SerialBT;

const int vsupplyPin = 34; // Pin connected to the voltage supply (ADC1_CH6)
const int touchPin = 12;   // Pin connected to the touch sensor (T5)
const int ledPin = 32;     // Pin connected to the LED

// กำหนด threshold สำหรับการสัมผัส
const int TOUCH_THRESHOLD = 40;

void setup() {
  // USB Serial สำหรับ Debug
  Serial.begin(115200);
  Serial.println("ESP32 starting...");
  
  // Bluetooth Serial
  SerialBT.begin("ESP32_Arduino"); // ชื่อ Bluetooth device
  Serial.println("Bluetooth device started: ESP32_Arduino");
  Serial.println("You can now pair it with your device!");
  
  // ตั้งค่า ADC
  analogReadResolution(12); // 12-bit resolution (0-4095)
  analogSetAttenuation(ADC_11db); // 0-3.3V range for all ADC pins
  
  // ตั้งค่า Pins
  pinMode(ledPin, OUTPUT);
  
  // Blink LED เพื่อแสดงว่า ready
  for (int i = 0; i < 3; i++) {
    digitalWrite(ledPin, HIGH);
    delay(200);
    digitalWrite(ledPin, LOW);
    delay(200);
  }
  
  Serial.println("Ready to send data!");
  SerialBT.println("Ready to send data!");
}

float voltageReading(int _adc_pin, int _window_size) {
    float _avg_adc = 0.0;
    float _voltage = 0.0;
    int _idx = 0;
    
    do {
        _avg_adc += (float)analogRead(_adc_pin);
        delay(2); // Small delay for ADC stabilization
        _idx++;
    } while (_idx < _window_size);
    
    _avg_adc /= _idx;
    
    // Calibration polynomial
    _avg_adc = 0.001204 * (_avg_adc * _avg_adc) - 0.219007 * _avg_adc + 198.170422;
    
    // Convert to voltage
    _voltage = (_avg_adc / 4095.0) * 3.3; // 12-bit ADC, 3.3V reference
    
    // Voltage divider correction
    _voltage = _voltage / (20000.0 / (160000.0 + 20000.0));
    
    return _voltage;
}

void loop() {
  // อ่านค่า Touch Sensor
  int touchRawValue = touchRead(touchPin);
  
  // แปลงเป็น 0 หรือ 1
  int touchValue = (touchRawValue < TOUCH_THRESHOLD) ? 1 : 0;
  
  // อ่านค่า Voltage
  float vsupplyValue = voltageReading(vsupplyPin, 10);

  // ควบคุม LED
  digitalWrite(ledPin, touchValue == 1 ? HIGH : LOW);
  
  // สร้างข้อความในรูปแบบที่ Backend ต้องการ: "toucher: X, voltage: Y.YY"
  String data = "toucher: " + String(touchValue) + ", voltage: " + String(vsupplyValue, 2);
  
  // ส่งข้อมูลทั้ง Bluetooth และ USB Serial
  SerialBT.println(data); // Bluetooth
  Serial.println(data);   // USB Serial (for debugging)
  
  // Debug info (เฉพาะ USB Serial)
  Serial.print("  [Touch Raw: ");
  Serial.print(touchRawValue);
  Serial.println("]");

  delay(100); // ส่งข้อมูลทุก 100ms
}