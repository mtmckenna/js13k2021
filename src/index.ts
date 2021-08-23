import { GlslShader } from "webpack-glsl-minify";

const VERTEX_SHADER = require("./shaders/vertex.vert") as GlslShader;
const FRAGMENT_SHADER = require("./shaders/fragment.frag") as GlslShader;

import {
  compiledProgram,
  configureBuffer,
  ProgramCache,
} from "./webgl-helpers";

import {
  playMove,
  playMoveChord,
  playAbsorbChord,
  playAbsorbedChord,
  playBackground,
  stopSound,
  Sound,
} from "./audio";

import { inputState, addEventListeners } from "./input";

const canvas: HTMLCanvasElement = document.createElement("canvas");
const ctx = canvas.getContext("webgl");
const width = 800;
const height = 600;
const MOVING_SPEED = 0.003;
const MAX_VEL = MOVING_SPEED * 2;
const FRICTION = 0.96;
const MIN_VEL_THRESHOLD = 0.00015;
const GROW_TIME = 500;
const GROW_SIZE = 0.1;
const circles: Array<OtherCircle> = [];
let NUM_CIRCLES = 5;
let MIN_CIRCLE_SIZE = 0.025;
let MAX_CIRCLE_SIZE = 0.025;
let MIN_CIRCLE_START_VEL = 0.001;
let MAX_CIRCLE_START_VEL = 0.004;

// let currentSize = 0.1;
let borderSize = 1.5;

const gameState: GameState = {
  started: false,
};

canvas.id = "game";
canvas.width = width;
canvas.height = height;
const div = document.createElement("div");
div.appendChild(canvas);
document.body.appendChild(canvas);

const textBox = document.createElement("div");
textBox.classList.add("text");
document.body.appendChild(textBox);
setTimeout(() => displayText("Absorbed"), 1);

addEventListeners(canvas);

const res = new Float32Array([canvas.width, canvas.height]);

const START_SIZE = 0.1;

const player: PlayerCircle = {
  props: new Float32Array([0.0, 0.0, START_SIZE, 0.0]),
  vel: new Float32Array([0.0, 0.0]),
  animation: {
    startTime: 0,
    endTime: 0,
    startValue: START_SIZE,
    endValue: START_SIZE,
    currentValue: START_SIZE,
  },
};

// TODO: delete?
const camera: Camera = {
  props: new Float32Array([0.0, 0.0, 0.0, 0.0]),
};

const soundBank: { [key: string]: Sound | null } = {
  move: null,
  absorb: null,
  absorbed: null,
};

let circleProps = new Float32Array(NUM_CIRCLES * 4);

for (let i = 0; i < NUM_CIRCLES; i++) {
  const radius = randomFloatBetween(MIN_CIRCLE_SIZE, MAX_CIRCLE_SIZE);

  circleProps[i * 4 + 0] = randomFloatBetween(
    -borderSize + radius,
    borderSize - radius
  );

  circleProps[i * 4 + 1] = randomFloatBetween(
    -borderSize + radius,
    borderSize - radius
  );

  circleProps[i * 4 + 2] = radius;
  circleProps[i * 4 + 3] = 0;

  const vel = new Float32Array([
    randomSign() *
      randomFloatBetween(MIN_CIRCLE_START_VEL, MAX_CIRCLE_START_VEL),
    randomSign() *
      randomFloatBetween(MIN_CIRCLE_START_VEL, MAX_CIRCLE_START_VEL),
  ]);

  circles.push({
    index: i,
    vel: vel,
    animation: {
      startTime: 0,
      endTime: 0,
      startValue: START_SIZE,
      endValue: START_SIZE,
      currentValue: START_SIZE,
    },
  });
}

// console.log(circles);
// console.log(JSON.stringify(circleProps));

// const circleProps = new Float32Array([
//  .45, .45, .025, 0.0,
//  .9,  .9 , .025, 0.0,
//  -circleStartX, -0.0, 0.025, 0.0
// ]);

// prettier-ignore
const squarePositions = new Float32Array([
  -1,  1,
   1,  1,
  -1, -1,
 
  -1, -1,
   1,  1,
   1, -1
]);

