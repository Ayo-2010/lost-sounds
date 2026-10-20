const EXHIBITS = [
  {
    id: "rain",
    numeral: "I",
    accession: "LS–001",
    title: "Rain on a Tin Roof",
    kicker: "Specimen I · Field recording, reconstructed",
    place: "Stoke Newington, London",
    recorded: "1962, by a resident",
    medium: "Water on galvanised steel",
    condition: "Faint hiss. Do not restore.",
    duration: 52,
    note: "A galvanised roof, a slow front from the west, and the particular hollowness of a room with nothing left inside it.",
    make: makeRain
  },
  {
    id: "bell",
    numeral: "II",
    accession: "LS–002",
    title: "The Distant Bell",
    kicker: "Specimen II · Bell study, after memory",
    place: "Santa Maria, Lisbon",
    recorded: "1954, at dusk",
    medium: "Bronze, air, distance",
    condition: "Weathering at the strike note.",
    duration: 48,
    note: "Heard across three streets and one wall, the bell arrived with more air than metal in it. Listen for the note that never quite lands.",
    make: makeBell
  },
  {
    id: "crossing",
    numeral: "III",
    accession: "LS–003",
    title: "Crossing at Dusk",
    kicker: "Specimen III · Machine and warning",
    place: "Ghent, Belgium",
    recorded: "1971, from a bedroom window",
    medium: "Steel rail, warning bell, night air",
    condition: "Rhythm intact; horn incomplete.",
    duration: 60,
    note: "The barrier came down before the train was visible. For eleven seconds the street belonged to a sound that had not yet arrived.",
    make: makeTrain
  },
  {
    id: "room",
    numeral: "IV",
    accession: "LS–004",
    title: "Room Tone, Empty House",
    kicker: "Specimen IV · An absence, measured",
    place: "Kyoto, Japan",
    recorded: "1988, after the furniture left",
    medium: "Air, timber, a distant mains hum",
    condition: "Almost nothing. Handle with care.",
    duration: 45,
    note: "Recorded at four in the afternoon with the windows closed. What remains is the house listening to itself, and a refrigerator two rooms away.",
    make: makeRoom
  },
  {
    id: "ice",
    numeral: "V",
    accession: "LS–005",
    title: "Ice Giving Way",
    kicker: "Specimen V · Thermal fracture",
    place: "Lake Baikal, Siberia",
    recorded: "1977, at first light",
    medium: "Black ice, changing pressure",
    condition: "Unstable. Sound may shift.",
    duration: 50,
    note: "A lake a mile deep, sealed under a metre of clear ice. It speaks in long sentences and then, without warning, a single sharp word.",
    make: makeIce
  },
  {
    id: "foghorn",
    numeral: "VI",
    accession: "LS–006",
    title: "Foghorn, Cape Wrath",
    kicker: "Specimen VI · Signal in sea fret",
    place: "Scottish Highlands",
    recorded: "1966, from the shore road",
    medium: "Compressed air, salt, low cloud",
    condition: "Distant. Audible for six miles.",
    duration: 56,
    note: "Every ninety seconds the horn described the coast to ships that could not see it. Between calls, only the sea rehearsing its own low notes.",
    make: makeFoghorn
  }
];

const STORAGE_FAVOURITES = "lost-sounds-favourites-v1";
const STORAGE_VOLUME = "lost-sounds-volume-v1";

const state = {
  currentId: EXHIBITS[0].id,
  playing: false,
  volume: 0.7,
  favourites: new Set(),
  filter: "all",
  startedAt: 0,
  elapsed: 0,
  duration: EXHIBITS[0].duration
};

let audioCtx = null;
let master = null;
let analyser = null;
let activeVoice = null;
let progressTimer = null;
let whiteBuffer = null;
let brownBuffer = null;
let waveformData = null;
let scopeResizePending = true;

