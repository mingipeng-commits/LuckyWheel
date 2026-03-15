/* ============================================
   Wheel Rendering & Spin Animation
   ============================================ */

const LuckyWheel = (() => {
    let canvas, ctx;
    let glowCanvas, glowCtx;
    let students = [];
    let colors = [];
    let currentAngle = 0;
    let angularVelocity = 0;
    let isSpinning = false;
    let animFrameId = null;
    let whooshSound = null;
    let previousSegmentIndex = -1;
    let neonGlowIntensity = 0;
    let onWinnerCallback = null;
    let onSegmentChangeCallback = null;

    // Wheel dimensions
    let wheelRadius = 0;
    let centerX = 0;
    let centerY = 0;
    const hubRadius = 55;

    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');

        glowCanvas = document.getElementById('glow-canvas');
        glowCtx = glowCanvas.getContext('2d');

        resize();
        window.addEventListener('resize', resize);
    }

    function resize() {
        const frame = canvas.parentElement;
        const size = Math.min(frame.clientWidth, frame.clientHeight);
        const dpr = window.devicePixelRatio || 1;

        const canvasSize = size - 40;
        canvas.width = canvasSize * dpr;
        canvas.height = canvasSize * dpr;
        canvas.style.width = canvasSize + 'px';
        canvas.style.height = canvasSize + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Glow canvas: full window
        glowCanvas.width = window.innerWidth * dpr;
        glowCanvas.height = window.innerHeight * dpr;
        glowCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

        wheelRadius = canvasSize / 2 - 10;
        centerX = canvasSize / 2;
        centerY = canvasSize / 2;

        if (students.length > 0) {
            draw();
        }
    }

    function generateColors(n) {
        colors = [];
        const goldenAngle = 137.508;
        for (let i = 0; i < n; i++) {
            const hue = (i * goldenAngle) % 360;
            const sat = 70 + (i % 3) * 5;
            const light = 48 + (i % 4) * 4;
            colors.push({ h: hue, s: sat, l: light, css: `hsl(${hue}, ${sat}%, ${light}%)` });
        }
        return colors;
    }

    function setStudents(studentList) {
        students = studentList;
        generateColors(students.length);
        currentAngle = 0;
        previousSegmentIndex = -1;
        draw();
    }

    function draw() {
        if (!ctx || students.length === 0) return;

        const cw = parseInt(canvas.style.width);
        const ch = parseInt(canvas.style.height);
        ctx.clearRect(0, 0, cw, ch);

        const n = students.length;
        const sliceAngle = (Math.PI * 2) / n;

        // Outer ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, wheelRadius + 5, 0, Math.PI * 2);
        ctx.fillStyle = '#2d1b69';
        ctx.fill();
        ctx.strokeStyle = '#6b3fa0';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Segments
        for (let i = 0; i < n; i++) {
            const startAngle = currentAngle + i * sliceAngle - Math.PI / 2;
            const endAngle = startAngle + sliceAngle;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, wheelRadius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = colors[i].css;

            if (neonGlowIntensity > 0) {
                ctx.shadowBlur = 12 * neonGlowIntensity;
                ctx.shadowColor = colors[i].css;
            } else {
                ctx.shadowBlur = 0;
            }
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();

            drawSegmentText(i, startAngle, sliceAngle);
        }

        drawHub();
        drawGlowProjection();
    }

    function drawSegmentText(index, startAngle, sliceAngle) {
        const student = students[index];
        const midAngle = startAngle + sliceAngle / 2;
        const n = students.length;

        const textRadius = wheelRadius * 0.62;
        const tx = centerX + Math.cos(midAngle) * textRadius;
        const ty = centerY + Math.sin(midAngle) * textRadius;

        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(midAngle + Math.PI / 2);

        let fontSize = 18;
        if (n > 12) fontSize = 16;
        if (n > 20) fontSize = 14;
        if (n > 30) fontSize = 12;
        if (n > 45) fontSize = 10;
        if (n > 60) fontSize = 8;

        ctx.font = `bold ${fontSize}px 'Segoe UI', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillText(student.name, 1, 1);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(student.name, 0, 0);

        if (n <= 25 && student.studentId) {
            ctx.font = `${Math.max(fontSize - 3, 7)}px 'Segoe UI', sans-serif`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
            ctx.fillText(student.studentId, 0, fontSize + 2);
        }

        ctx.restore();
    }

    function drawHub() {
        ctx.beginPath();
        ctx.arc(centerX, centerY, hubRadius + 5, 0, Math.PI * 2);
        ctx.fillStyle = '#2d1b69';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();

        const grad = ctx.createRadialGradient(
            centerX - 10, centerY - 10, 5,
            centerX, centerY, hubRadius
        );
        grad.addColorStop(0, '#ff88cc');
        grad.addColorStop(0.5, '#cc44aa');
        grad.addColorStop(1, '#6b2090');

        ctx.beginPath();
        ctx.arc(centerX, centerY, hubRadius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
    }

    // ---- Full-Window Color Light Projection ----
    function drawGlowProjection() {
        if (!glowCtx || students.length === 0) return;

        const w = window.innerWidth;
        const h = window.innerHeight;
        glowCtx.clearRect(0, 0, w, h);

        if (neonGlowIntensity <= 0.01) return;

        // Find the wheel center in screen coordinates
        const canvasRect = canvas.getBoundingClientRect();
        const gcx = canvasRect.left + canvasRect.width / 2;
        const gcy = canvasRect.top + canvasRect.height / 2;

        // Max projection distance = corner of viewport from wheel center
        const maxDist = Math.sqrt(
            Math.max(gcx, w - gcx) ** 2 + Math.max(gcy, h - gcy) ** 2
        ) + 50;

        const n = students.length;
        const sliceAngle = (Math.PI * 2) / n;
        const innerRadius = wheelRadius * (canvasRect.width / parseInt(canvas.style.width)) + 5;

        for (let i = 0; i < n; i++) {
            const startAngle = currentAngle + i * sliceAngle - Math.PI / 2;
            const endAngle = startAngle + sliceAngle;

            const { h: hue, s: sat } = colors[i];
            const alpha = 0.4 * neonGlowIntensity;

            glowCtx.save();

            // Wedge from wheel edge to window edge
            glowCtx.beginPath();
            glowCtx.arc(gcx, gcy, maxDist, startAngle, endAngle);
            glowCtx.arc(gcx, gcy, innerRadius, endAngle, startAngle, true);
            glowCtx.closePath();

            const grad = glowCtx.createRadialGradient(gcx, gcy, innerRadius, gcx, gcy, maxDist);
            grad.addColorStop(0, `hsla(${hue}, ${sat}%, 60%, ${alpha})`);
            grad.addColorStop(0.3, `hsla(${hue}, ${sat}%, 55%, ${alpha * 0.5})`);
            grad.addColorStop(0.7, `hsla(${hue}, ${sat}%, 50%, ${alpha * 0.15})`);
            grad.addColorStop(1, `hsla(${hue}, ${sat}%, 50%, 0)`);

            glowCtx.fillStyle = grad;
            glowCtx.fill();

            glowCtx.restore();
        }
    }

    // ---- Segment Detection ----
    function getCurrentSegmentIndex() {
        const n = students.length;
        if (n === 0) return -1;

        const sliceAngle = (Math.PI * 2) / n;
        let normalized = (-currentAngle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const index = Math.floor(normalized / sliceAngle) % n;
        return index;
    }

    // ---- Spin ----
    // targetIndex: if >= 0, the wheel MUST land on this segment index
    function spin(callback, segmentChangeCallback, targetIndex) {
        if (isSpinning || students.length === 0) return;

        isSpinning = true;
        onWinnerCallback = callback;
        onSegmentChangeCallback = segmentChangeCallback;

        const n = students.length;
        const sliceAngle = (Math.PI * 2) / n;

        // Calculate total rotation needed to land on target
        let totalRotation;
        if (targetIndex >= 0 && targetIndex < n) {
            // We want segment targetIndex at the indicator (top).
            // After spin: getCurrentSegmentIndex() should return targetIndex.
            // That means: (-finalAngle mod 2PI) / sliceAngle = targetIndex
            // So: finalAngle = -(targetIndex * sliceAngle + sliceAngle/2) + full rotations
            // Add random full rotations for visual effect (8-14 full turns)
            const fullTurns = (8 + Math.floor(Math.random() * 7)) * Math.PI * 2;
            // Land in the middle of the target segment
            const targetAngle = -(targetIndex * sliceAngle + sliceAngle * (0.15 + Math.random() * 0.7));
            // Normalize so it's forward from current angle
            totalRotation = fullTurns + ((targetAngle - currentAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        } else {
            // Pure random: just pick a random total rotation
            totalRotation = (8 + Math.floor(Math.random() * 7)) * Math.PI * 2 + Math.random() * Math.PI * 2;
        }

        const finalAngle = currentAngle + totalRotation;

        neonGlowIntensity = 1;
        Effects.setSpinning(true);

        whooshSound = SoundEngine.playWhoosh();
        SoundEngine.playClick();

        previousSegmentIndex = getCurrentSegmentIndex();

        // Use time-based easing instead of per-frame friction for precise landing
        const spinDuration = 4500 + Math.random() * 2500; // 4.5 to 7 seconds
        const startTime = performance.now();
        const startAngle = currentAngle;

        function easeOutQuint(t) {
            return 1 - Math.pow(1 - t, 5);
        }

        function animate(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / spinDuration, 1);
            const easedProgress = easeOutQuint(progress);

            currentAngle = startAngle + totalRotation * easedProgress;

            // Derive angular velocity for sound/effects
            // Derivative of easeOutQuint: 5 * (1 - t)^4 * totalRotation / spinDuration
            const t = progress;
            angularVelocity = 5 * Math.pow(1 - t, 4) * totalRotation / (spinDuration / 1000);

            const maxSpeed = 27;
            neonGlowIntensity = Math.min(1, angularVelocity / (maxSpeed * 0.4));

            if (whooshSound && whooshSound.update) {
                whooshSound.update(Math.min(1, angularVelocity / maxSpeed));
            }

            // Tick detection
            const currentIdx = getCurrentSegmentIndex();
            if (currentIdx !== previousSegmentIndex && currentIdx >= 0) {
                SoundEngine.playTick();
                if (onSegmentChangeCallback && currentIdx < students.length) {
                    onSegmentChangeCallback(students[currentIdx]);
                }
                previousSegmentIndex = currentIdx;
            }

            draw();

            if (progress >= 1) {
                // Done
                currentAngle = finalAngle;
                isSpinning = false;
                angularVelocity = 0;
                neonGlowIntensity = 0;
                Effects.setSpinning(false);

                if (whooshSound && whooshSound.stop) whooshSound.stop();
                whooshSound = null;

                draw();

                const winnerIdx = getCurrentSegmentIndex();
                if (onWinnerCallback && winnerIdx >= 0 && winnerIdx < students.length) {
                    onWinnerCallback(students[winnerIdx]);
                }
                return;
            }

            animFrameId = requestAnimationFrame(animate);
        }

        animFrameId = requestAnimationFrame(animate);
    }

    function isCurrentlySpinning() {
        return isSpinning;
    }

    function getStudents() {
        return students;
    }

    return {
        init,
        resize,
        setStudents,
        draw,
        spin,
        isCurrentlySpinning,
        getCurrentSegmentIndex,
        getStudents
    };
})();