let backgroundSound = null;

const program = compiledProgram(
  ctx,
  VERTEX_SHADER.sourceCode,
  FRAGMENT_SHADER.sourceCode
);

const squareBuffer = ctx.createBuffer();
ctx.useProgram(program);

const programInfo: GameProgramCache = {
  attributes: {
    aSquarePosition: ctx.getAttribLocation(program, "aSquarePosition"),
  },
  uniforms: {
    uRes: ctx.getUniformLocation(
      program,
      FRAGMENT_SHADER.uniforms["uRes"].variableName
    ),
    uPlayerProps: ctx.getUniformLocation(
      program,
      FRAGMENT_SHADER.uniforms["uPlayerProps"].variableName
    ),
    uCircleProps: ctx.getUniformLocation(
      program,
      FRAGMENT_SHADER.uniforms["uCircleProps"].variableName
    ),
    uCameraProps: ctx.getUniformLocation(
      program,
      FRAGMENT_SHADER.uniforms["uCameraProps"].variableName
    ),
    uTime: ctx.getUniformLocation(
      program,
      FRAGMENT_SHADER.uniforms["uTime"].variableName
    ),
    uBorder: ctx.getUniformLocation(
      program,
      FRAGMENT_SHADER.uniforms["uBorder"].variableName
    ),
  },
};

function updatePlayerPosition() {
  if (inputState.left) player.vel[0] -= MOVING_SPEED;
  if (inputState.right) player.vel[0] += MOVING_SPEED;
  if (inputState.up) player.vel[1] += MOVING_SPEED;
  if (inputState.down) player.vel[1] -= MOVING_SPEED;

  if (!inputState.left || !inputState.right) {
    player.vel[0] =
      Math.sign(player.vel[0]) * Math.abs(player.vel[0]) * FRICTION;
  }

  player.vel[0] = clamp(player.vel[0], -MAX_VEL, MAX_VEL);

  if (!inputState.up || !inputState.down) {
    player.vel[1] =
      Math.sign(player.vel[1]) * Math.abs(player.vel[1]) * FRICTION;
  }

  player.vel[1] = clamp(player.vel[1], -MAX_VEL, MAX_VEL);

  player.props[0] += player.vel[0];
  player.props[1] += player.vel[1];

  // Left border
  if (player.props[0] - player.props[2] <= -borderSize) {
    player.props[0] = Math.max(-borderSize + player.props[2], player.props[0]);
    player.vel[0] = Math.abs(player.vel[0]);
  }

  // Right border
  if (player.props[0] + player.props[2] >= borderSize) {
    player.props[0] = Math.min(borderSize - player.props[2], player.props[0]);
    player.vel[0] = -Math.abs(player.vel[0]);
  }

  // Top border
  if (player.props[1] + player.props[2] >= borderSize) {
    player.props[1] = Math.min(borderSize - player.props[2], player.props[1]);
    player.vel[1] = -Math.abs(player.vel[1]);
  }

  // Bottom border
  if (player.props[1] - player.props[2] <= -borderSize) {
    player.props[1] = Math.max(-borderSize + player.props[2], player.props[1]);
    player.vel[1] = Math.abs(player.vel[1]);
  }
}

function updateCameraPosition() {
  camera.props[0] = player.props[0];
  camera.props[1] = player.props[1];

  // stop camera at border
  if (camera.props[0] < -borderSize) camera.props[0] = -borderSize;
  if (camera.props[0] > borderSize) camera.props[0] = borderSize;
  if (camera.props[1] < -borderSize) camera.props[1] = -borderSize;
  if (camera.props[1] > borderSize) camera.props[1] = borderSize;
}

function playAudio() {
  const playerMoved = distance(player.vel[0], player.vel[1], 0, 0);
  if (playerMoved >= MIN_VEL_THRESHOLD) {
    playSoundBankFunction("move", playMoveChord);
  } else {
    stopSoundBankFunction("move", 0.75);
  }
}

function hideTitle() {
  if (!gameState.started) {
    if (
      inputState.up ||
      inputState.right ||
      inputState.down ||
      inputState.left
    ) {
      gameState.started = true;
      hideText();
    }
  }
}

