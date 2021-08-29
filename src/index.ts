import { GlslShader } from "webpack-glsl-minify";
import { compiledProgram, configureBuffer } from "./webgl-helpers";
import { Camera, Circle, GameProgramCache, GameState } from "./types";
import { inputState, addEventListeners } from "./input";

import {
  clamp,
  easeOutBack,
  lerp,
  randomFloatBetween,
  randomSign,
} from "./math-helpers";

import {
  playMove,
  playMoveChord,
  playAbsorbChord,
  playAbsorbedChord,
  playBackground,
  stopSound,
  Sound,
} from "./audio";

const VERTEX_SHADER = require("./shaders/vertex.vert") as GlslShader;
const FRAGMENT_SHADER = require("./shaders/fragment.frag") as GlslShader;
const canvas: HTMLCanvasElement = document.createElement("canvas");
const ctx = canvas.getContext("webgl");
const width = 800;
const height = 600;
const MOVING_ACC = 0.0003;
const OTHER_CIRCLE_SLOWNESS = 0.5;
const MAX_VEL = 0.003;
const MAX_VEL_OTHER_CIRCLES = MAX_VEL * OTHER_CIRCLE_SLOWNESS;
const MAX_ACC = MOVING_ACC * 1;
const FRICTION = 0.98;
const MIN_VEL_THRESHOLD = 0.00015;
const GROW_TIME = 500;
const START_SIZE = 0.05;

const circles: Array<Circle> = [];

let NUM_CIRCLES = 50;
let MIN_CIRCLE_SIZE = 0.01;
let MAX_CIRCLE_SIZE = 0.1;
let MIN_CIRCLE_START_VEL = 0.001;
let MAX_CIRCLE_START_VEL = 0.002;

let borderSize = 2.0;

const gameState: GameState = {
  started: false,
  level: 0,
  gameOver: false,
};

const circleProps = new Float32Array(NUM_CIRCLES * 4);

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

const initialPlayerProps = [0.0, 0.0, START_SIZE, 0.0];
const player: Circle = {
  index: 0,
  radius: START_SIZE,
  vel: new Float32Array([0.0, 0.0]),
  acc: new Float32Array([0.0, 0.0]),
  animation: {
    startTime: 0,
    endTime: 0,
    startValue: START_SIZE,
    endValue: START_SIZE,
    currentValue: START_SIZE,
  },
};

const camera: Camera = {
  props: new Float32Array([0.0, 0.0, 0.0, 0.0]),
};

const soundBank: { [key: string]: Sound | null } = {
  move: null,
  absorb: null,
  absorbed: null,
};

// prettier-ignore
const squarePositions = new Float32Array([
  -1,  1,
   1,  1,
  -1, -1,
 
  -1, -1,
   1,  1,
   1, -1
]);

// let backgroundSound = null;

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

function handleInput() {
  if (gameState.gameOver) return;

  player.acc[0] = 0;
  player.acc[1] = 0;
  if (inputState.left) player.acc[0] -= MOVING_ACC;
  if (inputState.right) player.acc[0] += MOVING_ACC;
  if (inputState.up) player.acc[1] += MOVING_ACC;
  if (inputState.down) player.acc[1] -= MOVING_ACC;
  const sizeFactor = velSizeFactor(player.radius);

  player.acc[0] += clamp(player.acc[0] * sizeFactor, -MAX_ACC, MAX_ACC);
  player.acc[1] += clamp(player.acc[1] * sizeFactor, -MAX_ACC, MAX_ACC);
}

function velSizeFactor(size: number): number {
  const ratio = START_SIZE / size;
  return lerp(0.15, 1.0, ratio);
}

function resetLevel() {
  player.radius = START_SIZE;
  circleProps.set([...initialPlayerProps], 0);

  circles.push(player);
  for (let i = 1; i < NUM_CIRCLES; i++) {
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
      acc: new Float32Array([0, 0]),
      radius: radius,
      animation: {
        startTime: 0,
        endTime: 0,
        startValue: START_SIZE,
        endValue: START_SIZE,
        currentValue: START_SIZE,
      },
    });
  }
}