const els = {
  list: document.getElementById("exhibit-list"),
  count: document.getElementById("exhibit-count"),
  empty: document.getElementById("catalogue-empty"),
  no: document.getElementById("exhibit-no"),
  kicker: document.getElementById("exhibit-kicker"),
  title: document.getElementById("exhibit-title"),
  sub: document.getElementById("exhibit-sub"),
  plaque: document.getElementById("plaque"),
  favourite: document.getElementById("favourite"),
  favouriteLabel: document.getElementById("favourite-label"),
  play: document.getElementById("play"),
  playLabel: document.getElementById("play-label"),
  playHint: document.getElementById("play-hint"),
  volume: document.getElementById("volume"),
  volumeValue: document.getElementById("volume-value"),
  duration: document.getElementById("duration"),
  progress: document.getElementById("progress"),
  progressFill: document.getElementById("progress-fill"),
  scope: document.getElementById("scope"),
  scopeState: document.getElementById("scope-state"),
  scopeTime: document.getElementById("scope-time"),
  note: document.getElementById("exhibit-note"),
  metaOrigin: document.getElementById("meta-origin"),
  metaRecorded: document.getElementById("meta-recorded"),
  metaMedium: document.getElementById("meta-medium"),
  metaCondition: document.getElementById("meta-condition"),
  live: document.getElementById("live-region"),
  filters: Array.from(document.querySelectorAll(".filter"))
};

const scopeCtx = els.scope.getContext("2d");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function currentExhibit() {
  return EXHIBITS.find((item) => item.id === state.currentId) || EXHIBITS[0];
}

function formatTime(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
}

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    return;
  }
}

function loadPreferences() {
  const favourites = readStorage(STORAGE_FAVOURITES, []);
  if (Array.isArray(favourites)) {
    favourites.forEach((id) => {
      if (EXHIBITS.some((item) => item.id === id)) state.favourites.add(id);
    });
  }
  const storedVolume = readStorage(STORAGE_VOLUME, 0.7);
  if (typeof storedVolume === "number" && storedVolume >= 0 && storedVolume <= 1) {
    state.volume = storedVolume;
  }
  els.volume.value = String(Math.round(state.volume * 100));
  updateVolumeUI();
}

function updateVolumeUI() {
  const percent = Math.round(state.volume * 100);
  els.volumeValue.textContent = percent + "%";
  els.volume.style.setProperty("--fill", percent + "%");
  els.volume.setAttribute("aria-valuetext", percent + " percent");
}

function announce(message) {
  els.live.textContent = "";
  window.setTimeout(() => {
    els.live.textContent = message;
  }, 40);
}

function renderList() {
  const visible = EXHIBITS.filter((item) => state.filter === "all" || state.favourites.has(item.id));
  els.list.innerHTML = "";
  visible.forEach((item) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "exhibit";
    button.dataset.id = item.id;
    button.innerHTML =
      '<span class="exhibit-no">' + item.numeral + "</span>" +
      '<span class="exhibit-text"><span class="exhibit-title">' + item.title + "</span>" +
      '<span class="exhibit-place">' + item.place + " · " + item.recorded.slice(0, 4) + "</span></span>" +
      '<span class="exhibit-dur">' + formatTime(item.duration) + "</span>";
    li.appendChild(button);
    els.list.appendChild(li);
  });
  els.count.textContent = String(visible.length);
  const empty = state.filter === "kept" && visible.length === 0;
  els.empty.hidden = !empty;
  updateListState();
}

function updateListState() {
  const buttons = els.list.querySelectorAll(".exhibit");
  buttons.forEach((button) => {
    const isSelected = button.dataset.id === state.currentId;
    const isPlaying = isSelected && state.playing;
    button.classList.toggle("is-selected", isSelected);
    button.classList.toggle("is-playing", isPlaying);
    if (isSelected) {
      button.setAttribute("aria-current", "true");
    } else {
      button.removeAttribute("aria-current");
    }
  });
}