function tick(t: number) {
  requestAnimationFrame(tick);

  hideTitle();

  updatePlayerPosition();
  updateCameraPosition();
  playAudio();
  if (inputState.s) {
    if (!backgroundSound) {
      console.log("BG SOUND");
      backgroundSound = playBackground();
    }
    // playSoundBankFunction("move", playMoveChord);
  } else {
    // stopSoundBankFunction("move");
  }

  updateCircles(t);

  ctx.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black, fully opaque
  ctx.clearDepth(1.0); // Clear everything
  ctx.enable(ctx.DEPTH_TEST); // Enable depth testing
  ctx.depthFunc(ctx.LEQUAL); // Near things obscure far things

  canvas.height = getCanvasHeight(canvas);
  ctx.viewport(0, 0, canvas.width, canvas.height);

  // Clear the canvas before we start drawing on it.
  ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);

  ////////////////////canvas pos

  configureBuffer(
    ctx,
    programInfo,
    squareBuffer,
    squarePositions,
    2,
    "aSquarePosition"
  );

  //////////////// res
  res[0] = canvas.width;
  res[1] = canvas.height;
  ctx.uniform2fv(programInfo.uniforms.uRes, res);

  //////////////// player props
  // player.props[2] = currentSize;

  // console.log(player.props[0], player.props[1]);

  if (player.animation.startTime > 0) {
    let pct = clamp((t - player.animation.startTime) / GROW_TIME, 0, 1); // get percent through animation, clamp between 0 and 1
    pct = easeOutBack(pct); // add in easing function

    player.animation.currentValue = lerp(
      player.animation.startValue,
      player.animation.endValue,
      pct
    );
  }

  player.props[2] = player.animation.currentValue;

  ctx.uniform4fv(programInfo.uniforms.uPlayerProps, player.props);

  //////////////// camera props
  ctx.uniform4fv(programInfo.uniforms.uCameraProps, camera.props);

  //////////////// border props
  ctx.uniform1f(programInfo.uniforms.uBorder, borderSize);

  //////////////// circle props
  ctx.uniform4fv(programInfo.uniforms.uCircleProps, circleProps);

  //////////////// time
  ctx.uniform1f(programInfo.uniforms.uTime, t);

  //////////// draw
  ctx.drawArrays(ctx.TRIANGLES, 0, 6);

  // absorb bubbles
  // for (let i = 0; i < circleProps.length; i += 4) {
  //   const x = circleProps[i];
  //   const y = circleProps[i + 1];
  //   const r = circleProps[i + 2];
  //   if (r === 0.0) continue;

  //   if (checkCircleIntersection(x, y, 0.05)) {
  //     playSoundBankFunction("absorb", playAbsorbChord);
  //   } else {
  //     stopSoundBankFunction("absorb");
  //   }

  //   if (checkCircleAbsorption(x, y, 0.025)) {
  //     playSoundBankFunction("absorbed", playAbsorbedChord);
  //     circleProps[i + 2] = 0;

  //     player.animation.startTime = t;
  //     player.animation.endTime = t + GROW_TIME;
  //     player.animation.startValue = player.props[2];
  //     player.props[2] += 0.1;
  //     player.animation.endValue = player.props[2];
  //   } else {
  //     stopSoundBankFunction("absorbed", 2);
  //   }
  // }
}

requestAnimationFrame(tick);

function playSoundBankFunction(soundBankKey, soundFunction) {
  if (!soundBank[soundBankKey]) {
    soundBank[soundBankKey] = soundFunction();
  } else {
    // console.log("exists already");
  }
}

function stopSoundBankFunction(soundBankKey, time = 0) {
  if (soundBank[soundBankKey]) {
    stopSound(soundBank[soundBankKey], time);
    soundBank[soundBankKey] = null;
  }
}

