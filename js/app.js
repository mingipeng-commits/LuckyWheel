/* ============================================
   App Controller - Data Input, File Parsing, UI
   ============================================ */

(() => {
    // ---- State ----
    const STORAGE_KEY = 'luckywheel_students';
    let students = [];
    let history = [];           // last N spin results
    const MAX_HISTORY = 30;
    let selectionMode = 'random'; // 'random' | 'no-repeat'
    let selectedSet = new Set();  // names already selected in no-repeat mode
    let loadOrder = 'shuffle';    // 'shuffle' | 'original'
    let wheelStudents = [];       // the (possibly shuffled) array sent to the wheel

    // ---- Admin (whitelist only) ----
    const ADMIN_WL_KEY = 'luckywheel_whitelist';
    let whitelist = [];           // array of names (strings)
    let spinRoundCounter = 0;     // resets when wheel loads or admin saves
    let whitelistPicked = new Set(); // whitelist names already picked this session

    // Intended target for verification
    let _intendedTarget = null;

    // ---- LocalStorage helpers ----
    function saveStudents() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
        } catch (e) { /* quota exceeded or private mode — ignore */ }
    }

    function loadStudents() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    students = parsed;
                }
            }
        } catch (e) { /* corrupted data — ignore */ }
    }

    function clearSavedStudents() {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    }

    function saveWhitelist() {
        try {
            localStorage.setItem(ADMIN_WL_KEY, JSON.stringify(whitelist));
        } catch (e) {}
    }

    function loadWhitelist() {
        try {
            const wl = localStorage.getItem(ADMIN_WL_KEY);
            if (wl) {
                const parsed = JSON.parse(wl);
                if (Array.isArray(parsed)) {
                    whitelist = parsed.filter(n => typeof n === 'string' && n.trim());
                }
            }
        } catch (e) {}
    }

    // Normalize name for matching — strips invisible chars, trims, lowercases
    function normalizeName(name) {
        return name
            .replace(/[\u200B-\u200D\uFEFF\u00A0\u2060\u2028\u2029\r]/g, '')
            .trim()
            .toLowerCase();
    }

    // ---- DOM Elements ----
    const inputPanel = document.getElementById('input-panel');
    const wheelContainer = document.getElementById('wheel-container');
    const tabBtns = document.querySelectorAll('.tab');
    const tabUpload = document.getElementById('tab-upload');
    const tabManual = document.getElementById('tab-manual');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const clearFileBtn = document.getElementById('clear-file');
    const inputName = document.getElementById('input-name');
    const inputId = document.getElementById('input-id');
    const btnAdd = document.getElementById('btn-add');
    const studentListContainer = document.getElementById('student-list-container');
    const studentList = document.getElementById('student-list');
    const studentCount = document.getElementById('student-count');
    const btnLoad = document.getElementById('btn-load');
    const btnBack = document.getElementById('btn-back');
    const btnSpin = document.getElementById('btn-spin');
    const currentNameDisplay = document.getElementById('current-name-display');
    const currentNameEl = document.getElementById('current-name');
    const winnerBanner = document.getElementById('winner-banner');
    const winnerText = document.getElementById('winner-text');
    const historyList = document.getElementById('history-list');
    const btnMode = document.getElementById('btn-mode');
    const modeLabel = document.getElementById('mode-label');
    const btnClearMemory = document.getElementById('btn-clear-memory');
    const btnClearAll = document.getElementById('btn-clear-all');
    const orderToggle = document.getElementById('order-toggle');
    const orderOptions = document.querySelectorAll('.order-option');

    // ---- Tab Switching ----
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            tabUpload.classList.toggle('active', tab === 'upload');
            tabManual.classList.toggle('active', tab === 'manual');
        });
    });

    // ---- File Upload ----
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) processFile(fileInput.files[0]);
    });

    clearFileBtn.addEventListener('click', () => {
        fileInput.value = '';
        fileInfo.classList.add('hidden');
        students = [];
        updateStudentList();
    });

    function processFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        fileName.textContent = file.name;
        fileInfo.classList.remove('hidden');

        if (ext === 'csv') {
            parseCSV(file);
        } else if (ext === 'xls' || ext === 'xlsx') {
            parseXLS(file);
        } else {
            alert('不支援的檔案格式，請使用 .csv、.xls 或 .xlsx');
        }
    }

    function parseCSV(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            if (lines.length < 2) {
                alert('CSV 檔案似乎是空的。');
                return;
            }

            const header = lines[0].split(',').map(h => h.trim().toLowerCase());
            const nameIdx = findColumnIndex(header, ['name', 'fullname', 'full name', '姓名']);
            const idIdx = findColumnIndex(header, ['studentid', 'student id', 'id', '學號', '学号', '號碼', '号码']);

            students = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = parseCSVLine(lines[i]);
                if (cols.length === 0) continue;

                const name = nameIdx >= 0 ? cols[nameIdx]?.trim() : cols[0]?.trim();
                if (!name) continue;

                students.push({
                    name: name,
                    studentId: idIdx >= 0 ? cols[idIdx]?.trim() || '' : ''
                });
            }

            updateStudentList();
        };
        reader.readAsText(file);
    }

    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"' && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else if (ch === '"') {
                    inQuotes = false;
                } else {
                    current += ch;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                } else if (ch === ',') {
                    result.push(current);
                    current = '';
                } else {
                    current += ch;
                }
            }
        }
        result.push(current);
        return result;
    }

    function parseXLS(file) {
        if (typeof XLSX === 'undefined') {
            alert('Excel 檔案支援正在載入，請稍後再試，或改用 CSV 格式。');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

                if (json.length === 0) {
                    alert('試算表似乎是空的。');
                    return;
                }

                const sampleKeys = Object.keys(json[0]);
                const nameKey = findKey(sampleKeys, ['name', 'fullname', 'full name', '姓名']);
                const idKey = findKey(sampleKeys, ['studentid', 'student id', 'id', '學號', '学号', '號碼', '号码']);

                students = json.map(row => ({
                    name: String(row[nameKey] || row[sampleKeys[0]] || '').trim(),
                    studentId: idKey ? String(row[idKey] || '').trim() : ''
                })).filter(s => s.name);

                updateStudentList();
            } catch (err) {
                alert('讀取 Excel 檔案時發生錯誤：' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function findColumnIndex(headers, candidates) {
        for (const candidate of candidates) {
            const idx = headers.indexOf(candidate);
            if (idx >= 0) return idx;
        }
        return -1;
    }

    function findKey(keys, candidates) {
        for (const key of keys) {
            const lower = key.toLowerCase().trim();
            if (candidates.includes(lower)) return key;
        }
        return null;
    }

    // ---- Manual Input + Edit ----
    let editingIndex = -1; // -1 = adding new, >= 0 = editing that index
    const btnCancelEdit = document.getElementById('btn-cancel-edit');

    btnAdd.addEventListener('click', addOrSaveStudent);

    btnCancelEdit.addEventListener('click', cancelEdit);

    function addOrSaveStudent() {
        const name = inputName.value.trim();
        if (!name) {
            inputName.focus();
            return;
        }

        if (editingIndex >= 0 && editingIndex < students.length) {
            // Update existing
            students[editingIndex].name = name;
            students[editingIndex].studentId = inputId.value.trim();
            cancelEdit();
        } else {
            // Add new
            students.push({
                name: name,
                studentId: inputId.value.trim()
            });
        }

        inputName.value = '';
        inputId.value = '';
        inputName.focus();

        updateStudentList();
    }

    function startEdit(index) {
        if (index < 0 || index >= students.length) return;
        editingIndex = index;
        const s = students[index];

        inputName.value = s.name;
        inputId.value = s.studentId || '';

        btnAdd.textContent = '儲存';
        btnAdd.classList.add('editing');
        btnCancelEdit.classList.remove('hidden');

        // Switch to manual tab if not already there
        tabBtns.forEach(b => b.classList.remove('active'));
        document.querySelector('[data-tab="manual"]').classList.add('active');
        tabUpload.classList.remove('active');
        tabManual.classList.add('active');

        inputName.focus();

        // Highlight the row being edited
        updateStudentList();
    }

    function cancelEdit() {
        editingIndex = -1;
        inputName.value = '';
        inputId.value = '';
        btnAdd.textContent = '+ 新增';
        btnAdd.classList.remove('editing');
        btnCancelEdit.classList.add('hidden');
        updateStudentList();
    }

    // ---- Clear All ----
    btnClearAll.addEventListener('click', () => {
        if (students.length === 0) return;
        if (!confirm('確定要清除全部名單嗎？')) return;
        students = [];
        clearSavedStudents();
        updateStudentList();
    });

    // ---- Student List ----
    function updateStudentList() {
        studentCount.textContent = students.length;
        saveStudents();

        if (students.length > 0) {
            studentListContainer.classList.remove('hidden');
            btnLoad.classList.remove('hidden');
            orderToggle.classList.remove('hidden');
        } else {
            studentListContainer.classList.add('hidden');
            btnLoad.classList.add('hidden');
            orderToggle.classList.add('hidden');
        }

        studentList.innerHTML = '';
        students.forEach((s, i) => {
            const item = document.createElement('div');
            item.className = 'student-item' + (i === editingIndex ? ' editing' : '');

            item.innerHTML = `
                <div class="student-item-info">
                    <span class="student-item-name">${escapeHtml(s.name)}</span>
                    ${s.studentId ? `<span class="student-item-id">${escapeHtml(s.studentId)}</span>` : ''}
                </div>
                <div class="student-item-actions">
                    <button class="btn-edit" data-index="${i}" title="編輯">編輯</button>
                    <button class="btn-delete" data-index="${i}" title="刪除">&times;</button>
                </div>
            `;

            studentList.appendChild(item);
        });

        studentList.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                startEdit(parseInt(btn.dataset.index));
            });
        });

        studentList.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index);
                // If deleting the one being edited, cancel edit
                if (idx === editingIndex) cancelEdit();
                else if (idx < editingIndex) editingIndex--;
                students.splice(idx, 1);
                updateStudentList();
            });
        });
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ---- Mode Toggle ----
    btnMode.addEventListener('click', () => {
        if (selectionMode === 'random') {
            selectionMode = 'no-repeat';
            modeLabel.textContent = '不重複';
            btnMode.classList.add('no-repeat');
            btnClearMemory.classList.remove('hidden');
        } else {
            selectionMode = 'random';
            modeLabel.textContent = '隨機';
            btnMode.classList.remove('no-repeat');
            btnClearMemory.classList.add('hidden');
        }
    });

    btnClearMemory.addEventListener('click', () => {
        selectedSet.clear();
        spinRoundCounter = 0;
        whitelistPicked = new Set();
        btnClearMemory.textContent = '重置';
    });

    function studentKey(s) {
        return s.name + '|' + (s.studentId || '');
    }

    // ---- History ----
    function addToHistory(winner) {
        history.unshift({ ...winner, timestamp: Date.now() });
        if (history.length > MAX_HISTORY) history.pop();
        renderHistory();
    }

    function formatTimestamp(ts) {
        const d = new Date(ts);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        return `${mm}/${dd} ${hh}:${mi}:${ss}`;
    }

    function renderHistory() {
        historyList.innerHTML = '';
        history.forEach((w, i) => {
            const item = document.createElement('div');
            item.className = 'history-item';
            const idStr = w.studentId ? ` <span class="history-item-id">(${escapeHtml(w.studentId)})</span>` : '';
            const timeStr = w.timestamp ? `<div class="history-item-time">${formatTimestamp(w.timestamp)}</div>` : '';
            item.innerHTML = `
                <div class="history-item-row">
                    <span class="history-item-name">${escapeHtml(w.name)}${idStr}</span>
                    <span class="history-item-number">#${i + 1}</span>
                </div>
                ${timeStr}
            `;
            historyList.appendChild(item);
        });
    }

    // ---- Order Toggle ----
    orderOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            orderOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadOrder = btn.dataset.order;
        });
    });

    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ---- Load to Wheel ----
    btnLoad.addEventListener('click', () => {
        if (students.length < 2) {
            alert('請至少新增 2 位學生。');
            return;
        }

        SoundEngine.init();

        inputPanel.classList.add('hidden');
        wheelContainer.classList.remove('hidden');

        const canvas = document.getElementById('wheel-canvas');
        LuckyWheel.init(canvas);
        wheelStudents = [...students];
        if (loadOrder === 'shuffle') shuffleArray(wheelStudents);
        LuckyWheel.setStudents(wheelStudents);

        // Reset whitelist round tracking
        spinRoundCounter = 0;
        whitelistPicked = new Set();

        Effects.initConfetti();

        Effects.hideWinnerBurst();
        currentNameDisplay.classList.add('hidden');

        // Start ambient BGM A
        SoundEngine.startBgmA();
    });

    // ---- Back Button ----
    btnBack.addEventListener('click', () => {
        if (LuckyWheel.isCurrentlySpinning()) return;
        wheelContainer.classList.add('hidden');
        inputPanel.classList.remove('hidden');
        Effects.hideWinnerBurst();
        currentNameDisplay.classList.add('hidden');
        SoundEngine.stopBgmA();
    });

    // ---- Spin Button (press & hold for power) ----
    let spinPressStart = 0;
    let spinChargeFrame = 0;
    const spinTextEl = btnSpin.querySelector('.spin-text');

    function startChargingVisual() {
        const maxCharge = 3000;
        function updateCharge() {
            if (!spinPressStart) return;
            const elapsed = performance.now() - spinPressStart;
            const pct = Math.min(elapsed / maxCharge, 1);
            const scale = 1 + pct * 0.15;
            btnSpin.style.transform = `translate(-50%, -50%) scale(${scale})`;
            const glow = 20 + pct * 40;
            const glowOuter = 40 + pct * 60;
            btnSpin.style.boxShadow = `0 0 ${glow}px rgba(255, 0, 255, ${0.5 + pct * 0.5}), 0 0 ${glowOuter}px rgba(139, 0, 255, ${0.3 + pct * 0.4}), inset 0 -4px 10px rgba(0, 0, 0, 0.3), inset 0 4px 10px rgba(255, 255, 255, 0.2)`;
            spinChargeFrame = requestAnimationFrame(updateCharge);
        }
        spinChargeFrame = requestAnimationFrame(updateCharge);
    }

    function stopChargingVisual() {
        cancelAnimationFrame(spinChargeFrame);
        btnSpin.style.transform = '';
        btnSpin.style.boxShadow = '';
    }

    function handleSpinStart(e) {
        if (LuckyWheel.isCurrentlySpinning()) return;
        e.preventDefault();
        spinPressStart = performance.now();
        startChargingVisual();
    }

    // ============================================================
    //  pickTarget — decides WHO the wheel must land on
    // ============================================================
    function pickTarget() {
        // Build candidate pool from the actual wheel array
        let candidates = wheelStudents.slice(); // shallow copy, same object refs

        // No-repeat: narrow to unselected students
        if (selectionMode === 'no-repeat') {
            const avail = candidates.filter(s => !selectedSet.has(studentKey(s)));
            if (avail.length === 0) {
                selectedSet.clear(); // everyone picked, reset
            } else {
                candidates = avail;
            }
        }

        // Whitelist: force pick from whitelist during first 6 rounds
        if (spinRoundCounter < 6 && whitelist.length > 0) {
            // Build lookup of whitelist names (normalized)
            const wlNorm = new Set(whitelist.map(normalizeName));

            // Find wheel students whose normalized name is in the whitelist
            // AND who haven't been whitelist-picked yet
            const wlHits = candidates.filter(s => {
                const nn = normalizeName(s.name);
                return wlNorm.has(nn) && !whitelistPicked.has(nn);
            });

            console.log('[PICK] round', spinRoundCounter,
                '| wlNorm:', [...wlNorm],
                '| studentNames:', candidates.map(s => normalizeName(s.name)),
                '| wlHits:', wlHits.map(s => s.name));

            if (wlHits.length > 0) {
                const pick = wlHits[Math.floor(Math.random() * wlHits.length)];
                whitelistPicked.add(normalizeName(pick.name));
                spinRoundCounter++;
                return pick;
            }
        }

        // Normal random pick from candidates
        spinRoundCounter++;
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    function handleSpinEnd(e) {
        if (!spinPressStart) return;
        e.preventDefault();
        const holdDuration = performance.now() - spinPressStart;
        spinPressStart = 0;
        stopChargingVisual();

        if (LuckyWheel.isCurrentlySpinning()) return;

        // Pick the target student
        const chosen = pickTarget();
        const targetIndex = wheelStudents.indexOf(chosen);
        _intendedTarget = chosen;

        console.log('[SPIN] chosen:', chosen.name,
            '| targetIndex:', targetIndex,
            '| wheelStudents.length:', wheelStudents.length);

        Effects.hideWinnerBurst();

        currentNameDisplay.classList.remove('hidden');
        currentNameEl.textContent = '\u00A0';

        btnSpin.classList.add('spinning');
        Effects.startButtonLightShow(btnSpin);
        SoundEngine.stopBgmA();
        SoundEngine.playSpinMusic();

        LuckyWheel.spin(
            // Winner callback
            (winner) => {
                // Verify the wheel landed correctly
                if (_intendedTarget && winner.name !== _intendedTarget.name) {
                    console.error('[SPIN] MISMATCH! intended:', _intendedTarget.name,
                        'actual:', winner.name);
                }

                btnSpin.classList.remove('spinning');
                Effects.stopButtonLightShow(btnSpin);
                SoundEngine.stopSpinMusic();

                if (selectionMode === 'no-repeat') {
                    selectedSet.add(studentKey(winner));
                    const remaining = students.filter(s => !selectedSet.has(studentKey(s))).length;

                    if (remaining === 0) {
                        btnClearMemory.textContent = `重置 (全部完成！)`;
                    } else {
                        btnClearMemory.textContent = `重置 (${remaining}/${students.length})`;
                    }
                }

                addToHistory(winner);

                const idStr = winner.studentId ? ` - ${winner.studentId}` : '';
                winnerText.textContent = `${winner.name}${idStr}`;

                setTimeout(() => {
                    currentNameDisplay.classList.add('hidden');
                    Effects.showWinnerBurst();
                    Effects.launchConfetti(5000);
                    SoundEngine.playFanfare();
                    setTimeout(() => SoundEngine.startBgmA(), 2000);
                }, 300);
            },
            // Segment change callback
            (student) => {
                currentNameEl.textContent = student.name;
            },
            // Target index — always >= 0 now
            targetIndex,
            // Hold duration for spin power
            holdDuration
        );
    }

    btnSpin.addEventListener('pointerdown', handleSpinStart);
    btnSpin.addEventListener('pointerup', handleSpinEnd);
    btnSpin.addEventListener('pointerleave', (e) => {
        if (spinPressStart) {
            spinPressStart = 0;
            stopChargingVisual();
        }
    });
    btnSpin.addEventListener('contextmenu', (e) => e.preventDefault());
    btnSpin.style.touchAction = 'none';

    // ---- Secret Admin Mode ----
    const adminOverlay = document.getElementById('admin-overlay');
    const adminWhitelistEl = document.getElementById('admin-whitelist');
    const adminSaveBtn = document.getElementById('admin-save');
    const adminCloseBtn = document.getElementById('admin-close');
    const titleEl = document.querySelector('.title');

    // Secret entrance 1: click the title 5 times within 3 seconds
    let titleClicks = [];
    if (titleEl) {
        titleEl.addEventListener('click', () => {
            const now = Date.now();
            titleClicks.push(now);
            titleClicks = titleClicks.filter(t => now - t < 3000);
            if (titleClicks.length >= 5) {
                titleClicks = [];
                openAdmin();
            }
        });
    }

    // Secret entrance 2: Ctrl+Shift+A anywhere
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
            e.preventDefault();
            openAdmin();
        }
    });

    function openAdmin() {
        adminWhitelistEl.value = whitelist.join('\n');
        adminOverlay.classList.remove('hidden');
    }

    function closeAdmin() {
        adminOverlay.classList.add('hidden');
    }

    adminCloseBtn.addEventListener('click', closeAdmin);

    adminOverlay.addEventListener('click', (e) => {
        if (e.target === adminOverlay) closeAdmin();
    });

    adminSaveBtn.addEventListener('click', () => {
        whitelist = adminWhitelistEl.value
            .split('\n')
            .map(s => s.replace(/[\u200B-\u200D\uFEFF\u00A0\u2060\u2028\u2029\r]/g, '').trim())
            .filter(s => s.length > 0);
        saveWhitelist();
        spinRoundCounter = 0;
        whitelistPicked = new Set();

        console.log('[ADMIN] whitelist saved:', whitelist);
        console.log('[ADMIN] normalized:', whitelist.map(normalizeName));

        // Visual confirmation
        adminSaveBtn.textContent = '已儲存!';
        adminSaveBtn.style.background = '#00cc66';
        setTimeout(() => {
            adminSaveBtn.textContent = '儲存';
            adminSaveBtn.style.background = '';
            closeAdmin();
        }, 800);
    });

    // ---- Startup ----
    loadStudents();
    loadWhitelist();
    console.log('[INIT] whitelist loaded:', whitelist);
    if (students.length > 0) {
        updateStudentList();
    }
})();
