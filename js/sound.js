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

    // Spin button launch sound — rising swoosh + punchy impact
    function playClick() {
        const ctx = ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;

        // Rising sweep
        const sweep = ctx.createOscillator();
        const sweepGain = ctx.createGain();
        sweep.type = 'sawtooth';
        sweep.frequency.setValueAtTime(200, now);
        sweep.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
        sweepGain.gain.setValueAtTime(0.15, now);
        sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        const sweepFilter = ctx.createBiquadFilter();
        sweepFilter.type = 'lowpass';
        sweepFilter.frequency.value = 2000;
        sweep.connect(sweepFilter);
        sweepFilter.connect(sweepGain);
        sweepGain.connect(ctx.destination);
        sweep.start(now);
        sweep.stop(now + 0.25);

        // Impact thud
        const thud = ctx.createOscillator();
        const thudGain = ctx.createGain();
        thud.type = 'sine';
        thud.frequency.setValueAtTime(150, now + 0.18);
        thud.frequency.exponentialRampToValueAtTime(40, now + 0.4);
        thudGain.gain.setValueAtTime(0.25, now + 0.18);
        thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        thud.connect(thudGain);
        thudGain.connect(ctx.destination);
        thud.start(now + 0.18);
        thud.stop(now + 0.4);

        // Bright ping accent
        const ping = ctx.createOscillator();
        const pingGain = ctx.createGain();
        ping.type = 'sine';
        ping.frequency.value = 1400;
        pingGain.gain.setValueAtTime(0.12, now + 0.19);
        pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        ping.connect(pingGain);
        pingGain.connect(ctx.destination);
        ping.start(now + 0.19);
        ping.stop(now + 0.45);
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

    // ---- Spin Music: upbeat synth loop ----
    let spinMusicNodes = null;

    function playSpinMusic() {
        const ctx = ensureContext();
        if (!ctx) return;
        stopSpinMusic(); // stop any previous

        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        masterGain.connect(ctx.destination);
        // Fade in
        masterGain.gain.setTargetAtTime(0.18, ctx.currentTime, 0.3);

        const bpm = 140;
        const beatSec = 60 / bpm;
        const barSec = beatSec * 4;
        const now = ctx.currentTime;

        // --- Bass line (looping pattern) ---
        const bassGain = ctx.createGain();
        bassGain.gain.value = 0.22;
        bassGain.connect(masterGain);

        // Bass notes: C3 D3 E3 G3 pattern repeated, 8th notes
        const bassNotes = [
            130.81, 130.81, 146.83, 146.83, 164.81, 164.81, 196.00, 196.00,
            174.61, 174.61, 164.81, 164.81, 146.83, 146.83, 130.81, 196.00
        ];
        const totalBeats = bassNotes.length;
        const noteLen = beatSec / 2; // 8th notes
        const loopDuration = totalBeats * noteLen;

        // We schedule enough loops to cover ~10 seconds of spinning
        const loopCount = Math.ceil(10 / loopDuration);
        const bassOscs = [];

        for (let loop = 0; loop < loopCount; loop++) {
            for (let i = 0; i < totalBeats; i++) {
                const osc = ctx.createOscillator();
                const env = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.value = bassNotes[i];

                const t = now + loop * loopDuration + i * noteLen;
                env.gain.setValueAtTime(0, t);
                env.gain.linearRampToValueAtTime(0.25, t + 0.01);
                env.gain.setValueAtTime(0.25, t + noteLen * 0.7);
                env.gain.exponentialRampToValueAtTime(0.001, t + noteLen * 0.95);

                // Low-pass filter for warmth
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 500;
                filter.Q.value = 2;

                osc.connect(filter);
                filter.connect(env);
                env.connect(bassGain);
                osc.start(t);
                osc.stop(t + noteLen);
                bassOscs.push(osc);
            }
        }

        // --- Melody (catchy synth lead) ---
        const melodyGain = ctx.createGain();
        melodyGain.gain.value = 0.12;
        melodyGain.connect(masterGain);

        // Upbeat melody: C4 E4 G4 A4 G4 E4 D4 C4, then variation
        const melodyPattern = [
            { freq: 523.25, dur: 1 },   // C5
            { freq: 659.25, dur: 0.5 }, // E5
            { freq: 783.99, dur: 0.5 }, // G5
            { freq: 880.00, dur: 1 },   // A5
            { freq: 783.99, dur: 0.5 }, // G5
            { freq: 659.25, dur: 0.5 }, // E5
            { freq: 587.33, dur: 1 },   // D5
            { freq: 523.25, dur: 1 },   // C5
            // variation
            { freq: 659.25, dur: 0.5 }, // E5
            { freq: 783.99, dur: 0.5 }, // G5
            { freq: 880.00, dur: 0.5 }, // A5
            { freq: 1046.50, dur: 1 },  // C6
            { freq: 880.00, dur: 0.5 }, // A5
            { freq: 783.99, dur: 0.5 }, // G5
            { freq: 659.25, dur: 0.5 }, // E5
            { freq: 523.25, dur: 1 },   // C5
        ];

        const melodyOscs = [];
        const melodyLoopDur = melodyPattern.reduce((sum, n) => sum + n.dur * beatSec, 0);
        const melodyLoops = Math.ceil(10 / melodyLoopDur);

        for (let loop = 0; loop < melodyLoops; loop++) {
            let offset = 0;
            for (const note of melodyPattern) {
                const osc = ctx.createOscillator();
                const env = ctx.createGain();
                osc.type = 'square';
                osc.frequency.value = note.freq;

                const dur = note.dur * beatSec;
                const t = now + loop * melodyLoopDur + offset;

                env.gain.setValueAtTime(0, t);
                env.gain.linearRampToValueAtTime(0.18, t + 0.02);
                env.gain.setValueAtTime(0.15, t + dur * 0.6);
                env.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.95);

                // Slight detuning for richness
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 2500;

                osc.connect(filter);
                filter.connect(env);
                env.connect(melodyGain);
                osc.start(t);
                osc.stop(t + dur);
                melodyOscs.push(osc);

                offset += dur;
            }
        }

        // --- Hi-hat rhythm ---
        const hatGain = ctx.createGain();
        hatGain.gain.value = 0.06;
        hatGain.connect(masterGain);

        const hatCount = Math.ceil(10 / (beatSec / 2));
        const hatOscs = [];

        for (let i = 0; i < hatCount; i++) {
            const bufferSize = Math.floor(ctx.sampleRate * 0.04);
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let j = 0; j < bufferSize; j++) {
                data[j] = (Math.random() * 2 - 1);
            }

            const src = ctx.createBufferSource();
            src.buffer = buffer;

            const env = ctx.createGain();
            const t = now + i * beatSec / 2;
            // Accent on beat 1 and 3
            const accent = (i % 4 === 0 || i % 4 === 2) ? 1.0 : 0.5;
            env.gain.setValueAtTime(accent, t);
            env.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

            const hpf = ctx.createBiquadFilter();
            hpf.type = 'highpass';
            hpf.frequency.value = 8000;

            src.connect(hpf);
            hpf.connect(env);
            env.connect(hatGain);
            src.start(t);
            hatOscs.push(src);
        }

        spinMusicNodes = {
            masterGain,
            allOscs: [...bassOscs, ...melodyOscs, ...hatOscs],
            ctx
        };
    }

    function stopSpinMusic() {
        if (!spinMusicNodes) return;
        const { masterGain, allOscs, ctx } = spinMusicNodes;
        const now = ctx.currentTime;

        // Fade out over 0.5s
        masterGain.gain.setTargetAtTime(0, now, 0.15);

        // Stop all oscillators after fade
        setTimeout(() => {
            allOscs.forEach(osc => {
                try { osc.stop(); } catch (e) {}
            });
        }, 800);

        spinMusicNodes = null;
    }

    return {
        init,
        playTick,
        playClick,
        playWhoosh,
        playFanfare,
        playDrumRoll,
        playSpinMusic,
        stopSpinMusic
    };
})();