function checkCircleIntersection(x: number, y: number, r: number): boolean {
  const difference = Math.abs(0.1 - r);
  const sum = Math.abs(0.1 + r);
  const d = distanceBetweenCircles(x, y);
  return difference <= d && d <= sum;
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function distanceBetweenCircles(x: number, y: number): number {
  return distance(player.props[0], player.props[1], x, y);
}

function checkCircleAbsorption(x: number, y: number, r: number): boolean {
  const d = distanceBetweenCircles(x, y);
  return 0.1 > 0.025 + d;
}

function updateCircles(t: number) {
  // circleProps[4] = circleStartX + Math.sin(t / 1000.0) / 2;

  circles.forEach((circle) => {
    circle.vel[0] = clamp(circle.vel[0], -MAX_VEL, MAX_VEL);
    circle.vel[1] = clamp(circle.vel[1], -MAX_VEL, MAX_VEL);
    // circle.vel[1] = Math.sign(circle.vel[1]) * Math.abs(circle.vel[1]);

    // console.log(circle.vel);

    circle.vel[1] = clamp(circle.vel[1], -MAX_VEL, MAX_VEL);

    circleProps[circle.index * 4 + 0] += circle.vel[0];
    circleProps[circle.index * 4 + 1] += circle.vel[1];

    // Left border
    if (
      circleProps[circle.index * 4 + 0] - circleProps[circle.index * 4 + 2] <=
      -borderSize
    ) {
      circleProps[circle.index * 4 + 0] = Math.max(
        -borderSize + circleProps[circle.index * 4 + 2],
        circleProps[circle.index * 4 + 0]
      );
      circle.vel[0] = Math.abs(circle.vel[0]);
    }

    // Right border
    if (
      circleProps[circle.index * 4 + 0] + circleProps[circle.index * 4 + 2] >=
      borderSize
    ) {
      circleProps[circle.index * 4 + 0] = Math.min(
        borderSize - circleProps[circle.index * 4 + 2],
        circleProps[circle.index * 4 + 0]
      );
      circle.vel[0] = -Math.abs(circle.vel[0]);
    }

    // Top border
    if (
      circleProps[circle.index * 4 + 1] + circleProps[circle.index * 4 + 2] >=
      borderSize
    ) {
      circleProps[circle.index * 4 + 1] = Math.min(
        borderSize - circleProps[circle.index * 4 + 2],
        circleProps[circle.index * 4 + 1]
      );
      circle.vel[1] = -Math.abs(circle.vel[1]);
    }

    // Bottom border
    if (
      circleProps[circle.index * 4 + 1] - circleProps[circle.index * 4 + 2] <=
      -borderSize
    ) {
      circleProps[circle.index * 4 + 1] = Math.max(
        -borderSize + circleProps[circle.index * 4 + 2],
        circleProps[circle.index * 4 + 1]
      );
      circle.vel[1] = Math.abs(circle.vel[1]);
    }
  });
}

function getAspectRatio() {
  return window.innerWidth / window.innerHeight;
}

function getCanvasHeight(canvas) {
  return canvas.width / getAspectRatio();
}

function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

function displayText(text, delay = 0) {
  setTimeout(() => {
    textBox.innerText = text;
    textBox.style.opacity = "1.0";
  }, delay);
}

function hideText(delay = 0) {
  setTimeout(() => (textBox.style.opacity = "0.0"), delay);
}

interface OtherCircle {
  index: number;
  vel: Float32Array;
  animation: Animation;
}

interface PlayerCircle {
  props: Float32Array;
  vel: Float32Array;
  animation: Animation;
}

interface Animation {
  startTime: number;
  endTime: number;
  startValue: number;
  endValue: number;
  currentValue: number;
}

interface Camera {
  props: Float32Array;
}

interface GameProgramCache extends ProgramCache {
  uniforms: {
    uRes: WebGLUniformLocation | null;
    uPlayerProps: WebGLUniformLocation | null;
    uCircleProps: WebGLUniformLocation | null;
    uCameraProps: WebGLUniformLocation | null;
    uTime: WebGLUniformLocation | null;
    uBorder: WebGLUniformLocation | null;
  };
}

interface GameState {
  started: boolean;
}

function lerp(x1: number, x2: number, t: number) {
  return x1 * (1 - t) + x2 * t;
}

// https://easings.net/#
function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;

  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function randomFloatBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randomSign(): number {
  return Math.random() < 0.5 ? -1 : 1;
}
