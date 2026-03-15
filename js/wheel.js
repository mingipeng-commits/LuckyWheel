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

        // Glow projection canvas (larger, behind the wheel)
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

        // Glow canvas: bigger to accommodate projected light
        const glowSize = size + 100;
        glowCanvas.width = glowSize * dpr;
        glowCanvas.height = glowSize * dpr;
        glowCanvas.style.width = glowSize + 'px';
        glowCanvas.style.height = glowSize + 'px';
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

        ctx.clearRect(0, 0, canvas.width / (window.devicePixelRatio || 1) + 100, canvas.height / (window.devicePixelRatio || 1) + 100);

        const n = students.length;
        const sliceAngle = (Math.PI * 2) / n;

        // Draw outer ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, wheelRadius + 5, 0, Math.PI * 2);
        ctx.fillStyle = '#2d1b69';
        ctx.fill();
        ctx.strokeStyle = '#6b3fa0';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw segments
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

        // Draw color projection glow
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

        // Bigger font sizes
        let fontSize = 18;
        if (n > 12) fontSize = 16;
        if (n > 20) fontSize = 14;
        if (n > 30) fontSize = 12;
        if (n > 45) fontSize = 10;
        if (n > 60) fontSize = 8;

        ctx.font = `bold ${fontSize}px 'Segoe UI', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Shadow for readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillText(student.name, 1, 1);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(student.name, 0, 0);

        // Student ID below
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

    // ---- Color Light Projection ----
    function drawGlowProjection() {
        if (!glowCtx || students.length === 0) return;

        const glowSize = parseInt(glowCanvas.style.width);
        const gcx = glowSize / 2;
        const gcy = glowSize / 2;

        glowCtx.clearRect(0, 0, glowSize, glowSize);

        if (neonGlowIntensity <= 0.01) return;

        const n = students.length;
        const sliceAngle = (Math.PI * 2) / n;
        const projectionDistance = wheelRadius + 60 + 40 * neonGlowIntensity;
        const innerRadius = wheelRadius + 5;

        for (let i = 0; i < n; i++) {
            const startAngle = currentAngle + i * sliceAngle - Math.PI / 2;
            const endAngle = startAngle + sliceAngle;
            const midAngle = startAngle + sliceAngle / 2;

            // Create radial gradient from edge of wheel outward
            const gx = gcx + Math.cos(midAngle) * (innerRadius + 20);
            const gy = gcy + Math.sin(midAngle) * (innerRadius + 20);

            const { h, s } = colors[i];
            const alpha = 0.5 * neonGlowIntensity;

            glowCtx.beginPath();
            glowCtx.moveTo(gcx, gcy);
            glowCtx.arc(gcx, gcy, projectionDistance, startAngle, endAngle);
            glowCtx.closePath();

            // Only draw the outer ring (clip out inner)
            glowCtx.save();

            // Outer wedge
            glowCtx.beginPath();
            glowCtx.arc(gcx, gcy, projectionDistance, startAngle, endAngle);
            glowCtx.arc(gcx, gcy, innerRadius, endAngle, startAngle, true);
            glowCtx.closePath();

            const grad = glowCtx.createRadialGradient(gcx, gcy, innerRadius, gcx, gcy, projectionDistance);
            grad.addColorStop(0, `hsla(${h}, ${s}%, 60%, ${alpha})`);
            grad.addColorStop(0.5, `hsla(${h}, ${s}%, 55%, ${alpha * 0.5})`);
            grad.addColorStop(1, `hsla(${h}, ${s}%, 50%, 0)`);

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
    function spin(callback, segmentChangeCallback) {
        if (isSpinning || students.length === 0) return;

        isSpinning = true;
        onWinnerCallback = callback;
        onSegmentChangeCallback = segmentChangeCallback;

        angularVelocity = 15 + Math.random() * 12;
        const friction = 0.985 + Math.random() * 0.007;

        neonGlowIntensity = 1;
        Effects.setSpinning(true);

        whooshSound = SoundEngine.playWhoosh();
        SoundEngine.playClick();

        let lastTime = performance.now();
        previousSegmentIndex = getCurrentSegmentIndex();

        function animate(now) {
            const dt = Math.min((now - lastTime) / 1000, 0.05);
            lastTime = now;

            angularVelocity *= friction;
            currentAngle += angularVelocity * dt;

            const maxSpeed = 27;
            neonGlowIntensity = Math.min(1, angularVelocity / (maxSpeed * 0.4));

            if (whooshSound && whooshSound.update) {
                whooshSound.update(Math.min(1, angularVelocity / maxSpeed));
            }

            const currentIdx = getCurrentSegmentIndex();
            if (currentIdx !== previousSegmentIndex && currentIdx >= 0) {
                SoundEngine.playTick();
                if (onSegmentChangeCallback && currentIdx >= 0 && currentIdx < students.length) {
                    onSegmentChangeCallback(students[currentIdx]);
                }
                previousSegmentIndex = currentIdx;
            }

            draw();

            if (angularVelocity < 0.05) {
                angularVelocity *= 0.95;
            }

            if (angularVelocity < 0.002) {
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
