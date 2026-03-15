/* ============================================
   Wheel Rendering & Spin Animation
   ============================================ */

const LuckyWheel = (() => {
    let canvas, ctx;
    let students = [];
    let colors = [];
    let currentAngle = 0;       // radians, cumulative rotation
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
    const hubRadius = 55;  // inner hub circle

    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        resize();
        window.addEventListener('resize', resize);
    }

    function resize() {
        const frame = canvas.parentElement;
        const size = Math.min(frame.clientWidth, frame.clientHeight);
        const dpr = window.devicePixelRatio || 1;

        // Leave space for rim lights
        const canvasSize = size - 40;
        canvas.width = canvasSize * dpr;
        canvas.height = canvasSize * dpr;
        canvas.style.width = canvasSize + 'px';
        canvas.style.height = canvasSize + 'px';

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        wheelRadius = canvasSize / 2 - 10;
        centerX = canvasSize / 2;
        centerY = canvasSize / 2;

        if (students.length > 0) {
            draw();
        }
    }

    function generateColors(n) {
        colors = [];
        // Use golden angle for better color distribution
        const goldenAngle = 137.508;
        for (let i = 0; i < n; i++) {
            const hue = (i * goldenAngle) % 360;
            const sat = 70 + (i % 3) * 5;
            const light = 48 + (i % 4) * 4;
            colors.push(`hsl(${hue}, ${sat}%, ${light}%)`);
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

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const n = students.length;
        const sliceAngle = (Math.PI * 2) / n;

        // Draw outer ring (purple border)
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

            // Segment fill
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, wheelRadius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = colors[i];

            // Neon glow effect during spin
            if (neonGlowIntensity > 0) {
                ctx.shadowBlur = 15 * neonGlowIntensity;
                ctx.shadowColor = colors[i];
            } else {
                ctx.shadowBlur = 0;
            }
            ctx.fill();
            ctx.shadowBlur = 0;

            // Segment border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Draw text
            drawSegmentText(i, startAngle, sliceAngle);
        }

        // Draw center hub
        drawHub();
    }

    function drawSegmentText(index, startAngle, sliceAngle) {
        const student = students[index];
        const midAngle = startAngle + sliceAngle / 2;
        const n = students.length;

        // Text positioning
        const textRadius = wheelRadius * 0.65;
        const tx = centerX + Math.cos(midAngle) * textRadius;
        const ty = centerY + Math.sin(midAngle) * textRadius;

        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(midAngle + Math.PI / 2);

        // Determine font size based on number of students
        let fontSize = 14;
        if (n > 20) fontSize = 11;
        if (n > 35) fontSize = 9;
        if (n > 50) fontSize = 7;

        ctx.font = `bold ${fontSize}px 'Segoe UI', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Text shadow for readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillText(student.name, 1, 1);

        // Main text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(student.name, 0, 0);

        // Student ID below name (if space allows)
        if (n <= 30 && student.studentId) {
            ctx.font = `${fontSize - 2}px 'Segoe UI', sans-serif`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillText(student.studentId, 0, fontSize + 2);
        }

        ctx.restore();
    }

    function drawHub() {
        // Outer hub ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, hubRadius + 5, 0, Math.PI * 2);
        ctx.fillStyle = '#2d1b69';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner hub gradient
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

    // ---- Segment Detection ----
    function getCurrentSegmentIndex() {
        const n = students.length;
        if (n === 0) return -1;

        const sliceAngle = (Math.PI * 2) / n;
        // Indicator is at the top (12 o'clock = -PI/2 in canvas coords)
        // We need to find which segment is at that position
        // currentAngle is the rotation offset; segments are drawn starting from currentAngle - PI/2
        // The indicator position in "wheel space" is: -currentAngle (normalized)
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

        // Randomized initial velocity and friction
        angularVelocity = 15 + Math.random() * 12;  // rad/s
        const friction = 0.985 + Math.random() * 0.007; // per frame decay

        // Start effects
        neonGlowIntensity = 1;
        Effects.setSpinning(true);

        // Start whoosh sound
        whooshSound = SoundEngine.playWhoosh();

        // Play button click
        SoundEngine.playClick();

        let lastTime = performance.now();
        previousSegmentIndex = getCurrentSegmentIndex();

        function animate(now) {
            const dt = Math.min((now - lastTime) / 1000, 0.05); // cap dt
            lastTime = now;

            // Apply friction
            angularVelocity *= friction;

            // Update angle
            currentAngle += angularVelocity * dt;

            // Neon glow fades as wheel slows
            const maxSpeed = 27;
            neonGlowIntensity = Math.min(1, angularVelocity / (maxSpeed * 0.5));

            // Update whoosh sound
            if (whooshSound && whooshSound.update) {
                whooshSound.update(Math.min(1, angularVelocity / maxSpeed));
            }

            // Tick detection
            const currentIdx = getCurrentSegmentIndex();
            if (currentIdx !== previousSegmentIndex && currentIdx >= 0) {
                SoundEngine.playTick();
                if (onSegmentChangeCallback && currentIdx >= 0 && currentIdx < students.length) {
                    onSegmentChangeCallback(students[currentIdx]);
                }
                previousSegmentIndex = currentIdx;
            }

            // Redraw
            draw();

            // Check stop condition
            if (angularVelocity < 0.05) {
                // Final slowdown with more precision
                angularVelocity *= 0.95;
            }

            if (angularVelocity < 0.002) {
                // Stopped
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
