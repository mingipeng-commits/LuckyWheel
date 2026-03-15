/* ============================================
   App Controller - Data Input, File Parsing, UI
   ============================================ */

(() => {
    // ---- State ----
    let students = [];

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

            // Parse header
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

                // Try to identify columns
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

    // ---- Manual Input ----
    btnAdd.addEventListener('click', addStudent);

    inputName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addStudent();
    });

    inputId.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addStudent();
    });

    function addStudent() {
        const name = inputName.value.trim();
        if (!name) {
            inputName.focus();
            return;
        }

        students.push({
            name: name,
            studentId: inputId.value.trim(),
            gender: inputGender.value
        });

        inputName.value = '';
        inputId.value = '';
        inputGender.value = '';
        inputName.focus();

        updateStudentList();
    }

    // ---- Student List ----
    function updateStudentList() {
        studentCount.textContent = students.length;

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
            item.className = 'student-item';

            const genderLabel = s.gender === 'M' ? 'Male' : s.gender === 'F' ? 'Female' : s.gender || '';

            item.innerHTML = `
                <div class="student-item-info">
                    <span class="student-item-name">${escapeHtml(s.name)}</span>
                    ${s.studentId ? `<span class="student-item-id">${escapeHtml(s.studentId)}</span>` : ''}
                    ${genderLabel ? `<span class="student-item-gender">${escapeHtml(genderLabel)}</span>` : ''}
                </div>
                <button class="btn-delete" data-index="${i}" title="Remove">&times;</button>
            `;

            studentList.appendChild(item);
        });

        // Attach delete handlers
        studentList.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index);
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

    // ---- Load to Wheel ----
    btnLoad.addEventListener('click', () => {
        if (students.length < 2) {
            alert('Please add at least 2 students.');
            return;
        }

        // Initialize audio on user gesture
        SoundEngine.init();

        // Switch view
        inputPanel.classList.add('hidden');
        wheelContainer.classList.remove('hidden');

        // Initialize wheel
        const canvas = document.getElementById('wheel-canvas');
        LuckyWheel.init(canvas);
        LuckyWheel.setStudents([...students]);

        // Initialize effects
        Effects.createRimLights();
        Effects.startRimAnimation();
        Effects.initConfetti();

        // Hide any previous winner
        Effects.hideWinnerBurst();
        currentNameDisplay.classList.add('hidden');
    });

    // ---- Back Button ----
    btnBack.addEventListener('click', () => {
        if (LuckyWheel.isCurrentlySpinning()) return;
        wheelContainer.classList.add('hidden');
        inputPanel.classList.remove('hidden');
        Effects.stopRimAnimation();
        Effects.hideWinnerBurst();
        currentNameDisplay.classList.add('hidden');
    });

    // ---- Spin Button ----
    btnSpin.addEventListener('click', () => {
        if (LuckyWheel.isCurrentlySpinning()) return;

        // Hide previous winner
        Effects.hideWinnerBurst();

        // Show current name display
        currentNameDisplay.classList.remove('hidden');
        currentNameEl.textContent = '...';

        // Start button light show
        btnSpin.classList.add('spinning');
        Effects.startButtonLightShow(btnSpin);

        // Spin!
        LuckyWheel.spin(
            // Winner callback
            (winner) => {
                btnSpin.classList.remove('spinning');
                Effects.stopButtonLightShow(btnSpin);

                // Show winner
                const genderStr = winner.gender === 'M' ? ' (Male)' : winner.gender === 'F' ? ' (Female)' : '';
                const idStr = winner.studentId ? ` - ${winner.studentId}` : '';
                winnerText.textContent = `🎉 ${winner.name}${idStr}${genderStr} 🎉`;

                // Delay for dramatic effect
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
            }
        );
    });
})();