function renderExhibit(animate) {
  const item = currentExhibit();
  els.no.textContent = item.accession;
  els.kicker.textContent = item.kicker;
  els.title.textContent = item.title;
  els.sub.textContent = item.place + " · " + item.recorded.slice(0, 4);
  els.note.textContent = item.note;
  els.metaOrigin.textContent = item.place;
  els.metaRecorded.textContent = item.recorded;
  els.metaMedium.textContent = item.medium;
  els.metaCondition.textContent = item.condition;
  els.duration.textContent = formatTime(item.duration);
  els.scopeTime.textContent = "00:00 / " + formatTime(item.duration);
  state.duration = item.duration;
  state.elapsed = 0;
  els.progressFill.style.width = "0%";
  els.progress.setAttribute("aria-valuenow", "0");
  els.favourite.setAttribute("aria-pressed", String(state.favourites.has(item.id)));
  els.favourite.setAttribute("aria-label", (state.favourites.has(item.id) ? "Remove " : "Keep ") + item.title + (state.favourites.has(item.id) ? " from your collection" : " in your collection"));
  els.favouriteLabel.textContent = state.favourites.has(item.id) ? "Kept" : "Keep";
  if (animate) {
    els.plaque.classList.remove("swap");
    void els.plaque.offsetWidth;
    els.plaque.classList.add("swap");
  }
}

function selectExhibit(id) {
  if (!EXHIBITS.some((item) => item.id === id)) return;
  if (state.playing) stopPlayback(false);
  if (state.currentId === id && !state.playing) {
    renderExhibit(true);
    updateListState();
    return;
  }
  state.currentId = id;
  renderExhibit(true);
  updateListState();
  const item = currentExhibit();
  announce("Selected " + item.title + ". Press strike the vitrine to listen.");
}

function persistFavourites() {
  writeStorage(STORAGE_FAVOURITES, Array.from(state.favourites));
}

function toggleFavourite() {
  const item = currentExhibit();
  if (state.favourites.has(item.id)) {
    state.favourites.delete(item.id);
    announce(item.title + " removed from your collection.");
  } else {
    state.favourites.add(item.id);
    announce(item.title + " kept in your collection.");
  }
  persistFavourites();
  els.favourite.setAttribute("aria-pressed", String(state.favourites.has(item.id)));
  els.favourite.setAttribute("aria-label", (state.favourites.has(item.id) ? "Remove " : "Keep ") + item.title + (state.favourites.has(item.id) ? " from your collection" : " in your collection"));
  els.favouriteLabel.textContent = state.favourites.has(item.id) ? "Kept" : "Keep";
  if (state.filter === "kept") {
    renderList();
  }
}

function setFilter(filter) {
  state.filter = filter;
  els.filters.forEach((button) => {
    const active = button.dataset.filter === filter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderList();
  announce(filter === "all" ? "Showing all specimens." : "Showing kept specimens.");
}

function volumeToGain(value) {
  return Math.pow(value, 1.7) * 0.95;
}

function applyVolume() {
  if (master && audioCtx) {
    const now = audioCtx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(volumeToGain(state.volume), now, 0.05);
  }
}

function initAudio() {
  if (audioCtx) return audioCtx;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("This browser does not support the Web Audio API.");
  audioCtx = new AudioContextClass();
  master = audioCtx.createGain();
  master.gain.value = volumeToGain(state.volume);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.78;
  waveformData = new Uint8Array(analyser.fftSize);
  master.connect(analyser);
  analyser.connect(audioCtx.destination);
  return audioCtx;
}

function getNoise(kind) {
  if (kind === "brown" && brownBuffer) return brownBuffer;
  if (kind !== "brown" && whiteBuffer) return whiteBuffer;
  const length = audioCtx.sampleRate * 3;
  const buffer = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      if (kind === "brown") {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.4;
      } else {
        data[i] = white * 0.6;
      }
    }
  }
  if (kind === "brown") {
    brownBuffer = buffer;
  } else {
    whiteBuffer = buffer;
  }
  return buffer;
}

function createVoice() {
  return { stopped: false, timeouts: [], intervals: [], sources: [] };
}

function noiseSource(voice, kind) {
  const source = audioCtx.createBufferSource();
  source.buffer = getNoise(kind);
  source.loop = true;
  voice.sources.push(source);
  return source;
}

function oscillator(voice, type, frequency) {
  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.value = frequency;
  voice.sources.push(osc);
  return osc;
}

function gainNode(value) {
  const gain = audioCtx.createGain();
  gain.gain.value = value;
  return gain;
}

function filterNode(type, frequency, q) {
  const filter = audioCtx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  if (typeof q === "number") filter.Q.value = q;
  return filter;
}

