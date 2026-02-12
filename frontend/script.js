// เชื่อมต่อ Socket.IO
const socket = io('http://localhost:3000');

// ข้อมูลสำหรับเก็บค่า
let toucherData = [];
let voltageData = [];
let timeLabels = [];
let dataCount = 0;
let isPaused = false;
const MAX_DATA_POINTS = 50; // จำนวนข้อมูลสูงสุดที่แสดงในกราฟ

// Elements
const connectionStatus = document.getElementById('connectionStatus');
const connectionText = document.getElementById('connectionText');
const currentToucher = document.getElementById('currentToucher');
const currentVoltage = document.getElementById('currentVoltage');
const dataCountEl = document.getElementById('dataCount');
const dataTableBody = document.getElementById('dataTableBody');
const clearBtn = document.getElementById('clearBtn');
const pauseBtn = document.getElementById('pauseBtn');
const exportBtn = document.getElementById('exportBtn');

// Chart.js Configuration
const commonOptions = {
    responsive: true,
    maintainAspectRatio: true,
    animation: {
        duration: 200
    },
    scales: {
        x: {
            display: true,
            title: {
                display: true,
                text: 'Time',
                font: { size: 14, weight: 'bold' }
            }
        },
        y: {
            display: true,
            beginAtZero: true
        }
    },
    plugins: {
        legend: {
            display: true,
            position: 'top'
        }
    }
};

// Toucher Chart
const toucherCtx = document.getElementById('toucherChart').getContext('2d');
const toucherChart = new Chart(toucherCtx, {
    type: 'line',
    data: {
        labels: timeLabels,
        datasets: [{
            label: 'Touch Sensor State',
            data: toucherData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
        }]
    },
    options: {
        ...commonOptions,
        scales: {
            ...commonOptions.scales,
            y: {
                ...commonOptions.scales.y,
                title: {
                    display: true,
                    text: 'Touch State (0/1)',
                    font: { size: 14, weight: 'bold' }
                },
                max: 1.5,
                ticks: {
                    stepSize: 1
                }
            }
        }
    }
});

// Voltage Chart
const voltageCtx = document.getElementById('voltageChart').getContext('2d');
const voltageChart = new Chart(voltageCtx, {
    type: 'line',
    data: {
        labels: timeLabels,
        datasets: [{
            label: 'Voltage (V)',
            data: voltageData,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
        }]
    },
    options: {
        ...commonOptions,
        scales: {
            ...commonOptions.scales,
            y: {
                ...commonOptions.scales.y,
                title: {
                    display: true,
                    text: 'Voltage (V)',
                    font: { size: 14, weight: 'bold' }
                }
            }
        }
    }
});

// Socket.IO Events
socket.on('connect', () => {
    console.log('✅ Connected to server');
    connectionStatus.classList.add('connected');
    connectionStatus.classList.remove('disconnected');
    connectionText.textContent = 'Connected';
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
    connectionStatus.classList.add('disconnected');
    connectionStatus.classList.remove('connected');
    connectionText.textContent = 'Disconnected';
});

socket.on('sensorData', (data) => {
    if (isPaused) return;
    
    console.log('📊 Received data:', data);
    
    // อัพเดทค่าปัจจุบัน
    currentToucher.textContent = data.toucher === 1 ? '✋ Touched' : '❌ Not Touched';
    currentVoltage.textContent = data.voltage.toFixed(2) + ' V';
    dataCount++;
    dataCountEl.textContent = dataCount;
    
    // สร้าง timestamp
    const time = new Date(data.timestamp).toLocaleTimeString('th-TH');
    
    // เพิ่มข้อ��ูลในกราฟ
    timeLabels.push(time);
    toucherData.push(data.toucher);
    voltageData.push(data.voltage);
    
    // จำกัดจำนวนข้อมูลในกราฟ
    if (timeLabels.length > MAX_DATA_POINTS) {
        timeLabels.shift();
        toucherData.shift();
        voltageData.shift();
    }
    
    // อัพเดทกราฟ
    toucherChart.update('none');
    voltageChart.update('none');
    
    // เพิ่มข้อมูลในตาราง
    addTableRow(time, data.toucher, data.voltage);
});

// เพิ่มแถวในตาราง
function addTableRow(time, toucher, voltage) {
    const row = dataTableBody.insertRow(0);
    row.innerHTML = `
        <td>${time}</td>
        <td>${toucher === 1 ? '✅ Yes' : '❌ No'}</td>
        <td>${voltage.toFixed(2)}</td>
    `;
    
    // จำกัดจำนวนแถวในตาราง
    if (dataTableBody.rows.length > 10) {
        dataTableBody.deleteRow(10);
    }
}

// ปุ่ม Clear
clearBtn.addEventListener('click', () => {
    if (confirm('ต้องการล้างข้อมูลทั้งหมดหรือไม่?')) {
        timeLabels.length = 0;
        toucherData.length = 0;
        voltageData.length = 0;
        dataCount = 0;
        dataCountEl.textContent = '0';
        dataTableBody.innerHTML = '';
        toucherChart.update();
        voltageChart.update();
    }
});

// ปุ่ม Pause/Resume
pauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? '▶️ Resume' : '⏸️ Pause';
    pauseBtn.style.background = isPaused ? '#10b981' : '#667eea';
});

// ปุ่ม Export CSV
exportBtn.addEventListener('click', () => {
    let csv = 'Time,Touch Sensor,Voltage (V)\n';
    for (let i = 0; i < timeLabels.length; i++) {
        csv += `${timeLabels[i]},${toucherData[i]},${voltageData[i]}\n`;
    }
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arduino_data_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
});