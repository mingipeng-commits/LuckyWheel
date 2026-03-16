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
    let breathingAnimId = null;
    let segmentPhases = [];  // per-segment breathing phase offsets & speed multipliers

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
        segmentPhases = [];
        const goldenAngle = 137.508;
        for (let i = 0; i < n; i++) {
            const hue = (i * goldenAngle) % 360;
            const sat = 70 + (i % 3) * 5;
            const light = 48 + (i % 4) * 4;
            colors.push({ h: hue, s: sat, l: light, css: `hsl(${hue}, ${sat}%, ${light}%)` });
            // Each segment breathes at a different speed with a random phase offset
            segmentPhases.push({
                offset: Math.random() * Math.PI * 2,
                speed: 0.7 + Math.random() * 0.8  // 0.7x to 1.5x base speed
            });
        }
        return colors;
    }

    function setStudents(studentList) {
        students = studentList;
        generateColors(students.length);
        currentAngle = 0;
        previousSegmentIndex = -1;
        draw();
        startBreathing();
    }

    let breatheTimestamp = 0;

    function startBreathing() {
        stopBreathing();
        if (students.length === 0) return;

        function breathe(timestamp) {
            if (isSpinning) {
                breathingAnimId = null;
                return;
            }
            breatheTimestamp = timestamp;
            neonGlowIntensity = 0.2;  // base level for general effects
            draw();
            breathingAnimId = requestAnimationFrame(breathe);
        }
        breathingAnimId = requestAnimationFrame(breathe);
    }

    function stopBreathing() {
        if (breathingAnimId) {
            cancelAnimationFrame(breathingAnimId);
            breathingAnimId = null;
        }
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
            const midAngle = startAngle + sliceAngle / 2;

            const { h: hue, s: sat, l: light } = colors[i];

            // Per-segment breathing intensity
            let segGlow = neonGlowIntensity;
            if (!isSpinning && segmentPhases[i]) {
                const sp = segmentPhases[i];
                segGlow = 0.12 + 0.18 * Math.sin(breatheTimestamp / 1200 * sp.speed + sp.offset);
                segGlow = Math.max(0.02, segGlow);
            }

            // --- 3D segment: base fill with radial gradient ---
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, wheelRadius, startAngle, endAngle);
            ctx.closePath();

            // Radial gradient: lighter at outer edge, darker toward hub
            const grad = ctx.createRadialGradient(centerX, centerY, hubRadius, centerX, centerY, wheelRadius);
            grad.addColorStop(0, `hsl(${hue}, ${sat}%, ${Math.max(light - 12, 20)}%)`);
            grad.addColorStop(0.5, `hsl(${hue}, ${sat}%, ${light}%)`);
            grad.addColorStop(0.85, `hsl(${hue}, ${Math.min(sat + 8, 100)}%, ${light + 8}%)`);
            grad.addColorStop(1, `hsl(${hue}, ${Math.min(sat + 5, 100)}%, ${light + 14}%)`);
            ctx.fillStyle = grad;

            if (segGlow > 0.05) {
                ctx.shadowBlur = 14 * segGlow;
                ctx.shadowColor = `hsl(${hue}, ${sat}%, ${light + 10}%)`;
            } else {
                ctx.shadowBlur = 0;
            }
            ctx.fill();
            ctx.shadowBlur = 0;

            // --- 3D highlight along outer arc ---
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, wheelRadius, startAngle, endAngle);
            ctx.closePath();
            ctx.clip();

            // Bright arc highlight near rim
            const highlightR = wheelRadius - 6;
            const hx1 = centerX + Math.cos(midAngle) * highlightR;
            const hy1 = centerY + Math.sin(midAngle) * highlightR;
            const rimGrad = ctx.createRadialGradient(hx1, hy1, 0, hx1, hy1, wheelRadius * 0.35);
            rimGrad.addColorStop(0, `hsla(${hue}, 100%, ${light + 30}%, ${0.4 + segGlow * 0.6})`);
            rimGrad.addColorStop(1, `hsla(${hue}, ${sat}%, ${light}%, 0)`);
            ctx.fillStyle = rimGrad;
            ctx.fill();

            // Inner shadow near hub
            const innerGrad = ctx.createRadialGradient(centerX, centerY, hubRadius * 0.5, centerX, centerY, wheelRadius * 0.45);
            innerGrad.addColorStop(0, `rgba(0, 0, 0, 0.2)`);
            innerGrad.addColorStop(1, `rgba(0, 0, 0, 0)`);
            ctx.fillStyle = innerGrad;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, wheelRadius, startAngle, endAngle);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // --- 3D beveled edges between segments ---
            // Light edge (top/left of boundary)
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(
                centerX + Math.cos(startAngle) * wheelRadius,
                centerY + Math.sin(startAngle) * wheelRadius
            );
            ctx.strokeStyle = `hsla(${hue}, ${Math.min(sat + 10, 100)}%, ${Math.min(light + 30, 95)}%, 0.85)`;
            ctx.lineWidth = 4;
            ctx.stroke();

            // Dark edge (bottom/right of boundary)
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(
                centerX + Math.cos(endAngle) * wheelRadius,
                centerY + Math.sin(endAngle) * wheelRadius
            );
            ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${Math.max(light - 25, 5)}%, 0.9)`;
            ctx.lineWidth = 4;
            ctx.stroke();

            // Outer arc rim highlight
            ctx.beginPath();
            ctx.arc(centerX, centerY, wheelRadius - 1.5, startAngle, endAngle);
            ctx.strokeStyle = `hsla(${hue}, 100%, ${light + 22}%, 0.5)`;
            ctx.lineWidth = 3;
            ctx.stroke();

            // Inner groove near hub
            ctx.beginPath();
            ctx.arc(centerX, centerY, hubRadius + 8, startAngle, endAngle);
            ctx.strokeStyle = `rgba(0, 0, 0, 0.45)`;
            ctx.lineWidth = 2.5;
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

        let fontSize = 20;
        if (n > 12) fontSize = 18;
        if (n > 20) fontSize = 15;
        if (n > 30) fontSize = 12;
        if (n > 45) fontSize = 10;
        if (n > 60) fontSize = 8;

        ctx.save();
        ctx.font = `bold ${fontSize}px 'Segoe UI', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Draw text radially from rim inward to center
        // Name first (near rim), then student ID (toward center)
        // Character tops always face the rim (midAngle + PI/2)
        const name = student.name;
        const charSpacing = fontSize * 1.15;
        const availableLen = wheelRadius - hubRadius - 30;

        // Calculate total chars (name + space + id) for spacing
        const hasId = n <= 25 && student.studentId;
        const idStr = hasId ? student.studentId : '';
        const totalChars = name.length + (idStr ? 1 + idStr.length : 0);
        const actualSpacing = Math.min(charSpacing, availableLen / Math.max(totalChars, 1));

        // Start near rim, move inward
        const startR = wheelRadius - 14;

        // Unified rotation: character tops always point toward rim
        const charRotation = midAngle + Math.PI / 2;

        // Draw name characters (bold, larger for CJK) — name first, near rim
        const isCJK = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(name);
        if (isCJK) {
            const cjkSize = Math.min(fontSize + 8, actualSpacing * 0.95, sliceAngle * wheelRadius * 0.45);
            ctx.font = `bold ${cjkSize}px 'Microsoft JhengHei', 'PingFang TC', 'Noto Sans TC', sans-serif`;
        }

        for (let c = 0; c < name.length; c++) {
            const r = startR - c * actualSpacing;
            if (r < hubRadius + 12) break;

            const cx = centerX + Math.cos(midAngle) * r;
            const cy = centerY + Math.sin(midAngle) * r;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(charRotation);

            // Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.fillText(name[c], 1, 1);
            // White text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(name[c], 0, 0);

            ctx.restore();
        }

        // Draw student ID (smaller, continuing inward after name)
        if (hasId) {
            const idFontSize = Math.max(fontSize - 3, 7);
            ctx.font = `${idFontSize}px 'Segoe UI', sans-serif`;

            const idStartR = startR - (name.length + 1) * actualSpacing;
            for (let c = 0; c < idStr.length; c++) {
                const r = idStartR - c * idFontSize * 1.0;
                if (r < hubRadius + 10) break;

                const cx = centerX + Math.cos(midAngle) * r;
                const cy = centerY + Math.sin(midAngle) * r;

                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(charRotation);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
                ctx.fillText(idStr[c], 0, 0);
                ctx.restore();
            }
        }

        ctx.restore();
    }

    function drawHub() {
        // During spin: draw disco glow radiating from center onto wheel surface
        if (isSpinning) {
            const dh = Effects.getDiscoHue();
            const h1 = dh;
            const h2 = (dh + 120) % 360;
            const h3 = (dh + 240) % 360;
            const glowRadius = wheelRadius * 0.55;
            const alpha = Math.min(0.35, neonGlowIntensity * 0.35);

            // Primary glow
            const glow1 = ctx.createRadialGradient(centerX, centerY, hubRadius, centerX, centerY, glowRadius);
            glow1.addColorStop(0, `hsla(${h1}, 100%, 65%, ${alpha})`);
            glow1.addColorStop(0.5, `hsla(${h2}, 100%, 55%, ${alpha * 0.4})`);
            glow1.addColorStop(1, `hsla(${h3}, 100%, 50%, 0)`);
            ctx.beginPath();
            ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
            ctx.fillStyle = glow1;
            ctx.fill();

            // Secondary offset glow for depth
            const glow2 = ctx.createRadialGradient(centerX, centerY, hubRadius * 0.5, centerX, centerY, glowRadius * 0.7);
            glow2.addColorStop(0, `hsla(${h3}, 100%, 70%, ${alpha * 0.6})`);
            glow2.addColorStop(1, `hsla(${h1}, 100%, 50%, 0)`);
            ctx.beginPath();
            ctx.arc(centerX, centerY, glowRadius * 0.7, 0, Math.PI * 2);
            ctx.fillStyle = glow2;
            ctx.fill();
        }

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

            // Per-segment glow intensity
            let segIntensity = neonGlowIntensity;
            if (!isSpinning && segmentPhases[i]) {
                const sp = segmentPhases[i];
                segIntensity = 0.12 + 0.18 * Math.sin(breatheTimestamp / 1200 * sp.speed + sp.offset);
                segIntensity = Math.max(0.02, segIntensity);
            }

            const alpha = 0.45 * segIntensity;

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

    // ---- Indicator Ticker Wiggle ----
    let tickerArrow = null;
    let tickerPhase = 0;
    const TICKER_FAST_THRESHOLD = 8; // angular velocity threshold for fast vs slow mode

    // Two-phase ticker:
    // Phase 1 (high speed): rapid random-like oscillation simulating blur
    // Phase 2 (low speed): triggered bump on each segment boundary
    function updateTickerWiggle(velocity) {
        if (!tickerArrow) tickerArrow = document.querySelector('.indicator-arrow');
        if (!tickerArrow) return;

        if (velocity >= TICKER_FAST_THRESHOLD) {
            // Phase 1: Fast — rapid oscillation, large amplitude
            tickerArrow.classList.remove('tick');
            const amplitude = Math.min(18, 6 + velocity * 0.5);
            const freq = 30 + velocity * 1.5;
            tickerPhase += freq * 0.016;
            // Add a secondary harmonic for more chaotic look
            const angle = Math.sin(tickerPhase) * amplitude * 0.7
                        + Math.sin(tickerPhase * 2.7) * amplitude * 0.3;
            tickerArrow.style.transform = `translateX(-50%) rotate(${angle}deg)`;
        } else if (velocity > 0.3) {
            // Phase 2: Slow — clear transform, let segment-tick CSS handle it
            tickerArrow.style.transform = '';
        } else {
            tickerArrow.style.transform = '';
        }
    }

    function triggerTickBump() {
        if (!tickerArrow) tickerArrow = document.querySelector('.indicator-arrow');
        if (!tickerArrow) return;
        // Only show CSS tick bump when in slow phase
        if (angularVelocity < TICKER_FAST_THRESHOLD) {
            tickerArrow.classList.remove('tick');
            void tickerArrow.offsetWidth;
            tickerArrow.classList.add('tick');
        }
    }

    function resetTicker() {
        if (!tickerArrow) tickerArrow = document.querySelector('.indicator-arrow');
        if (tickerArrow) {
            tickerArrow.style.transform = '';
            tickerArrow.classList.remove('tick');
        }
        tickerPhase = 0;
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
        stopBreathing();
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

            // Continuous ticker wiggle based on speed
            updateTickerWiggle(angularVelocity);

            // Tick detection
            const currentIdx = getCurrentSegmentIndex();
            if (currentIdx !== previousSegmentIndex && currentIdx >= 0) {
                SoundEngine.playTick();
                triggerTickBump();
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
                resetTicker();
                Effects.setSpinning(false);

                if (whooshSound && whooshSound.stop) whooshSound.stop();
                whooshSound = null;

                draw();
                startBreathing();

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
