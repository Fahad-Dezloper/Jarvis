// Offline fallback audio: renders a short generative lofi-style loop (soft pad,
// arpeggio, bass, light hats) with WebAudio into a WAV blob. The blob URL is
// used as a normal track URL, so play, pause, volume and seeking all work
// through the existing audio element. Browser-only.

const SAMPLE_RATE = 22050;
const BARS = 8;

const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const CHORD_TONES = { m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11] };

export function synthSupported() {
  return (
    typeof window !== "undefined" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function" &&
    !!(window.OfflineAudioContext || window.webkitOfflineAudioContext)
  );
}

function encodeWav(samples, rate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (off, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** Length in seconds of a rendered track for a spec. */
export function trackSeconds(spec) {
  const beat = 60 / spec.bpm;
  return Math.round(BARS * 4 * beat);
}

async function render(spec) {
  const Ctor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const beat = 60 / spec.bpm;
  const bar = beat * 4;
  const total = bar * BARS + 1.5; // tail for the release
  const ctx = new Ctor(1, Math.ceil(total * SAMPLE_RATE), SAMPLE_RATE);

  const master = ctx.createGain();
  master.gain.value = 0.55;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 2600;
  master.connect(tone);
  tone.connect(ctx.destination);

  // Soft echo on the arpeggio.
  const echo = ctx.createDelay(1);
  echo.delayTime.value = beat * 0.75;
  const echoGain = ctx.createGain();
  echoGain.gain.value = 0.28;
  echo.connect(echoGain);
  echoGain.connect(echo);
  echoGain.connect(master);

  const env = (gain, t, attack, hold, release, peak) => {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.setValueAtTime(peak, t + attack + hold);
    gain.gain.linearRampToValueAtTime(0.0001, t + attack + hold + release);
  };

  const voice = (type, freq, t, attack, hold, release, peak, dest, detune = 0) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    env(g, t, attack, hold, release, peak);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + attack + hold + release + 0.05);
  };

  // Hat noise buffer.
  const noise = ctx.createBuffer(1, SAMPLE_RATE, SAMPLE_RATE);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  for (let b = 0; b < BARS; b++) {
    const [offset, quality] = spec.chords[b % spec.chords.length];
    const t0 = b * bar;
    const tones = CHORD_TONES[quality].map((n) => spec.root + offset + n);

    // Pad: two slightly detuned saws through the master lowpass.
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 900;
    padFilter.connect(master);
    for (const n of tones) {
      voice("sawtooth", midiToHz(n), t0, 0.5, bar - 0.9, 0.7, 0.045, padFilter, -6);
      voice("sawtooth", midiToHz(n), t0, 0.5, bar - 0.9, 0.7, 0.045, padFilter, 7);
    }

    // Bass on beats 1 and 3.
    const bassHz = midiToHz(spec.root + offset - 12);
    voice("sine", bassHz, t0, 0.02, beat * 1.4, 0.3, 0.32, master);
    voice("sine", bassHz, t0 + beat * 2, 0.02, beat * 1.2, 0.3, 0.26, master);

    // Arpeggio on eighth notes.
    for (let i = 0; i < 8; i++) {
      const idx = spec.arp[i % spec.arp.length] % tones.length;
      const hz = midiToHz(tones[idx] + 12);
      const t = t0 + i * (beat / 2);
      voice("triangle", hz, t, 0.01, 0.05, beat * 0.55, 0.11, i % 2 ? echo : master);
    }

    // Light hats on the off-beats.
    for (let i = 0; i < 4; i++) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 7000;
      const g = ctx.createGain();
      const t = t0 + i * beat + beat / 2;
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      src.connect(hp);
      hp.connect(g);
      g.connect(master);
      src.start(t);
      src.stop(t + 0.1);
    }
  }

  const rendered = await ctx.startRendering();
  const data = rendered.getChannelData(0);
  // Fade the very end so a loop boundary never clicks.
  const fade = Math.min(data.length, Math.floor(SAMPLE_RATE * 0.4));
  for (let i = 0; i < fade; i++) data[data.length - 1 - i] *= i / fade;
  return encodeWav(data, SAMPLE_RATE);
}

const urlCache = new Map();

/** Resolves to a blob URL for the spec, rendering it once. */
export function synthTrackUrl(key, spec) {
  if (!urlCache.has(key)) {
    urlCache.set(
      key,
      render(spec).then((blob) => URL.createObjectURL(blob)),
    );
    urlCache.get(key).catch(() => urlCache.delete(key));
  }
  return urlCache.get(key);
}
