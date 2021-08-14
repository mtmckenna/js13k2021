const EPSILON = 0.0001;
const RAMP_TIME = 0.1;
const AUDIO_TIME_CONSTANT = 0.01;
const MAX_ENGINE = 0.2;
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

// gain.connect(audioContext.destination);
gain.connect(compressor);
gain.gain.value = 0.5;

const p0 = () => playSequence([0], [0.1], WAVE_TYPE);
const p1 = () => playSequence([500], [0.3], WAVE_TYPE);
const p2 = () => playSequence([475], [0.2], WAVE_TYPE);
const p3 = () => playSequence([450], [0.1], WAVE_TYPE);
const p4 = () => playSequence([425], [0.1], WAVE_TYPE);
const p5 = () => playSequence([400], [0.1], WAVE_TYPE);
const p6 = () => playSequence([375], [0.1], WAVE_TYPE);
const p7 = () => playSequence([350], [0.1], WAVE_TYPE);
const p8 = () => playSequence([325], [0.1], WAVE_TYPE);
const p9 = () => playSequence([300], [0.1], WAVE_TYPE);
const p10 = () => playSequence([275], [0.1], WAVE_TYPE);

export const countdownBeeps = [p0, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10];

const Al = 233.08;
const Bf = 246.94;
const C = 261.63;
const D = 293.66;
const E = 329.63;
const F = 349.23;
const G = 392.0;
const A = 440.0;
const R = 1.0;

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

// https://www.youtube.com/watch?v=PjwsAWomTFI
// https://pages.mtu.edu/~suits/notefreqs.html
//                      glo ry   glo   ry   ha   le  lu  ja   x    glo  ry   glo  ry   ha   le   lu  ja    x    glo ry   glo  ry  ha  le  lu   ja   x   his  tr  is    ma   chn  on
// prettier-ignore
const battleNotes   = [ C,  Bf,  Al,   C,   F,   G,   A,  F,  R,   D,   E,   F,   E,   F,   D,   C,  Al,   R,   C,  Bf,  Al,  C,  F,  G,   A,   F,  R,   F,  G,   G,   F,   E,   F];
// prettier-ignore
const notesDuration = [.4,  .1,  .1,  .1,  .1,  .1,  .4, .2, .03, .2,  .1,  .1,  .1,  .1,  .1,  .4,  .2,  .03, .1,  .1,  .1, .1, .1, .1,  .1,  .1,  .1, .2, .2,  .2,  .2,  .2,  .2];

export const playElectionDay = () =>
  playSequence(battleNotes, notesDuration, WAVE_TYPE);

export const playNoFunds = () =>
  playSequence([250, 200, 150, 100], [0.4, 0.4, 0.4, 2.5], WAVE_TYPE);

export const playMove = () => playSequence([A3], [0.0], WAVE_TYPE);

const cAm = [A3, C4, G4];
const cC = [C4, G4, E4, G4];
const cCmaj7 = [C4, G4, E4];

export const playMoveChord = () => playChord(cAm);
export const playAbsorbChord = () => playChord(cC, WAVE_TYPE, 0.25);
export const playAbsorbedChord = () => playChord(cCmaj7, WAVE_TYPE, 0.25);
export const playBackground = () =>
  playSequence(
    [A2, C3, A2, C3, A2, C3],
    [10.5, 10.25, 0.5, 0.25, 0.5, 0.25],
    WAVE_TYPE,
    true,
    20.0
  );

// https://blog.j-labs.pl/2017/02/Creating-game-for-android-using-JavaScript-4-Sounds-Web-Audio-Api
function playSequence(
  notes: number[],
  times: number[],
  type: OscillatorType,
  repeat: boolean = false,
  gainValue: number = 1.0
): Sound {
  const noteGain = audioContext.createGain();

  noteGain.connect(gain);

  let sound: Sound = {
    oscillatorNodes: [],
    gainNode: noteGain,
  };

  let oscillators: OscillatorNode[] = [];
  const lastIndex = notes.length - 1;
  notes.forEach((note, index) => {
    let oscillator = audioContext.createOscillator();
    oscillator.connect(noteGain);
    oscillator.type = type || WAVE_TYPE;
    oscillator.frequency.value = note;
    oscillator.onended = () => {
      if (index !== lastIndex) {
        playOscillator(
          oscillators[index + 1],
          noteGain,
          times[index + 1],
          gainValue
        );
      }
    };
    oscillators.push(oscillator);
  });

  sound.oscillatorNodes = oscillators;

  playOscillator(oscillators[0], noteGain, times[0], gainValue);
  return sound;
}

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
