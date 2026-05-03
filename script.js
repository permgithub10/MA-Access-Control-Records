// ====================== CONFIG ======================
// ⚠️ แก้ไขเป็นของโปรเจกต์คุณจาก Firebase Console -> Project settings
const firebaseConfig = {
  apiKey: "AIzaSyB8TEo2xThu9VuDsdViMq3pHXcDPiYvL_U",
  authDomain: "ma-access-control-records.firebaseapp.com",
  projectId: "ma-access-control-records",
  storageBucket: "ma-access-control-records.firebasestorage.app",
  messagingSenderId: "63381747693",
  appId: "1:63381747693:web:faff2e8cde14d79e2659e4",
};

try {
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase เริ่มต้นสำเร็จ');
} catch (error) {
    console.error('Firebase init error:', error);
}
const db = firebase.firestore();

// ====================== UI HELPERS ======================
function showAlert(message, type) {
    const alert = document.getElementById('alert');
    alert.textContent = message;
    alert.className = 'alert alert-' + type;
    alert.style.display = 'block';
    console.log(`[${type.toUpperCase()}] ${message}`);
    setTimeout(() => { alert.style.display = 'none'; }, 5000);
}

function showLoading(show) {
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerHTML = show ? '<span>⏳</span> กำลังบันทึก...' : '<span>💾</span> บันทึกข้อมูล';
    submitBtn.disabled = show;
}

