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
    const inputGender = document.getElementById('input-gender');
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
            alert('Unsupported file format. Please use .csv, .xls, or .xlsx');
        }
    }

    function parseCSV(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            if (lines.length < 2) {
                alert('CSV file appears to be empty.');
                return;
            }

            const header = lines[0].split(',').map(h => h.trim().toLowerCase());
            const nameIdx = findColumnIndex(header, ['name', 'fullname', 'full name', '姓名']);
            const idIdx = findColumnIndex(header, ['studentid', 'student id', 'id', '學號', '学号']);
            const genderIdx = findColumnIndex(header, ['gender', 'sex', '性別', '性别']);

            students = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = parseCSVLine(lines[i]);
                if (cols.length === 0) continue;

                const name = nameIdx >= 0 ? cols[nameIdx]?.trim() : cols[0]?.trim();
                if (!name) continue;

                students.push({
                    name: name,
                    studentId: idIdx >= 0 ? cols[idIdx]?.trim() || '' : '',
                    gender: genderIdx >= 0 ? cols[genderIdx]?.trim() || '' : ''
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
            alert('Excel file support is loading. Please try again in a moment, or use CSV format.');
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
                    alert('The spreadsheet appears to be empty.');
                    return;
                }

                const sampleKeys = Object.keys(json[0]);
                const nameKey = findKey(sampleKeys, ['name', 'fullname', 'full name', '姓名']);
                const idKey = findKey(sampleKeys, ['studentid', 'student id', 'id', '學號', '学号']);
                const genderKey = findKey(sampleKeys, ['gender', 'sex', '性別', '性别']);

                students = json.map(row => ({
                    name: String(row[nameKey] || row[sampleKeys[0]] || '').trim(),
                    studentId: idKey ? String(row[idKey] || '').trim() : '',
                    gender: genderKey ? String(row[genderKey] || '').trim() : ''
                })).filter(s => s.name);

                updateStudentList();
            } catch (err) {
                alert('Error reading Excel file: ' + err.message);
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

    inputName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addOrSaveStudent();
    });

    inputId.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addOrSaveStudent();
    });

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
            students[editingIndex].gender = inputGender.value;
            cancelEdit();
        } else {
            // Add new
            students.push({
                name: name,
                studentId: inputId.value.trim(),
                gender: inputGender.value
            });
        }

        inputName.value = '';
        inputId.value = '';
        inputGender.value = '';
        inputName.focus();

        updateStudentList();
    }

    function startEdit(index) {
        if (index < 0 || index >= students.length) return;
        editingIndex = index;
        const s = students[index];

        inputName.value = s.name;
        inputId.value = s.studentId || '';
        inputGender.value = s.gender || '';

        btnAdd.textContent = 'Save';
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
        inputGender.value = '';
        btnAdd.textContent = '+ Add';
        btnAdd.classList.remove('editing');
        btnCancelEdit.classList.add('hidden');
        updateStudentList();
    }

    // ---- Clear All ----
    btnClearAll.addEventListener('click', () => {
        if (students.length === 0) return;
        if (!confirm('Are you sure you want to clear all students?')) return;
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
        } else {
            studentListContainer.classList.add('hidden');
            btnLoad.classList.add('hidden');
        }

        studentList.innerHTML = '';
        students.forEach((s, i) => {
            const item = document.createElement('div');
            item.className = 'student-item' + (i === editingIndex ? ' editing' : '');

            const genderLabel = s.gender === 'M' ? 'Male' : s.gender === 'F' ? 'Female' : s.gender || '';

            item.innerHTML = `
                <div class="student-item-info">
                    <span class="student-item-name">${escapeHtml(s.name)}</span>
                    ${s.studentId ? `<span class="student-item-id">${escapeHtml(s.studentId)}</span>` : ''}
                    ${genderLabel ? `<span class="student-item-gender">${escapeHtml(genderLabel)}</span>` : ''}
                </div>
                <div class="student-item-actions">
                    <button class="btn-edit" data-index="${i}" title="Edit">Edit</button>
                    <button class="btn-delete" data-index="${i}" title="Remove">&times;</button>
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
            modeLabel.textContent = 'No Repeat';
            btnMode.classList.add('no-repeat');
            btnClearMemory.classList.remove('hidden');
        } else {
            selectionMode = 'random';
            modeLabel.textContent = 'Random';
            btnMode.classList.remove('no-repeat');
            btnClearMemory.classList.add('hidden');
        }
    });

    btnClearMemory.addEventListener('click', () => {
        selectedSet.clear();
        btnClearMemory.textContent = 'Reset';
    });

    function getAvailableForSpin() {
        if (selectionMode === 'random') return students;

        const available = students.filter(s => !selectedSet.has(studentKey(s)));
        if (available.length === 0) {
            // All selected — auto reset
            selectedSet.clear();
            return students;
        }
        return available;
    }

    function studentKey(s) {
        return s.name + '|' + (s.studentId || '');
    }

    // ---- History ----
    function addToHistory(winner) {
        history.unshift(winner);
        if (history.length > MAX_HISTORY) history.pop();
        renderHistory();
    }

    function renderHistory() {
        historyList.innerHTML = '';
        history.forEach((w, i) => {
            const item = document.createElement('div');
            item.className = 'history-item';
            const idStr = w.studentId ? `<span class="history-item-id">${escapeHtml(w.studentId)}</span>` : '';
            item.innerHTML = `
                <span class="history-item-number">#${i + 1}</span>
                <span class="history-item-name">${escapeHtml(w.name)}</span>
                ${idStr}
            `;
            historyList.appendChild(item);
        });
    }

    // ---- Load to Wheel ----
    btnLoad.addEventListener('click', () => {
        if (students.length < 2) {
            alert('Please add at least 2 students.');
            return;
        }

        SoundEngine.init();

        inputPanel.classList.add('hidden');
        wheelContainer.classList.remove('hidden');

        const canvas = document.getElementById('wheel-canvas');
        LuckyWheel.init(canvas);
        LuckyWheel.setStudents([...students]);

        Effects.initConfetti();

        Effects.hideWinnerBurst();
        currentNameDisplay.classList.add('hidden');
    });

    // ---- Back Button ----
    btnBack.addEventListener('click', () => {
        if (LuckyWheel.isCurrentlySpinning()) return;
        wheelContainer.classList.add('hidden');
        inputPanel.classList.remove('hidden');
        Effects.hideWinnerBurst();
        currentNameDisplay.classList.add('hidden');
    });

    // ---- Spin Button ----
    btnSpin.addEventListener('click', () => {
        if (LuckyWheel.isCurrentlySpinning()) return;

        // Determine target index for no-repeat mode
        let targetIndex = -1; // -1 = pure random

        if (selectionMode === 'no-repeat') {
            // Find available (not-yet-selected) students
            let available = students.filter(s => !selectedSet.has(studentKey(s)));
            if (available.length === 0) {
                // All selected — auto reset
                selectedSet.clear();
                available = [...students];
            }

            // Pick a random one from the available pool
            const chosen = available[Math.floor(Math.random() * available.length)];

            // Find its index in the wheel's student array (which matches students array order)
            targetIndex = students.findIndex(s => studentKey(s) === studentKey(chosen));

            const remaining = available.length;
            btnClearMemory.textContent = `Reset (${remaining}/${students.length})`;
        }

        Effects.hideWinnerBurst();

        currentNameDisplay.classList.remove('hidden');
        currentNameEl.textContent = '\u00A0';

        btnSpin.classList.add('spinning');
        Effects.startButtonLightShow(btnSpin);

        LuckyWheel.spin(
            // Winner callback
            (winner) => {
                btnSpin.classList.remove('spinning');
                Effects.stopButtonLightShow(btnSpin);

                if (selectionMode === 'no-repeat') {
                    selectedSet.add(studentKey(winner));
                    const remaining = students.filter(s => !selectedSet.has(studentKey(s))).length;

                    if (remaining === 0) {
                        btnClearMemory.textContent = `Reset (All done!)`;
                    } else {
                        btnClearMemory.textContent = `Reset (${remaining}/${students.length})`;
                    }
                }

                addToHistory(winner);

                const genderStr = winner.gender === 'M' ? ' (Male)' : winner.gender === 'F' ? ' (Female)' : '';
                const idStr = winner.studentId ? ` - ${winner.studentId}` : '';
                winnerText.textContent = `${winner.name}${idStr}${genderStr}`;

                setTimeout(() => {
                    currentNameDisplay.classList.add('hidden');
                    Effects.showWinnerBurst();
                    Effects.launchConfetti(5000);
                    SoundEngine.playFanfare();
                }, 300);
            },
            // Segment change callback
            (student) => {
                currentNameEl.textContent = student.name;
            },
            // Target index (-1 = random, >= 0 = forced landing)
            targetIndex
        );
    });

    // ---- Startup: restore saved students ----
    loadStudents();
    if (students.length > 0) {
        updateStudentList();
    }
})();