function later(voice, callback, delay) {
  if (voice.stopped) return;
  const id = window.setTimeout(() => {
    if (!voice.stopped) callback();
  }, delay);
  voice.timeouts.push(id);
}

function every(voice, callback, interval) {
  if (voice.stopped) return;
  callback();
  const id = window.setInterval(() => {
    if (!voice.stopped) callback();
  }, interval);
  voice.intervals.push(id);
}

function strikeDrop(voice, out) {
  if (voice.stopped || !audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const start = 1100 + Math.random() * 1700;
  osc.type = "sine";
  osc.frequency.setValueAtTime(start, now);
  osc.frequency.exponentialRampToValueAtTime(260 + Math.random() * 380, now + 0.09);
  const peak = 0.018 + Math.random() * 0.045;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14 + Math.random() * 0.12);
  osc.connect(gain);
  gain.connect(out);
  osc.start(now);
  osc.stop(now + 0.35);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

function makeRain(out) {
  const voice = createVoice();
  const now = audioCtx.currentTime;
  const bed = noiseSource(voice, "white");
  const lowpass = filterNode("lowpass", 1500, 0.6);
  const bedGain = gainNode(0.0001);
  bed.connect(lowpass);
  lowpass.connect(bedGain);
  bedGain.connect(out);
  bedGain.gain.setValueAtTime(0.0001, now);
  bedGain.gain.linearRampToValueAtTime(0.32, now + 2.2);

  const hiss = noiseSource(voice, "white");
  const highpass = filterNode("highpass", 3400, 0.5);
  const hissGain = gainNode(0.05);
  hiss.connect(highpass);
  highpass.connect(hissGain);
  hissGain.connect(out);

  const lfo = oscillator(voice, "sine", 0.07);
  const lfoGain = gainNode(380);
  lfo.connect(lfoGain);
  lfoGain.connect(lowpass.frequency);
  lfo.start(now);

  bed.start(now);
  hiss.start(now);

  every(voice, () => {
    if (Math.random() > 0.25) strikeDrop(voice, out);
  }, 620);

  return voice;
}

function bellStrike(voice, bus) {
  if (voice.stopped || !audioCtx) return;
  const now = audioCtx.currentTime;
  const base = 196;
  const partials = [
    { ratio: 1, gain: 0.16, decay: 7.5 },
    { ratio: 2.01, gain: 0.085, decay: 6 },
    { ratio: 2.76, gain: 0.055, decay: 4.8 },
    { ratio: 4.08, gain: 0.028, decay: 3.4 },
    { ratio: 5.42, gain: 0.016, decay: 2.4 }
  ];
  partials.forEach((partial, index) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = base * partial.ratio;
    osc.detune.value = (Math.random() - 0.5) * 5;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(partial.gain, now + 0.012 + index * 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + partial.decay);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(now);
    osc.stop(now + partial.decay + 0.1);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  });
}

function makeBell(out) {
  const voice = createVoice();
  const bus = gainNode(0.9);
  bus.connect(out);
  const delay = audioCtx.createDelay(1);
  delay.delayTime.value = 0.31;
  const feedback = gainNode(0.3);
  const damp = filterNode("lowpass", 1600, 0.4);
  const wet = gainNode(0.42);
  bus.connect(delay);
  delay.connect(damp);
  damp.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(out);

  every(voice, () => bellStrike(voice, bus), 7600);

  return voice;
}

function clack(voice, out, strength) {
  if (voice.stopped || !audioCtx) return;
  const now = audioCtx.currentTime;
  const source = audioCtx.createBufferSource();
  source.buffer = getNoise("white");
  const band = filterNode("bandpass", 780 + Math.random() * 280, 1.4);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.06 * strength, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
  source.connect(band);
  band.connect(gain);
  gain.connect(out);
  source.start(now);
  source.stop(now + 0.12);
  source.onended = () => {
    source.disconnect();
    band.disconnect();
    gain.disconnect();
  };
  const thud = audioCtx.createOscillator();
  const thudGain = audioCtx.createGain();
  thud.type = "sine";
  thud.frequency.setValueAtTime(74, now);
  thud.frequency.exponentialRampToValueAtTime(48, now + 0.09);
  thudGain.gain.setValueAtTime(0.0001, now);
  thudGain.gain.exponentialRampToValueAtTime(0.07 * strength, now + 0.005);
  thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  thud.connect(thudGain);
  thudGain.connect(out);
  thud.start(now);
  thud.stop(now + 0.2);
  thud.onended = () => {
    thud.disconnect();
    thudGain.disconnect();
  };
}

