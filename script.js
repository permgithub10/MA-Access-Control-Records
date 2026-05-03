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

// เริ่มต้น Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ====================== UI HELPERS ======================
function showAlert(message, type) {
    const alert = document.getElementById('alert');
    alert.textContent = message;
    alert.className = 'alert alert-' + type;
    alert.style.display = 'block';
    setTimeout(() => { alert.style.display = 'none'; }, 5000);
}

function showLoading(show) {
    const submitBtn = document.querySelector('button[type="submit"]');
    submitBtn.innerHTML = show ? '<span>⏳</span> กำลังบันทึก...' : '<span>💾</span> บันทึกข้อมูล';
    submitBtn.disabled = show;
}

// ====================== FIREBASE OPERATIONS ======================
async function fetchAllDoors() {
    const snapshot = await db.collection('doors').get();
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

async function fetchAllRecords() {
    const snapshot = await db.collection('records').get();
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

function makeRecordKey(floor, department, doorNumber) {
    return `${floor}|${department}|${doorNumber}`;
}

let allDoors = [];
let recordedKeys = new Set();

async function loadCachedData() {
    const [doors, records] = await Promise.all([
        fetchAllDoors(),
        fetchAllRecords()
    ]);
    allDoors = doors;
    recordedKeys = new Set(records.map(r => makeRecordKey(r.floor, r.department, r.doorNumber)));
}

function getAvailableFloors() {
    const floors = new Set();
    allDoors.forEach(door => {
        const key = makeRecordKey(door.floor, door.department, door.doorNumber);
        if (!recordedKeys.has(key)) {
            floors.add(door.floor);
        }
    });
    return Array.from(floors).sort();
}

function getAvailableDepartments(floor) {
    const departments = new Set();
    allDoors
        .filter(door => door.floor === floor)
        .forEach(door => {
            const key = makeRecordKey(door.floor, door.department, door.doorNumber);
            if (!recordedKeys.has(key)) {
                departments.add(door.department);
            }
        });
    return Array.from(departments).sort();
}

function getAvailableDoorsWithDetails(floor, department) {
    const doorsData = allDoors.filter(door => door.floor === floor && door.department === department);
    const availableDoors = doorsData.filter(door => {
        const key = makeRecordKey(door.floor, door.department, door.doorNumber);
        return !recordedKeys.has(key);
    });

    const floorPlanUrl = doorsData.length > 0 ? doorsData[0].floorPlanUrl || '' : '';
    const doorImages = {};
    availableDoors.forEach(door => {
        if (door.doorImageUrl) {
            doorImages[door.doorNumber] = door.doorImageUrl;
        }
    });

    return {
        doors: availableDoors.map(d => d.doorNumber),
        floorPlan: floorPlanUrl,
        doorImages: doorImages
    };
}

let currentFloorPlan = '';
let doorImages = {};

function populateFloors(floors) {
    const floorSelect = document.getElementById('floor');
    floorSelect.innerHTML = '<option value="">-- กรุณาเลือกชั้น --</option>';
    floors.forEach(floor => {
        const option = document.createElement('option');
        option.value = floor;
        option.textContent = 'ชั้น ' + floor;
        floorSelect.appendChild(option);
    });
}

function populateDepartments(departments) {
    const deptSelect = document.getElementById('department');
    deptSelect.innerHTML = '<option value="">-- กรุณาเลือกหน่วยงาน --</option>';
    departments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept;
        option.textContent = dept;
        deptSelect.appendChild(option);
    });
}

function updateDoorSelect(doors) {
    const doorSelect = document.getElementById('doorNumber');
    doorSelect.innerHTML = '<option value="">-- กรุณาเลือกประตู --</option>';
    doors.forEach(door => {
        const option = document.createElement('option');
        option.value = door;
        option.textContent = door;
        doorSelect.appendChild(option);
    });
}

function showFloorPlan() {
    const image = document.getElementById('displayImage');
    const placeholder = document.getElementById('imagePlaceholder');
    if (currentFloorPlan && currentFloorPlan.startsWith('http')) {
        image.src = currentFloorPlan;
        image.onload = () => {
            image.style.display = 'block';
            placeholder.style.display = 'none';
        };
        image.onerror = () => {
            image.style.display = 'none';
            placeholder.style.display = 'block';
            placeholder.innerHTML = '<i>❌</i> ไม่สามารถโหลดรูปผังหน่วยงาน';
        };
    } else {
        image.style.display = 'none';
        placeholder.style.display = 'block';
        placeholder.innerHTML = '<i>🏢</i> ไม่มีรูปผังสำหรับหน่วยงานนี้';
    }
}

function showDoorImage(doorNumber) {
    const image = document.getElementById('displayImage');
    const placeholder = document.getElementById('imagePlaceholder');
    const url = doorImages[doorNumber];
    if (url && url.startsWith('http')) {
        image.src = url;
        image.onload = () => {
            image.style.display = 'block';
            placeholder.style.display = 'none';
        };
        image.onerror = () => showFloorPlan();
    } else {
        showFloorPlan();
    }
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
        if (floors.length === 0) showAlert('ไม่พบชั้นที่ยังมีข้อมูลให้บันทึก', 'info');
    } catch (err) {
        showAlert('ไม่สามารถโหลดข้อมูล: ' + err.message, 'error');
    } finally {
        showLoading(false);
    }
}