// ====================== FIREBASE OPERATIONS ======================
async function fetchAllDoors() {
    const snapshot = await db.collection('doors').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function fetchAllRecords() {
    const snapshot = await db.collection('records').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function makeRecordKey(floor, department, doorNumber) {
    return `${floor}|${department}|${doorNumber}`;
}

let allDoors = [];
let recordedKeys = new Set();

async function loadCachedData() {
    console.log('กำลังโหลดข้อมูลจาก Firestore...');
    const [doors, records] = await Promise.all([fetchAllDoors(), fetchAllRecords()]);
    allDoors = doors;
    recordedKeys = new Set(records.map(r => makeRecordKey(r.floor, r.department, r.doorNumber)));
    console.log(`โหลดเสร็จ: ${doors.length} ประตู, ${records.length} รายการบันทึก`);
}

function getAvailableFloors() {
    const floors = new Set();
    allDoors.forEach(door => {
        if (!recordedKeys.has(makeRecordKey(door.floor, door.department, door.doorNumber))) {
            floors.add(door.floor);
        }
    });
    return Array.from(floors).sort();
}

function getAvailableDepartments(floor) {
    const departments = new Set();
    allDoors.filter(d => d.floor === floor).forEach(door => {
        if (!recordedKeys.has(makeRecordKey(door.floor, door.department, door.doorNumber))) {
            departments.add(door.department);
        }
    });
    return Array.from(departments).sort();
}

function getAvailableDoorsWithDetails(floor, department) {
    const doorsData = allDoors.filter(d => d.floor === floor && d.department === department);
    const available = doorsData.filter(d => !recordedKeys.has(makeRecordKey(d.floor, d.department, d.doorNumber)));
    const floorPlanUrl = doorsData.length > 0 ? doorsData[0].floorPlanUrl || '' : '';
    const doorImages = {};
    available.forEach(d => { if (d.doorImageUrl) doorImages[d.doorNumber] = d.doorImageUrl; });
    return { doors: available.map(d => d.doorNumber), floorPlan: floorPlanUrl, doorImages };
}

let currentFloorPlan = '';
let doorImages = {};

function populateFloors(floors) {
    const sel = document.getElementById('floor');
    sel.innerHTML = '<option value="">-- กรุณาเลือกชั้น --</option>';
    floors.forEach(f => { const o = document.createElement('option'); o.value = f; o.textContent = 'ชั้น ' + f; sel.appendChild(o); });
}
function populateDepartments(departments) {
    const sel = document.getElementById('department');
    sel.innerHTML = '<option value="">-- กรุณาเลือกหน่วยงาน --</option>';
    departments.forEach(d => { const o = document.createElement('option'); o.value = d; o.textContent = d; sel.appendChild(o); });
}
function updateDoorSelect(doors) {
    const sel = document.getElementById('doorNumber');
    sel.innerHTML = '<option value="">-- กรุณาเลือกประตู --</option>';
    doors.forEach(d => { const o = document.createElement('option'); o.value = d; o.textContent = d; sel.appendChild(o); });
}

function showFloorPlan() {
    const img = document.getElementById('displayImage'), ph = document.getElementById('imagePlaceholder');
    if (currentFloorPlan && currentFloorPlan.startsWith('http')) {
        img.src = currentFloorPlan;
        img.onload = () => { img.style.display = 'block'; ph.style.display = 'none'; };
        img.onerror = () => { img.style.display = 'none'; ph.style.display = 'block'; ph.innerHTML = '<i>❌</i> ไม่สามารถโหลดรูปผัง'; };
    } else {
        img.style.display = 'none'; ph.style.display = 'block'; ph.innerHTML = '<i>🏢</i> ไม่มีรูปผัง';
    }
}
function showDoorImage(num) {
    const img = document.getElementById('displayImage'), ph = document.getElementById('imagePlaceholder');
    const url = doorImages[num];
    if (url && url.startsWith('http')) {
        img.src = url;
        img.onload = () => { img.style.display = 'block'; ph.style.display = 'none'; };
        img.onerror = () => showFloorPlan();
    } else showFloorPlan();
}
function hideImage() {
    document.getElementById('displayImage').style.display = 'none';
    document.getElementById('imagePlaceholder').style.display = 'block';
    document.getElementById('imagePlaceholder').innerHTML = '<i>🏢</i> กรุณาเลือกชั้นและหน่วยงาน';
}

// ====================== EVENT HANDLERS ======================
async function loadFloors() {
    try {
        showLoading(true);
        await loadCachedData();
        const floors = getAvailableFloors();
        populateFloors(floors);
        if (floors.length === 0) showAlert('ไม่มีชั้นที่ต้องบันทึก', 'info');
    } catch (err) {
        console.error('loadFloors error:', err);
        showAlert('โหลดชั้นล้มเหลว: ' + err.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ผูก event ต่างๆ
document.getElementById('floor').addEventListener('change', async function() {
    const floor = this.value;
    const dept = document.getElementById('department');
    dept.innerHTML = '<option value="">-- กรุณาเลือกหน่วยงาน --</option>';
    dept.disabled = !floor;
    document.getElementById('doorNumber').innerHTML = '<option value="">-- กรุณาเลือกประตู --</option>';
    document.getElementById('doorNumber').disabled = true;
    hideImage();
    if (floor) {
        showLoading(true);
        try {
            const departments = getAvailableDepartments(floor);
            populateDepartments(departments);
            if (departments.length === 0) showAlert('ไม่มีหน่วยงานเหลือในชั้นนี้', 'info');
        } catch (err) {
            console.error(err);
            showAlert('ผิดพลาด: ' + err.message, 'error');
        } finally { showLoading(false); }
    }
});

document.getElementById('department').addEventListener('change', async function() {
    const floor = document.getElementById('floor').value;
    const dept = this.value;
    document.getElementById('doorNumber').innerHTML = '<option value="">-- กรุณาเลือกประตู --</option>';
    document.getElementById('doorNumber').disabled = !dept;
    if (floor && dept) {
        showLoading(true);
        try {
            const { doors, floorPlan, doorImages: imgs } = getAvailableDoorsWithDetails(floor, dept);
            currentFloorPlan = floorPlan;
            doorImages = imgs;
            updateDoorSelect(doors);
            if (doors.length === 0) showAlert('ไม่มีประตูเหลือ', 'info');
            showFloorPlan();
        } catch (err) { showAlert('ผิดพลาด: ' + err.message, 'error'); }
        finally { showLoading(false); }
    }
});

document.getElementById('doorNumber').addEventListener('change', function() {
    this.value ? showDoorImage(this.value) : showFloorPlan();
});

// ====================== SAVE ======================
let isLoading = false;

document.getElementById('accessForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    console.log('เริ่ม submit form...');
    if (isLoading) { console.log('กำลังทำงานอยู่, ยกเลิก'); return; }

    const floor = document.getElementById('floor').value;
    const department = document.getElementById('department').value;
    const doorNumber = document.getElementById('doorNumber').value;
    const timeOffset = parseFloat(document.getElementById('timeOffset').value);
    const timeDirection = document.getElementById('timeDirection').value;
    const powerSupplyVoltage = parseFloat(document.getElementById('powerSupplyVoltage').value);
    const batteryVoltage = parseFloat(document.getElementById('batteryVoltage').value);
    const adminName = document.getElementById('adminName').value.trim();
    const additionalProblem = document.getElementById('additionalProblem').value.trim();

    // validation
    if (!floor || !department || !doorNumber) return showAlert('กรุณาเลือกชั้น หน่วยงาน และประตู', 'error');
    if (isNaN(timeOffset) || timeOffset < 0) return showAlert('เวลาคลาดเคลื่อนไม่ถูกต้อง', 'error');
    if (isNaN(powerSupplyVoltage) || powerSupplyVoltage < 0 || powerSupplyVoltage > 30) return showAlert('แรงดัน Power Supply ไม่ถูกต้อง (0-30 V)', 'error');
    if (isNaN(batteryVoltage) || batteryVoltage < 0 || batteryVoltage > 30) return showAlert('แรงดันแบตเตอรี่ไม่ถูกต้อง (0-30 V)', 'error');
    if (!adminName) return showAlert('กรุณากรอกชื่อ Admin', 'error');

    if (!confirm('ยืนยันการบันทึกข้อมูล?')) return;

    isLoading = true;
    showLoading(true);
    const recordId = `${floor}_${department}_${doorNumber}`.replace(/[\/\s\.#\$\[\]]/g, '_').replace(/_+/g, '_');
    console.log('กำลังบันทึก document ID:', recordId);

    try {
        await db.collection('records').doc(recordId).create({
            floor, department, doorNumber,
            timeDirection, timeOffset,
            powerSupplyVoltage, batteryVoltage,
            adminName,
            additionalProblem: additionalProblem || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('บันทึกสำเร็จ');
        showAlert('บันทึกข้อมูลสำเร็จ', 'success');
        resetForm();
        await loadFloors();
    } catch (error) {
        console.error('บันทึกผิดพลาด:', error);
        if (error.code === 'already-exists') {
            alert('ประตูนี้มีการบันทึกแล้ว');
            showAlert('ประตูนี้ถูกบันทึกไปแล้ว', 'error');
        } else if (error.code === 'permission-denied') {
            showAlert('สิทธิ์ไม่พอ: กรุณาตรวจสอบกฎ Firestore', 'error');
        } else {
            showAlert('เกิดข้อผิดพลาด: ' + error.message, 'error');
        }
    } finally {
        isLoading = false;
        showLoading(false);
    }
});

// รีเซ็ตฟอร์ม (ผูก event แทน onclick)
document.getElementById('resetBtn').addEventListener('click', resetForm);

function resetForm() {
    console.log('รีเซ็ตฟอร์ม');
    document.getElementById('accessForm').reset();
    document.getElementById('department').disabled = true;
    document.getElementById('doorNumber').disabled = true;
    hideImage();
    document.getElementById('timeOffset').value = '0';
    document.getElementById('timeDirection').value = 'เร็วกว่า';
    document.getElementById('powerSupplyVoltage').value = '';
    document.getElementById('batteryVoltage').value = '';
    document.getElementById('additionalProblem').value = '';
    doorImages = {};
    currentFloorPlan = '';
}

// นาฬิกา
function updateCurrentTime() {
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' };
    document.getElementById('currentDateTime').innerHTML = '🕐 ' + now.toLocaleDateString('th-TH', options);
}

// ทดสอบการเชื่อมต่อ
async function testConnection() {
    const statusEl = document.getElementById('connectionStatus');
    try {
        const test = await db.collection('doors').limit(1).get();
        statusEl.className = 'connection-status status-connected';
        statusEl.innerHTML = `✅ เชื่อมต่อ Firestore สำเร็จ (${test.size})`;
        console.log('ทดสอบเชื่อมต่อผ่าน');
    } catch (err) {
        statusEl.className = 'connection-status status-disconnected';
        statusEl.innerHTML = '❌ เชื่อมต่อล้มเหลว: ' + err.message;
        console.error('Connection test error:', err);
    }
}

// เริ่มต้น
window.onload = async () => {
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    await testConnection();
    await loadFloors();
};

window.addEventListener('beforeunload', () => {
    if (isLoading) return 'กำลังบันทึกข้อมูล กรุณารอสักครู่...';
});