function trainBell(voice, out) {
  if (voice.stopped || !audioCtx) return;
  const now = audioCtx.currentTime;
  [740, 1110].forEach((frequency, index) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.05 : 0.022, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 1.2);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  });
}

function trainHorn(voice, out) {
  if (voice.stopped || !audioCtx) return;
  const now = audioCtx.currentTime;
  const gain = audioCtx.createGain();
  const lowpass = filterNode("lowpass", 620, 0.7);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.075, now + 0.6);
  gain.gain.setValueAtTime(0.075, now + 1.5);
  gain.gain.linearRampToValueAtTime(0.0001, now + 3.2);
  lowpass.connect(gain);
  gain.connect(out);
  [138, 146, 207].forEach((frequency, index) => {
    const osc = audioCtx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = frequency;
    osc.detune.value = index * 4;
    osc.connect(lowpass);
    osc.start(now);
    osc.stop(now + 3.3);
    osc.onended = () => osc.disconnect();
  });
  later(voice, () => {
    gain.disconnect();
    lowpass.disconnect();
  }, 3500);
}

function makeTrain(out) {
  const voice = createVoice();
  const now = audioCtx.currentTime;
  const bed = noiseSource(voice, "brown");
  const bedFilter = filterNode("lowpass", 240, 0.5);
  const bedGain = gainNode(0.0001);
  bed.connect(bedFilter);
  bedFilter.connect(bedGain);
  bedGain.connect(out);
  bedGain.gain.setValueAtTime(0.0001, now);
  bedGain.gain.linearRampToValueAtTime(0.55, now + 2.4);
  bed.start(now);

  const rumble = oscillator(voice, "sine", 42);
  const rumbleGain = gainNode(0.03);
  rumble.connect(rumbleGain);
  rumbleGain.connect(out);
  rumble.start(now);

  let beat = 0;
  every(voice, () => {
    beat += 1;
    clack(voice, out, beat % 2 === 0 ? 0.95 : 0.55);
  }, 460);

  every(voice, () => trainBell(voice, out), 2550);
  every(voice, () => trainHorn(voice, out), 12500);

  return voice;
}

function makeRoom(out) {
  const voice = createVoice();
  const now = audioCtx.currentTime;
  const bed = noiseSource(voice, "brown");
  const lowpass = filterNode("lowpass", 340, 0.5);
  const bedGain = gainNode(0.0001);
  bed.connect(lowpass);
  lowpass.connect(bedGain);
  bedGain.connect(out);
  bedGain.gain.setValueAtTime(0.0001, now);
  bedGain.gain.linearRampToValueAtTime(0.28, now + 2.8);

  const hum = oscillator(voice, "sine", 50);
  const humGain = gainNode(0.016);
  hum.connect(humGain);
  humGain.connect(out);
  hum.start(now);

  const overtone = oscillator(voice, "sine", 100.4);
  const overtoneGain = gainNode(0.006);
  overtone.connect(overtoneGain);
  overtoneGain.connect(out);
  overtone.start(now);

  const airLfo = oscillator(voice, "sine", 0.045);
  const airLfoGain = gainNode(0.06);
  airLfo.connect(airLfoGain);
  airLfoGain.connect(bedGain.gain);
  airLfo.start(now);

  bed.start(now);

  every(voice, () => {
    if (Math.random() > 0.45) return;
    const tick = audioCtx.createOscillator();
    const tickGain = audioCtx.createGain();
    const at = audioCtx.currentTime;
    tick.type = "sine";
    tick.frequency.value = 1100 + Math.random() * 900;
    tickGain.gain.setValueAtTime(0.0001, at);
    tickGain.gain.exponentialRampToValueAtTime(0.008, at + 0.003);
    tickGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
    tick.connect(tickGain);
    tickGain.connect(out);
    tick.start(at);
    tick.stop(at + 0.12);
    tick.onended = () => {
      tick.disconnect();
      tickGain.disconnect();
    };
  }, 5200);

  return voice;
}

