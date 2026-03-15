/* ============================================
   Sound Effects - Web Audio API Synthesizer
   ============================================ */

const SoundEngine = (() => {
    let audioCtx = null;
    let initialized = false;

    function init() {
        if (initialized) return;
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            initialized = true;
        } catch (e) {
            console.warn('Web Audio API not available:', e);
        }
    }

    function ensureContext() {
        if (!audioCtx) init();
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    // Short click/tick sound
    function playTick() {
        const ctx = ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.03);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.06);
    }

    // Button click pop
    function playClick() {
        const ctx = ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.1);
    }

    // Spinning whoosh (continuous, returns stop function)
    function playWhoosh() {
        const ctx = ensureContext();
        if (!ctx) return () => {};

        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.5;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 400;
        filter.Q.value = 1.5;

        const gain = ctx.createGain();
        gain.gain.value = 0;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();

        return {
            update(speed) {
                // speed: 0 to 1 (normalized)
                const now = ctx.currentTime;
                gain.gain.setTargetAtTime(speed * 0.12, now, 0.05);
                filter.frequency.setTargetAtTime(200 + speed * 800, now, 0.05);
            },
            stop() {
                const now = ctx.currentTime;
                gain.gain.setTargetAtTime(0, now, 0.1);
                setTimeout(() => {
                    try { noise.stop(); } catch (e) {}
                }, 500);
            }
        };
    }

    // Winner fanfare
    function playFanfare() {
        const ctx = ensureContext();
        if (!ctx) return;

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        const now = ctx.currentTime;

        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'square';
            osc.frequency.value = freq;

            const startTime = now + i * 0.15;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
            gain.gain.setValueAtTime(0.15, startTime + 0.2);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + 0.6);
        });

        // Add a shimmer
        setTimeout(() => {
            for (let i = 0; i < 3; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const t = ctx.currentTime + i * 0.08;

                osc.type = 'sine';
                osc.frequency.value = 2000 + i * 500;
                gain.gain.setValueAtTime(0.08, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t);
                osc.stop(t + 0.3);
            }
        }, 600);
    }

    // Drum roll for excitement
    function playDrumRoll(duration = 2000) {
        const ctx = ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const numHits = Math.floor(duration / 50);

        for (let i = 0; i < numHits; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const t = now + (i * duration / 1000) / numHits;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.exponentialRampToValueAtTime(80, t + 0.03);

            const vol = 0.05 + (i / numHits) * 0.1; // crescendo
            gain.gain.setValueAtTime(vol, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.04);
        }
    }

    return {
        init,
        playTick,
        playClick,
        playWhoosh,
        playFanfare,
        playDrumRoll
    };
})();
