const EPSILON = 0.0001;
const RAMP_TIME = 0.1;
const AUDIO_TIME_CONSTANT = 0.01;
const WAVE_TYPE = "sine";

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

const compressor = audioContext.createDynamicsCompressor();
compressor.threshold.setValueAtTime(-24, audioContext.currentTime);
compressor.knee.setValueAtTime(30, audioContext.currentTime);
compressor.ratio.setValueAtTime(12, audioContext.currentTime);
compressor.attack.setValueAtTime(0.003, audioContext.currentTime);
compressor.release.setValueAtTime(0.25, audioContext.currentTime);
compressor.connect(audioContext.destination);

const gain = audioContext.createGain();

gain.connect(compressor);
gain.gain.value = 0.0;

const Al = 233.08;
const Bf = 246.94;
const C = 261.63;
const D = 293.66;
const E = 329.63;
const F = 349.23;
const G = 392.0;
const A = 440.0;
const R = 1.0;
// https://pages.mtu.edu/~suits/notefreqs.html
const A2 = 110.0;
const B2 = 123.47;
const C3 = 130.81;
const D3 = 146.83;
const E3 = 164.81;
const F3 = 174.61;
const G3 = 196.0;
const A3 = 220.0;
const B3 = 246.94;
const C4 = 261.63;
const D4 = 293.66;
const E4 = 329.63;
const F4 = 349.23;
const G4 = 392.0;
const A4 = 440.0;

const cAm = [A3, C3, E4];
const cC = [C4, G4, E4];
const cCmaj7 = [C4, G4, E4];
const cF = [F3, A3, C3];

export function setVolume(value: number) {
  gain.gain.value = value;
}

export function getVolume(): number {
  return gain.gain.value;
}

export const playAbsorbChord = () => playChord(cCmaj7, WAVE_TYPE, 0.25);
export const playAbsorbedChord = () => playChord(cF, WAVE_TYPE, 0.25);
export const playIntersectChord = () => playChord(cAm, WAVE_TYPE, 0.25);

export function playChord(
  notes: Array<number>,
  type: OscillatorType = WAVE_TYPE,
  gainValue: number = 1.0
): Sound {
  const noteGain = audioContext.createGain();
  noteGain.connect(gain);

  let sound: Sound = {
    oscillatorNodes: [],
    gainNode: noteGain,
  };

  let oscillators: OscillatorNode[] = [];
  notes.forEach((note) => {
    let oscillator = audioContext.createOscillator();
    oscillator.connect(noteGain);
    oscillator.type = type || WAVE_TYPE;
    oscillator.frequency.value = note;
    oscillators.push(oscillator);
  });

  oscillators.forEach((oscillator) => {
    playOscillator(oscillator, noteGain, 0, gainValue);
  });

  sound.oscillatorNodes = oscillators;

  return sound;
}

function playOscillator(
  oscillator: OscillatorNode,
  gainNode: GainNode,
  time: number = 0,
  gainValue: number = 1
) {
  const startTime = audioContext.currentTime;
  const endTime = audioContext.currentTime + time;

  gainNode.gain.setValueAtTime(EPSILON, startTime);
  oscillator.start(startTime);
  gainNode.gain.setTargetAtTime(
    gainValue,
    startTime + EPSILON,
    AUDIO_TIME_CONSTANT
  );

  if (time > 0) {
    gainNode.gain.setTargetAtTime(EPSILON, endTime, AUDIO_TIME_CONSTANT);
    oscillator.stop(endTime + RAMP_TIME);
  }
}

export function stopSound(sound: Sound, time = 0) {
  const { gainNode, oscillatorNodes } = sound;
  const endTime = audioContext.currentTime + time + RAMP_TIME;

  gainNode.gain.exponentialRampToValueAtTime(EPSILON, endTime);

  oscillatorNodes.forEach((o) => {
    o.stop(endTime);
  });
}

export interface Sound {
  oscillatorNodes: OscillatorNode[];
  gainNode: GainNode;
}