function iceCrack(voice, out, size) {
  if (voice.stopped || !audioCtx) return;
  const now = audioCtx.currentTime;
  const source = audioCtx.createBufferSource();
  source.buffer = getNoise("white");
  const band = filterNode("bandpass", 1500 + Math.random() * 2600, 0.9);
  const gain = audioCtx.createGain();
  const duration = 0.06 + size * 0.22;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.03 + size * 0.16, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(band);
  band.connect(gain);
  gain.connect(out);
  source.start(now);
  source.stop(now + duration + 0.05);
  source.onended = () => {
    source.disconnect();
    band.disconnect();
    gain.disconnect();
  };

  const ping = audioCtx.createOscillator();
  const pingGain = audioCtx.createGain();
  ping.type = "sine";
  ping.frequency.setValueAtTime(220 + Math.random() * 700, now);
  ping.frequency.exponentialRampToValueAtTime(140 + Math.random() * 320, now + 0.4);
  pingGain.gain.setValueAtTime(0.0001, now);
  pingGain.gain.exponentialRampToValueAtTime(0.02 + size * 0.04, now + 0.008);
  pingGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
  ping.connect(pingGain);
  pingGain.connect(out);
  ping.start(now);
  ping.stop(now + 0.7);
  ping.onended = () => {
    ping.disconnect();
    pingGain.disconnect();
  };
}

function makeIce(out) {
  const voice = createVoice();
  const now = audioCtx.currentTime;
  const bed = noiseSource(voice, "brown");
  const lowpass = filterNode("lowpass", 130, 0.4);
  const bedGain = gainNode(0.0001);
  bed.connect(lowpass);
  lowpass.connect(bedGain);
  bedGain.connect(out);
  bedGain.gain.setValueAtTime(0.0001, now);
  bedGain.gain.linearRampToValueAtTime(0.3, now + 2.5);
  bed.start(now);

  const frost = noiseSource(voice, "white");
  const highpass = filterNode("highpass", 4200, 0.5);
  const frostGain = gainNode(0.016);
  frost.connect(highpass);
  highpass.connect(frostGain);
  frostGain.connect(out);
  frost.start(now);

  every(voice, () => {
    if (Math.random() < 0.72) iceCrack(voice, out, Math.random() * 0.6);
  }, 1350);

  every(voice, () => {
    iceCrack(voice, out, 1);
  }, 8200);

  return voice;
}

function foghornCall(voice, out) {
  if (voice.stopped || !audioCtx) return;
  const now = audioCtx.currentTime;
  const gain = audioCtx.createGain();
  const lowpass = filterNode("lowpass", 240, 0.8);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.16, now + 1.7);
  gain.gain.setValueAtTime(0.16, now + 3);
  gain.gain.linearRampToValueAtTime(0.0001, now + 5.4);
  lowpass.connect(gain);
  gain.connect(out);
  [58.27, 87.31, 116.54].forEach((frequency, index) => {
    const osc = audioCtx.createOscillator();
    osc.type = index === 2 ? "triangle" : "sawtooth";
    osc.frequency.value = frequency;
    osc.detune.value = (Math.random() - 0.5) * 7;
    osc.connect(lowpass);
    osc.start(now);
    osc.stop(now + 5.5);
    osc.onended = () => osc.disconnect();
  });
  later(voice, () => {
    gain.disconnect();
    lowpass.disconnect();
  }, 5700);
}

function makeFoghorn(out) {
  const voice = createVoice();
  const now = audioCtx.currentTime;
  const sea = noiseSource(voice, "brown");
  const seaFilter = filterNode("lowpass", 420, 0.6);
  const seaGain = gainNode(0.0001);
  sea.connect(seaFilter);
  seaFilter.connect(seaGain);
  seaGain.connect(out);
  seaGain.gain.setValueAtTime(0.0001, now);
  seaGain.gain.linearRampToValueAtTime(0.14, now + 3);
  sea.start(now);

  const swell = oscillator(voice, "sine", 0.09);
  const swellGain = gainNode(0.06);
  swell.connect(swellGain);
  swellGain.connect(seaGain.gain);
  swell.start(now);

  every(voice, () => foghornCall(voice, out), 7800);

  return voice;
}

