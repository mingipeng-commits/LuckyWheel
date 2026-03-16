/* ============================================
   Visual Effects - Confetti, Particles
   ============================================ */

const Effects = (() => {
    let confettiCanvas, confettiCtx;
    let confettiParticles = [];
    let confettiAnimId = null;
    let isSpinning = false;

    function setSpinning(val) {
        isSpinning = val;
    }

    // ---- Spin Button Disco Light Show ----
    let buttonAnimId = null;
    let discoHue = 0;

    // Disco color palette — vivid party colors
    const discoColors = [
        { h: 330, s: 100, l: 55 }, // hot pink
        { h: 270, s: 100, l: 60 }, // purple
        { h: 180, s: 100, l: 50 }, // cyan
        { h: 120, s: 100, l: 50 }, // green
        { h: 45,  s: 100, l: 55 }, // gold
        { h: 0,   s: 100, l: 55 }, // red
        { h: 210, s: 100, l: 60 }, // blue
        { h: 300, s: 100, l: 60 }, // magenta
    ];

    function animateSpinButton(btn, timestamp) {
        if (!isSpinning) {
            btn.style.boxShadow = '';
            btn.style.background = '';
            buttonAnimId = null;
            return;
        }

        // Rapid color cycling — 3 offset hues for layered glow
        discoHue = (timestamp / 3) % 360;
        const h1 = discoHue;
        const h2 = (discoHue + 90) % 360;
        const h3 = (discoHue + 200) % 360;
        const h4 = (discoHue + 150) % 360;

        const c1 = `hsl(${h1}, 100%, 60%)`;
        const c2 = `hsl(${h2}, 100%, 55%)`;
        const c3 = `hsl(${h3}, 100%, 60%)`;
        const c4 = `hsl(${h4}, 100%, 50%)`;

        // Pulsing intensity
        const pulse = 0.7 + 0.3 * Math.sin(timestamp / 150);
        const glowSize = Math.round(25 + 20 * pulse);
        const outerGlow = Math.round(50 + 30 * pulse);

        // Multi-layered colored glow + moving background gradient
        btn.style.background = `radial-gradient(circle at ${50 + 20 * Math.sin(timestamp / 400)}% ${40 + 15 * Math.cos(timestamp / 350)}%, ${c1}, ${c4}, #4a0080)`;
        btn.style.boxShadow = `
            0 0 ${glowSize}px ${c1},
            0 0 ${outerGlow}px ${c2},
            0 0 ${outerGlow + 25}px ${c3},
            0 0 ${outerGlow + 50}px ${c4},
            inset 0 -4px 10px rgba(0,0,0,0.3),
            inset 0 4px 10px rgba(255,255,255,0.3)
        `;

        buttonAnimId = requestAnimationFrame((ts) => animateSpinButton(btn, ts));
    }

    function startButtonLightShow(btn) {
        if (buttonAnimId) cancelAnimationFrame(buttonAnimId);
        buttonAnimId = requestAnimationFrame((ts) => animateSpinButton(btn, ts));
    }

    function stopButtonLightShow(btn) {
        if (buttonAnimId) {
            cancelAnimationFrame(buttonAnimId);
            buttonAnimId = null;
        }
        btn.style.boxShadow = '';
        btn.style.background = '';
    }

    // Get current disco hue for wheel to use
    function getDiscoHue() {
        return discoHue;
    }

    // ---- Confetti ----
    function initConfetti() {
        confettiCanvas = document.getElementById('confetti-canvas');
        confettiCtx = confettiCanvas.getContext('2d');
        resizeConfetti();
        window.addEventListener('resize', resizeConfetti);
    }

    function resizeConfetti() {
        if (!confettiCanvas) return;
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
    }

    function launchConfetti(duration = 4000) {
        confettiParticles = [];

        const colors = [
            '#ff00ff', '#00ffff', '#ffff00', '#ff4444',
            '#44ff44', '#ff69b4', '#8b00ff', '#ff8c00',
            '#00ff88', '#ff1493', '#7b68ee', '#ffd700'
        ];

        for (let i = 0; i < 150; i++) {
            confettiParticles.push({
                x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
                y: window.innerHeight / 2,
                vx: (Math.random() - 0.5) * 15,
                vy: -Math.random() * 18 - 5,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 8 + 4,
                rotation: Math.random() * 360,
                rotSpeed: (Math.random() - 0.5) * 15,
                gravity: 0.25 + Math.random() * 0.1,
                opacity: 1,
                shape: Math.random() > 0.5 ? 'rect' : 'circle'
            });
        }

        for (let side = 0; side < 2; side++) {
            for (let i = 0; i < 60; i++) {
                confettiParticles.push({
                    x: side === 0 ? 0 : window.innerWidth,
                    y: window.innerHeight * 0.6,
                    vx: (side === 0 ? 1 : -1) * (Math.random() * 12 + 3),
                    vy: -Math.random() * 15 - 5,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    size: Math.random() * 6 + 3,
                    rotation: Math.random() * 360,
                    rotSpeed: (Math.random() - 0.5) * 10,
                    gravity: 0.2 + Math.random() * 0.1,
                    opacity: 1,
                    shape: Math.random() > 0.3 ? 'rect' : 'circle'
                });
            }
        }

        if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
        const startTime = performance.now();
        animateConfetti(startTime, duration);
    }

    function animateConfetti(startTime, duration) {
        const elapsed = performance.now() - startTime;
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

        confettiParticles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.vx *= 0.99;
            p.rotation += p.rotSpeed;

            if (elapsed > duration * 0.6) {
                p.opacity -= 0.015;
            }

            if (p.opacity <= 0) return;

            confettiCtx.save();
            confettiCtx.translate(p.x, p.y);
            confettiCtx.rotate((p.rotation * Math.PI) / 180);
            confettiCtx.globalAlpha = Math.max(0, p.opacity);
            confettiCtx.fillStyle = p.color;

            if (p.shape === 'rect') {
                confettiCtx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            } else {
                confettiCtx.beginPath();
                confettiCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                confettiCtx.fill();
            }
            confettiCtx.restore();
        });

        confettiParticles = confettiParticles.filter(p => p.opacity > 0 && p.y < window.innerHeight + 50);

        if (confettiParticles.length > 0 && elapsed < duration) {
            confettiAnimId = requestAnimationFrame(() => animateConfetti(startTime, duration));
        } else {
            confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
            confettiAnimId = null;
        }
    }

    // ---- Winner Glow Burst ----
    function showWinnerBurst() {
        const banner = document.getElementById('winner-banner');
        banner.classList.remove('hidden');
        banner.classList.add('show');
    }

    function hideWinnerBurst() {
        const banner = document.getElementById('winner-banner');
        banner.classList.remove('show');
        setTimeout(() => {
            banner.classList.add('hidden');
        }, 500);
    }

    return {
        setSpinning,
        startButtonLightShow,
        stopButtonLightShow,
        getDiscoHue,
        initConfetti,
        launchConfetti,
        showWinnerBurst,
        hideWinnerBurst
    };
})();
