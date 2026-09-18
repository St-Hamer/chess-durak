/**
 * Sound synthesizer using Web Audio API (no external asset dependencies)
 */
class SoundEffects {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, type, duration, gain = 0.15, decay = true) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gainNode.gain.setValueAtTime(gain, this.ctx.currentTime);
            if (decay) {
                gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            }

            osc.connect(gainNode);
            gainNode.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            console.warn('Audio error:', e);
        }
    }

    move() {
        this.playTone(320, 'sine', 0.08, 0.12);
    }

    capture() {
        this.playTone(180, 'triangle', 0.15, 0.25);
        setTimeout(() => this.playTone(280, 'sine', 0.12, 0.15), 50);
    }

    check() {
        this.playTone(520, 'square', 0.1, 0.15);
        setTimeout(() => this.playTone(680, 'square', 0.15, 0.18), 80);
    }

    spawn() {
        this.playTone(440, 'triangle', 0.1, 0.1);
        setTimeout(() => this.playTone(587.33, 'triangle', 0.15, 0.12), 60);
        setTimeout(() => this.playTone(880, 'sine', 0.18, 0.1), 120);
    }

    victory() {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
            setTimeout(() => this.playTone(freq, 'triangle', 0.3, 0.2), idx * 120);
        });
    }

    defeat() {
        const notes = [440, 370, 311, 220];
        notes.forEach((freq, idx) => {
            setTimeout(() => this.playTone(freq, 'sawtooth', 0.35, 0.15), idx * 140);
        });
    }
}

export const sounds = new SoundEffects();