function updateScopeState(label, live) {
  els.scopeState.textContent = label;
  els.scopeState.classList.toggle("is-live", Boolean(live));
}

function updateProgress() {
  if (!state.playing) return;
  const elapsed = Math.min(state.duration, (performance.now() - state.startedAt) / 1000);
  state.elapsed = elapsed;
  const percent = Math.min(100, (elapsed / state.duration) * 100);
  els.progressFill.style.width = percent + "%";
  els.progress.setAttribute("aria-valuenow", String(Math.round(percent)));
  els.scopeTime.textContent = formatTime(elapsed) + " / " + formatTime(state.duration);
  if (elapsed >= state.duration) {
    stopPlayback(true);
  }
}

function startPlayback() {
  const item = currentExhibit();
  try {
    initAudio();
  } catch (error) {
    els.playHint.textContent = "This browser cannot start the archive.";
    announce("Audio could not start: " + error.message);
    return;
  }

  const begin = (retried) => {
    if (audioCtx.state === "suspended") {
      if (retried) {
        els.playHint.textContent = "Tap once more to allow sound.";
        announce("The browser needs another tap before sound can begin.");
        return;
      }
      audioCtx.resume().then(() => begin(true)).catch(() => {
        els.playHint.textContent = "Tap once more to allow sound.";
        announce("The browser needs another tap before sound can begin.");
      });
      return;
    }
    const out = audioCtx.createGain();
    out.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    out.connect(master);
    const voice = item.make(out);
    voice.out = out;
    activeVoice = voice;
    applyVolume();
    out.gain.setTargetAtTime(1, audioCtx.currentTime, 0.35);
    state.playing = true;
    state.startedAt = performance.now();
    state.elapsed = 0;
    state.duration = item.duration;
    els.play.setAttribute("aria-pressed", "true");
    els.playLabel.textContent = "Silence the vitrine";
    els.playHint.textContent = "Playing a live reconstruction";
    updateScopeState("Signal live", true);
    updateListState();
    window.clearInterval(progressTimer);
    progressTimer = window.setInterval(updateProgress, 120);
    updateProgress();
    announce("Now playing " + item.title + ".");
  };

  begin(false);
}

function stopPlayback(auto) {
  if (!state.playing) return;
  window.clearInterval(progressTimer);
  progressTimer = null;
  state.playing = false;
  const voice = activeVoice;
  activeVoice = null;
  if (voice && audioCtx) {
    const now = audioCtx.currentTime;
    try {
      voice.out.gain.cancelScheduledValues(now);
      voice.out.gain.setValueAtTime(Math.max(0.0001, voice.out.gain.value), now);
      voice.out.gain.linearRampToValueAtTime(0.0001, now + 0.7);
    } catch (error) {
      voice.out.gain.value = 0.0001;
    }
    voice.stopped = true;
    voice.intervals.forEach((id) => window.clearInterval(id));
    voice.timeouts.forEach((id) => window.clearTimeout(id));
    const out = voice.out;
    const sources = voice.sources;
    window.setTimeout(() => {
      sources.forEach((source) => {
        try { source.stop(); } catch (error) { return; }
      });
      try { out.disconnect(); } catch (error) { return; }
    }, 820);
  }
  els.play.setAttribute("aria-pressed", "false");
  els.playLabel.textContent = "Strike the vitrine";
  els.playHint.textContent = "Sound begins on your command";
  els.progressFill.style.width = "0%";
  els.progress.setAttribute("aria-valuenow", "0");
  els.scopeTime.textContent = "00:00 / " + formatTime(state.duration);
  updateScopeState(auto ? "Silence restored" : "Signal at rest", false);
  updateListState();
  if (auto) {
    announce("The specimen falls silent. " + currentExhibit().title + " has ended.");
  } else {
    announce("Sound stopped. The hall is quiet.");
  }
}

function togglePlayback() {
  if (state.playing) {
    stopPlayback(false);
  } else {
    startPlayback();
  }
}