function updateCameraPosition() {
  camera.props[0] = circleProps[player.index + 0];
  camera.props[1] = circleProps[player.index + 1];

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

  // if (inputState.s) {
  //   if (!backgroundSound) {
  //     console.log("BG SOUND");
  //     backgroundSound = playBackground();
  //   }
  //   // playSoundBankFunction("move", playMoveChord);
  // } else {
  //   // stopSoundBankFunction("move");
  // }
}

function startGame() {
  if (!gameState.started) {
    if (
      inputState.up ||
      inputState.right ||
      inputState.down ||
      inputState.left
    ) {
      gameState.started = true;
      if (gameState.gameOver) resetLevel();
      gameState.gameOver = false;
      hideText();
      goToLevel(1);
    }
  }
}

function gameOver() {
  gameState.gameOver = true;
  gameState.started = false;
  displayText("game over you were absorbed");
}

function goToLevel(levelNumber: number) {
  gameState.level = 1;
  displayText("be the biggest", 1500);
  setTimeout(() => hideText(), 3000);
}

function tick(t: number) {
  requestAnimationFrame(tick);
  startGame();

  if (gameState.started || (!gameState.started && gameState.gameOver)) {
    handleInput();
    updateCircles(t);
  }

  playAudio();
  updateCameraPosition();
  checkCollisions(t);
  draw(t);
}

resetLevel();
requestAnimationFrame(tick);

function checkCollisions(t: number) {
  // Cache collision checks?
  for (let i = 0; i < circleProps.length; i += 4) {
    const iCircleIndex = Math.floor(i / 4);
    const iCircle = circles[iCircleIndex];
    for (let j = i + 4; j < circleProps.length; j += 4) {
      const jCircleIndex = Math.floor(j / 4);
      const jCircle = circles[jCircleIndex];
      const x1 = circleProps[i];
      const y1 = circleProps[i + 1];
      const r1 = iCircle.radius;
      const x2 = circleProps[j];
      const y2 = circleProps[j + 1];
      const r2 = jCircle.radius;

      if (r1 === 0.0 || r2 === 0.0) continue;

      const intersects = checkCircleIntersection(x1, y1, r1, x2, y2, r2);
      // if (intersects) {
      //   playSoundBankFunction("absorb", playAbsorbChord);
      // } else {
      //   stopSoundBankFunction("absorb");
      // }

      let absorbed = false;
      let absorberIndex: number = null;
      let absorbeeIndex: number = null;
      let absorberIndexProps: number = null;
      let absorbeeIndexProps: number = null;
      let absorberCircle: Circle = null;
      let absorbeeCircle: Circle = null;

      if (r1 > r2) {
        absorbed = checkCircleAbsorption(x1, y1, r1, x2, y2, r2);
        absorberIndex = iCircleIndex;
        absorbeeIndex = jCircleIndex;
        absorberIndexProps = i;
        absorbeeIndexProps = j;
        absorberCircle = circles[iCircleIndex];
        absorbeeCircle = circles[jCircleIndex];
      } else if (r2 > r1) {
        absorbed = checkCircleAbsorption(x2, y2, r2, x1, y1, r1);
        absorberIndex = jCircleIndex;
        absorbeeIndex = iCircleIndex;
        absorberIndexProps = j;
        absorbeeIndexProps = i;
        absorberCircle = circles[jCircleIndex];
        absorbeeCircle = circles[iCircleIndex];
      }

      if (absorbed) {
        circles[absorberIndex].animation.startTime = t;
        circles[absorberIndex].animation.endTime = t + GROW_TIME;
        circles[absorberIndex].animation.startValue =
          circleProps[absorberIndexProps + 2];
        absorberCircle.radius += absorbeeCircle.radius / 4;
        circles[absorberIndex].animation.endValue = absorberCircle.radius;

        circles[absorbeeIndex].animation.startTime = t;
        circles[absorbeeIndex].animation.endTime = t + GROW_TIME;
        circles[absorbeeIndex].animation.startValue =
          circleProps[absorbeeIndexProps + 2];
        absorbeeCircle.radius = 0;
        circles[absorbeeIndex].animation.endValue = absorbeeCircle.radius;

        if (absorbeeIndex === 0) gameOver();
        // stopSoundBankFunction("absorbed", 2);
      }
    }
  }
}

