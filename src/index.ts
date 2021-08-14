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

import { inputState } from "./input";

const canvas: HTMLCanvasElement = document.createElement("canvas");
const ctx = canvas.getContext("webgl");
const width = 1024;
const height = 1024;
const MOVING_SPEED = 0.003;
const MAX_VEL = MOVING_SPEED * 2;
const FRICTION = 0.96;
const MIN_VEL_THRESHOLD = 0.00015;

canvas.id = "game";
canvas.width = width;
canvas.height = height;
const div = document.createElement("div");
div.appendChild(canvas);
document.body.appendChild(canvas);
const res = new Float32Array([canvas.width, canvas.height]);

const player: Circle = {
  pos: new Float32Array([0.0, 0.5]),
  vel: new Float32Array([0.0, 0.0]),
  r: 1.0,
};

const soundBank: { [key: string]: Sound | null } = {
  move: null,
  absorb: null,
  absorbed: null,
};

const circleStartX = -0.2;
// prettier-ignore
const circlePos = new Float32Array([
 .45, .45,
 .9, .9,
 -circleStartX, -0.
]);

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

const programInfo: ProgramCache = {
  attributes: {
    aSquarePosition: ctx.getAttribLocation(program, "aSquarePosition"),
  },
  uniforms: {
    uRes: ctx.getUniformLocation(
      program,
      FRAGMENT_SHADER.uniforms["uRes"].variableName
    ),
    uPosition: ctx.getUniformLocation(
      program,
      FRAGMENT_SHADER.uniforms["uPosition"].variableName
    ),
    uCirclePos: ctx.getUniformLocation(
      program,
      FRAGMENT_SHADER.uniforms["uCirclePos"].variableName
    ),
    uTime: ctx.getUniformLocation(
      program,
      FRAGMENT_SHADER.uniforms["uTime"].variableName
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

  player.pos[0] += player.vel[0];
  player.pos[1] += player.vel[1];
}

function playAudio() {
  const playerMoved = distance(player.vel[0], player.vel[1], 0, 0);
  if (playerMoved >= MIN_VEL_THRESHOLD) {
    playSoundBankFunction("move", playMoveChord);
  } else {
    stopSoundBankFunction("move", 0.75);
  }
}

function tick(t: number) {
  requestAnimationFrame(tick);

  updatePlayerPosition();
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

  //////////////// player pos
  ctx.uniform2fv(programInfo.uniforms.uPosition, player.pos);

  //////////////// circle pos
  ctx.uniform2fv(programInfo.uniforms.uCirclePos, circlePos);

  //////////////// time
  ctx.uniform1f(programInfo.uniforms.uTime, t);

  //////////// draw
  ctx.drawArrays(ctx.TRIANGLES, 0, 6);

  if (checkCircleIntersection(circlePos[4], circlePos[5], 0.05)) {
    playSoundBankFunction("absorb", playAbsorbChord);
  } else {
    stopSoundBankFunction("absorb");
  }

  if (checkCircleAbsorption(circlePos[4], circlePos[5], 0.025)) {
    playSoundBankFunction("absorbed", playAbsorbedChord);
  } else {
    stopSoundBankFunction("absorbed", 2);
  }
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
  return distance(player.pos[0], player.pos[1], x, y);
}

function checkCircleAbsorption(x: number, y: number, r: number): boolean {
  const d = distanceBetweenCircles(x, y);
  return 0.1 > 0.025 + d;
}

function updateCircles(t: number) {
  circlePos[4] = circleStartX + Math.sin(t / 1000.0) / 2;
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

interface Circle {
  pos: Float32Array;
  vel: Float32Array;
  r: number;
}