function resizeScope() {
  const rect = els.scope.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (els.scope.width !== width || els.scope.height !== height) {
    els.scope.width = width;
    els.scope.height = height;
    scopeResizePending = false;
    return true;
  }
  return false;
}

function drawGrid(ctx, width, height, dpr) {
  ctx.lineWidth = dpr * 0.5;
  ctx.strokeStyle = "rgba(201, 164, 76, 0.10)";
  const step = Math.max(24 * dpr, width / 26);
  ctx.beginPath();
  for (let x = step; x < width; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  const verticalStep = height / 6;
  for (let y = verticalStep; y < height; y += verticalStep) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  ctx.strokeStyle = "rgba(201, 164, 76, 0.22)";
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();
}

function drawScope(timestamp) {
  resizeScope();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = els.scope.width;
  const height = els.scope.height;
  const ctx = scopeCtx;
  if (!width || !height) {
    window.requestAnimationFrame(drawScope);
    return;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#080706");
  bg.addColorStop(0.5, "#0b0a08");
  bg.addColorStop(1, "#070605");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height, dpr);

  if (state.playing && analyser && waveformData) {
    analyser.getByteTimeDomainData(waveformData);
    const mid = height / 2;
    const amp = height * 0.38;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(230, 201, 122, 0.22)";
    ctx.lineWidth = dpr * 4;
    ctx.beginPath();
    for (let i = 0; i < waveformData.length; i += 1) {
      const x = (i / (waveformData.length - 1)) * width;
      const y = mid + ((waveformData[i] - 128) / 128) * amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = "#eed48f";
    ctx.lineWidth = dpr * 1.4;
    ctx.shadowColor = "rgba(242, 223, 168, 0.75)";
    ctx.shadowBlur = 14 * dpr;
    ctx.beginPath();
    for (let i = 0; i < waveformData.length; i += 1) {
      const x = (i / (waveformData.length - 1)) * width;
      const y = mid + ((waveformData[i] - 128) / 128) * amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(242, 223, 168, 0.55)";
    ctx.beginPath();
    ctx.arc(width - 14 * dpr, 12 * dpr, 2.4 * dpr, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const mid = height / 2;
    const drift = reducedMotion.matches ? 0 : Math.sin(timestamp / 2400) * height * 0.05;
    const glow = ctx.createRadialGradient(width * 0.5, mid + drift, 0, width * 0.5, mid + drift, width * 0.36);
    glow.addColorStop(0, "rgba(201, 164, 76, 0.10)");
    glow.addColorStop(1, "rgba(201, 164, 76, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(201, 164, 76, 0.55)";
    ctx.lineWidth = dpr * 1;
    ctx.beginPath();
    const segments = 80;
    for (let i = 0; i <= segments; i += 1) {
      const x = (i / segments) * width;
      const wobble = Math.sin(i * 0.9 + timestamp / 2600) * (reducedMotion.matches ? 0 : dpr * 0.9);
      const y = mid + drift + wobble;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  window.requestAnimationFrame(drawScope);
}

els.list.addEventListener("click", (event) => {
  const button = event.target.closest(".exhibit");
  if (!button) return;
  selectExhibit(button.dataset.id);
});

els.list.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const buttons = Array.from(els.list.querySelectorAll(".exhibit"));
  const index = buttons.indexOf(document.activeElement);
  if (index === -1) return;
  event.preventDefault();
  const next = event.key === "ArrowDown" ? index + 1 : index - 1;
  const target = buttons[(next + buttons.length) % buttons.length];
  target.focus();
});

els.filters.forEach((button) => {
  button.addEventListener("click", () => setFilter(button.dataset.filter));
});

els.favourite.addEventListener("click", toggleFavourite);

els.play.addEventListener("click", togglePlayback);

els.volume.addEventListener("input", () => {
  state.volume = Number(els.volume.value) / 100;
  updateVolumeUI();
  applyVolume();
  writeStorage(STORAGE_VOLUME, state.volume);
});

window.addEventListener("resize", () => {
  scopeResizePending = true;
});

loadPreferences();
renderList();
renderExhibit(false);
updateScopeState("Signal at rest", false);
updateVolumeUI();
window.requestAnimationFrame(drawScope);