function draw(t: number) {
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

  //////////////// camera props
  ctx.uniform4fv(programInfo.uniforms.uCameraProps, camera.props);

  //////////////// border props
  ctx.uniform1f(programInfo.uniforms.uBorder, borderSize);

  //////////////// circle props
  // ctx.uniform1i(programInfo.uniforms.uNumCircles, NUM_CIRCLES);
  ctx.uniform4fv(programInfo.uniforms.uCircleProps, circleProps);

  //////////////// time
  ctx.uniform1f(programInfo.uniforms.uTime, t);

  //////////// draw
  ctx.drawArrays(ctx.TRIANGLES, 0, 6);
}

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

function checkCircleIntersection(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number
): boolean {
  const difference = Math.abs(r1 - r2);
  const sum = r1 + r2;
  const d = distanceBetweenCircles(x1, y1, x2, y2);
  return difference <= d && d <= sum;
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function distanceBetweenCircles(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return distance(x1, y1, x2, y2);
}

function checkCircleAbsorption(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number
): boolean {
  const d = distanceBetweenCircles(x1, y1, x2, y2);
  return r1 > r2 + d;
}

function accelerationForCircleVelocity(v: number): number {
  return v === 0 ? MOVING_ACC : Math.sign(v) * MOVING_ACC;
}

function updateCircles(t: number) {
  for (let i = 0; i < circles.length; i++) {
    const circle = circles[i];

    const sizeFactor = velSizeFactor(circle.radius);

    if (i !== player.index) {
      const xAcc = accelerationForCircleVelocity(circle.vel[0]);
      const yAcc = accelerationForCircleVelocity(circle.vel[1]);

      circle.acc[0] += clamp(xAcc, -MAX_ACC, MAX_ACC);
      circle.acc[1] += clamp(yAcc, -MAX_ACC, MAX_ACC);
    }

    const maxVel = i === player.index ? MAX_VEL : MAX_VEL_OTHER_CIRCLES;

    circle.vel[0] = clamp(
      (circle.vel[0] + circle.acc[0]) * FRICTION,
      -maxVel * sizeFactor,
      maxVel * sizeFactor
    );
    circle.vel[1] = clamp(
      (circle.vel[1] + circle.acc[1]) * FRICTION,
      -maxVel * sizeFactor,
      maxVel * sizeFactor
    );

    // Update position
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
      circle.acc[0] = Math.abs(circle.acc[0]);
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
      circle.acc[0] = -Math.abs(circle.acc[0]);
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
      circle.acc[1] = -Math.abs(circle.acc[1]);
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
      circle.acc[1] = Math.abs(circle.acc[1]);
    }

    // Update grow animation
    if (circle.animation.startTime > 0) {
      let pct = clamp((t - circle.animation.startTime) / GROW_TIME, 0, 1); // get percent through animation, clamp between 0 and 1
      pct = easeOutBack(pct); // add in easing function

      circle.animation.currentValue = lerp(
        circle.animation.startValue,
        circle.animation.endValue,
        pct
      );

      circleProps[circle.index * 4 + 2] = circle.animation.currentValue;
    }
  }
}

function getAspectRatio() {
  return window.innerWidth / window.innerHeight;
}

function getCanvasHeight(canvas) {
  return canvas.width / getAspectRatio();
}

function displayText(text, delay = 0) {
  setTimeout(() => {
    textBox.innerText = text;
    textBox.style.opacity = "1.0";
  }, delay);
}

function hideText(delay = 0) {
  setTimeout(() => {
    textBox.style.opacity = "0.0";
  }, delay);
}