document.getElementById('floor').addEventListener('change', async function() {
    const floor = this.value;
    const deptSelect = document.getElementById('department');
    deptSelect.innerHTML = '<option value="">-- กรุณาเลือกหน่วยงาน --</option>';
    deptSelect.disabled = !floor;
    document.getElementById('doorNumber').innerHTML = '<option value="">-- กรุณาเลือกประตู --</option>';
    document.getElementById('doorNumber').disabled = true;
    hideImage();

    if (floor) {
        try {
            showLoading(true);
            const departments = getAvailableDepartments(floor);
            populateDepartments(departments);
            if (departments.length === 0) showAlert('ไม่พบหน่วยงานที่ยังมีข้อมูลให้บันทึกในชั้นนี้', 'info');
        } catch (err) {
            showAlert('ผิดพลาด: ' + err.message, 'error');
        } finally {
            showLoading(false);
        }
    }
});

document.getElementById('department').addEventListener('change', async function() {
    const floor = document.getElementById('floor').value;
    const department = this.value;
    document.getElementById('doorNumber').innerHTML = '<option value="">-- กรุณาเลือกประตู --</option>';
    document.getElementById('doorNumber').disabled = !department;

    if (floor && department) {
        try {
            showLoading(true);
            const { doors, floorPlan, doorImages: images } = getAvailableDoorsWithDetails(floor, department);
            currentFloorPlan = floorPlan;
            doorImages = images;
            updateDoorSelect(doors);
            if (doors.length === 0) {
                showAlert('ไม่พบประตูที่ยังไม่ได้บันทึกสำหรับหน่วยงานนี้', 'info');
            }
            showFloorPlan();
        } catch (err) {
            showAlert('ผิดพลาด: ' + err.message, 'error');
        } finally {
            showLoading(false);
        }
    }
});

document.getElementById('doorNumber').addEventListener('change', function() {
    const doorNumber = this.value;
    if (doorNumber) {
        showDoorImage(doorNumber);
    } else {
        showFloorPlan();
    }
});

// ====================== SAVE DATA ======================
document.getElementById('accessForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (isLoading) return;

    const floor = document.getElementById('floor').value;
    const department = document.getElementById('department').value;
    const doorNumber = document.getElementById('doorNumber').value;
    const timeOffset = parseFloat(document.getElementById('timeOffset').value);
    const timeDirection = document.getElementById('timeDirection').value;
    const powerSupplyVoltage = parseFloat(document.getElementById('powerSupplyVoltage').value);
    const batteryVoltage = parseFloat(document.getElementById('batteryVoltage').value);
    const adminName = document.getElementById('adminName').value.trim();
    const additionalProblem = document.getElementById('additionalProblem').value.trim();

    if (!floor || !department || !doorNumber) {
        showAlert('กรุณาเลือกชั้น หน่วยงาน และประตูให้ครบถ้วน', 'error');
        return;
    }
    if (isNaN(timeOffset) || timeOffset < 0) {
        showAlert('กรุณากรอกเวลาคลาดเคลื่อนให้ถูกต้อง', 'error');
        return;
    }
    if (isNaN(powerSupplyVoltage) || powerSupplyVoltage < 0 || powerSupplyVoltage > 30) {
        showAlert('กรุณากรอกแรงดัน Power Supply ให้ถูกต้อง (0-30 V)', 'error');
        return;
    }
    if (isNaN(batteryVoltage) || batteryVoltage < 0 || batteryVoltage > 30) {
        showAlert('กรุณากรอกแรงดันแบตเตอรี่ให้ถูกต้อง (0-30 V)', 'error');
        return;
    }
    if (!adminName) {
        showAlert('กรุณากรอกชื่อ Admin', 'error');
        return;
    }

    if (!confirm('ยืนยันการบันทึกข้อมูล?')) return;

    isLoading = true;
    showLoading(true);

    const recordId = `${floor}_${department}_${doorNumber}`
        .replace(/[\/\s\.#\$\[\]]/g, '_')
        .replace(/_+/g, '_');

    try {
        await db.collection('records').doc(recordId).create({
            floor: floor,
            department: department,
            doorNumber: doorNumber,
            timeDirection: timeDirection,
            timeOffset: timeOffset,
            powerSupplyVoltage: powerSupplyVoltage,
            batteryVoltage: batteryVoltage,
            adminName: adminName,
            additionalProblem: additionalProblem || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showAlert('บันทึกข้อมูลสำเร็จ', 'success');
        resetForm();
        await loadFloors();
    } catch (error) {
        if (error.code === 'already-exists') {
            alert('ประตูนี้มีการบันทึกแล้ว');
            showAlert('ประตูนี้มีการบันทึกข้อมูลไปแล้ว', 'error');
        } else {
            showAlert('เกิดข้อผิดพลาด: ' + error.message, 'error');
        }
    } finally {
        isLoading = false;
        showLoading(false);
    }
});

let isLoading = false;

function resetForm() {
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

function updateCurrentTime() {
    const now = new Date();
    const options = { 
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, timeZone: 'Asia/Bangkok'
    };
    document.getElementById('currentDateTime').innerHTML = '🕐 ' + now.toLocaleDateString('th-TH', options);
}

async function testConnection() {
    const statusEl = document.getElementById('connectionStatus');
    try {
        const testDoc = await db.collection('doors').limit(1).get();
        statusEl.className = 'connection-status status-connected';
        statusEl.innerHTML = `✅ เชื่อมต่อ Firestore สำเร็จ (${testDoc.size} เอกสารทดสอบ)`;
    } catch (err) {
        statusEl.className = 'connection-status status-disconnected';
        statusEl.innerHTML = '❌ การเชื่อมต่อล้มเหลว: ' + err.message;
    }
}

window.onload = async function() {
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    await testConnection();
    await loadFloors();
};

window.addEventListener('beforeunload', function() {
    if (isLoading) return 'กำลังบันทึกข้อมูล กรุณารอสักครู่...';
});