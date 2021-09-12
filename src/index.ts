import { GlslShader } from "webpack-glsl-minify";
import { compiledProgram, configureBuffer } from "./webgl-helpers";
import {
  Camera,
  Circle,
  GameProgramCache,
  GameState,
  LevelProps,
} from "./types";
import {
  anyInputPressed,
  inputState,
  addEventListeners,
  resetInput,
} from "./input";

import {
  clamp,
  easeOutBack,
  lerp,
  lerpVec3,
  randomFloatBetween,
  randomNormalFloatBetween,
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
  setVolume,
  getVolume,
} from "./audio";

const VERTEX_SHADER = require("./shaders/vertex.vert") as GlslShader;
const FRAGMENT_SHADER = require("./shaders/fragment.frag") as GlslShader;
const canvas: HTMLCanvasElement = document.createElement("canvas");
const ctx = canvas.getContext("webgl");
const MAX_RESOLUTION = 800;
const MOVING_ACC = 0.0003;
const OTHER_CIRCLE_SLOWNESS = 0.15;
const MAX_VEL = 0.004;
const MAX_VEL_OTHER_CIRCLES = MAX_VEL * OTHER_CIRCLE_SLOWNESS;
const MAX_ACC = MOVING_ACC * 1;
const FRICTION = 0.98;
const MIN_VEL_THRESHOLD = 0.00015;
const GROW_TIME = 500;
const START_SIZE = 0.01;
const START_SIZE_BOOST = 0.001;
const START_SIZE_BOOST_LIMIT_COUNT = 500;
const MOVE_LIMIT_COUNT = 100;
const RESTART_TIME = 2500;
const VOLUME = 0.2;

const circles: Array<Circle> = [];

let NUM_CIRCLES = 25;
let MIN_CIRCLE_SIZE = 0.01;
let MAX_CIRCLE_SIZE = 0.1;
let MIN_CIRCLE_START_VEL = 0.001;
let MAX_CIRCLE_START_VEL = 0.002;

const times: number[] = [];
let fps;

const gameState: GameState = {
  audio: false,
  started: false,
  currentLevel: 1,
  gameOver: false,
  gameWon: false,
  levelWon: false,
  dimensions: { width: -1, height: -1 },
  readyToTryAgainAt: 0,
};

const levelPropMap: Array<LevelProps> = [
  { borderSize: 1.5, numCircles: 25 },
  { borderSize: 0.25, numCircles: 3 },
  { borderSize: 0.75, numCircles: 5 },
];

const circleProps = new Float32Array(NUM_CIRCLES * 4);
const circleColorProps = new Float32Array(NUM_CIRCLES * 4).fill(0.0);

canvas.id = "game";
const div = document.createElement("div");
div.appendChild(canvas);
document.body.appendChild(canvas);

const fpsBox = document.createElement("div");
fpsBox.classList.add("fps");
fpsBox.innerText = "0";

document.body.appendChild(fpsBox);

const textBox = document.createElement("div");
textBox.classList.add("text");
document.body.appendChild(textBox);

const levelBox = document.createElement("div");
levelBox.classList.add("ui");
levelBox.id = "level";
document.body.appendChild(levelBox);
levelBox.innerText = levelText();

const audioBox = document.createElement("div");
audioBox.classList.add("ui");
audioBox.id = "audio";
document.body.appendChild(audioBox);
audioBox.innerText = audioText();
audioBox.addEventListener("click", () => {
  if (getVolume() > 0) {
    setVolume(0);
    gameState.audio = false;
  } else {
    setVolume(VOLUME);
    gameState.audio = true;
  }
});

setVolume(gameState.audio ? VOLUME : 0.0);

setTimeout(() => displayText("be the biggest"), 1);

addEventListeners(canvas);

const res = new Float32Array([canvas.width, canvas.height]);
const initialPlayerProps = [0.0, 0.0, START_SIZE, 0.0];
const player: Circle = newCircleProps(0, START_SIZE, new Float32Array([0, 0]));

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
    uCircleColorProps: ctx.getUniformLocation(
      program,
      FRAGMENT_SHADER.uniforms["uCircleColorProps"].variableName
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
    uGameWon: ctx.getUniformLocation(
      program,
      FRAGMENT_SHADER.uniforms["uGameWon"].variableName
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
  if (size === 0) return 1.0;
  const ratio = START_SIZE / size;
  return lerp(0.75, 1.0, ratio);
}

function resize() {
  const width = Math.min(window.innerWidth, MAX_RESOLUTION);
  const height = Math.min(window.innerHeight, MAX_RESOLUTION);
  const oldWidth = gameState.dimensions.width;
  const oldHeight = gameState.dimensions.height;
  if (width === oldWidth && height === oldHeight) return;

  canvas.width = width;
  canvas.height = height;
  ctx.viewport(0, 0, width, height);

  gameState.dimensions.width = width;
  gameState.dimensions.height = height;
}

function getLevelProps(): LevelProps {
  const { currentLevel } = gameState;
  return levelPropMap[currentLevel - 1];
}

function nextLevel() {
  if (gameState.currentLevel == levelPropMap.length) {
    console.log(
      "YOU WON THE WHOLE THING",
      gameState.currentLevel,
      levelPropMap.length
    );
    gameState.gameWon = true;
    displayText("absorption complete<br />good job");
  } else {
    console.log(gameState.currentLevel);
    gameState.currentLevel++;
    console.log(gameState.currentLevel);
    resetLevel();
  }
}

function resetLevel() {
  hideText(1000);
  gameState.levelWon = false;
  gameState.gameOver = false;
  const levelProps = getLevelProps();
  const { borderSize, numCircles } = levelProps;
  console.log(borderSize, numCircles);
  const playerCircleProps = newCircleProps(
    0,
    (MAX_CIRCLE_SIZE - MIN_CIRCLE_SIZE) / 2,
    new Float32Array([0, 0])
  );

  updateCircleWithProps(player, playerCircleProps);
  circleProps.set([...initialPlayerProps], 0);

  circles.length = 0;
  circles.push(player);
  for (let i = 1; i < NUM_CIRCLES; i++) {
    // Always generate the max number of circles so we have the same number of circles passed to the shader
    // but if we have fewer circles in the level, set their radius to zero
    const radius =
      i < numCircles
        ? randomNormalFloatBetween(MIN_CIRCLE_SIZE, MAX_CIRCLE_SIZE)
        : 0;

    let x2 = randomFloatBetween(-borderSize + radius, borderSize - radius);
    let y2 = randomFloatBetween(-borderSize + radius, borderSize - radius);

    circleProps[i * 4 + 0] = x2;
    circleProps[i * 4 + 1] = y2;
    circleProps[i * 4 + 2] = radius;
    circleProps[i * 4 + 3] = 0; //unused

    const vel = new Float32Array([
      randomSign() *
        randomFloatBetween(MIN_CIRCLE_START_VEL, MAX_CIRCLE_START_VEL),
      randomSign() *
        randomFloatBetween(MIN_CIRCLE_START_VEL, MAX_CIRCLE_START_VEL),
    ]);

    circles.push(newCircleProps(i, radius, vel));
  }

  let boostLimitCount = 0;
  while (playerIsTooSmall() && boostLimitCount < START_SIZE_BOOST_LIMIT_COUNT) {
    boostLimitCount++;
    player.radius += START_SIZE_BOOST;
    circleProps[0 + 2] = player.radius;
  }

  if (boostLimitCount >= START_SIZE_BOOST_LIMIT_COUNT) {
    console.warn("HIT BOOST LIMIT COUNT");
  } else {
    console.log(`Boosted ${boostLimitCount} times...`);
  }

  let moveLimitCount = 0;
  let playerPositionSet = false;
  let x1 = circleProps[0 + 0];
  let y1 = initialPlayerProps[0 + 1];
  let r1 = player.radius;

  while (!playerPositionSet || moveLimitCount > MOVE_LIMIT_COUNT) {
    playerPositionSet = true;
    moveLimitCount++;
    for (let i = 1; i < circles.length; i++) {
      const circle = circles[i];
      const x2 = circleProps[i * 4 + 0];
      const y2 = circleProps[i * 4 + 1];
      const r2 = circle.radius;
      if (checkCircleIntersection(x1, y1, r1, x2, y2, r2)) {
        playerPositionSet = false;
        x1 = randomFloatBetween(
          -borderSize + player.radius,
          borderSize - player.radius
        );
        y1 = randomFloatBetween(
          -borderSize + player.radius,
          borderSize - player.radius
        );
        continue;
      }
    }

    circleProps[0 + 0] = x1;
    circleProps[0 + 1] = y1;
  }
}

function updateCircleWithProps(circle: Circle, props: Circle) {
  circle.index = circle.index;
  circle.radius = props.radius;
  circle.color = props.color;
  circle.vel = props.vel;
  circle.acc = props.acc;
  circle.animation = props.animation;
}

function newCircleProps(i: number, radius: number, vel: Float32Array) {
  return {
    index: i,
    vel: vel,
    acc: new Float32Array([0, 0]),
    color: new Float32Array([1.0, 1.0, 1.0, 1.0]),
    radius: radius,
    animation: {
      startTime: 0,
      endTime: 0,
      startValue: radius,
      endValue: radius,
      currentValue: radius,
    },
  };
}

function levelText(): string {
  return `level ${gameState.currentLevel} of ${levelPropMap.length}`;
}

function audioText(): string {
  const onOff = gameState.audio ? "on" : "off";
  return `audio ${onOff}`;
}

function updateCameraPosition() {
  camera.props[0] = circleProps[player.index + 0];
  camera.props[1] = circleProps[player.index + 1];

  // stop camera at border
  const levelProps = getLevelProps();
  const { borderSize } = levelProps;
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

function startGame(t: number) {
  const unstarted =
    !gameState.started || (gameState.started && gameState.levelWon);

  if (unstarted && t > gameState.readyToTryAgainAt) {
    if (anyInputPressed()) {
      gameState.started = true;
      if (gameState.gameOver) resetLevel();
      if (gameState.levelWon && !gameState.gameWon) nextLevel();
    }
  }
}

function gameOverTooSmall(t: number) {
  gameOver(t, "you are too small<br />try again");
}

function gameOverAbsorbed(t: number) {
  gameOver(t, "you were absorbed<br />try again");
}

function gameOver(t: number, text: string) {
  gameState.gameOver = true;
  gameState.started = false;
  gameState.readyToTryAgainAt = t + RESTART_TIME;
  resetInput();
  displayText(text);
}

// https://www.growingwiththeweb.com/2017/12/fast-simple-js-fps-counter.html
function updateFps() {
  const now = performance.now();
  while (times.length > 0 && times[0] <= now - 1000) {
    times.shift();
  }
  times.push(now);
  fps = times.length;
  fpsBox.innerText = fps;
}

function tick(t: number) {
  requestAnimationFrame(tick);
  resize();
  startGame(t);

  const playerLost = !gameState.started && gameState.gameOver;
  if (gameState.started || playerLost) {
    handleInput();
    updateCircles(t);

    if (
      !gameState.gameWon &&
      !gameState.levelWon &&
      !gameState.gameOver &&
      playerIsBiggest()
    )
      won(t);
  }

  playAudio();
  updateCameraPosition();
  checkCollisions(t);

  draw(t);
  updateFps();
  updateUi();
}

function updateUi() {
  const currentAudioText = audioBox.textContent;
  const updatedAudioText = audioText();
  if (currentAudioText !== updatedAudioText)
    audioBox.innerText = updatedAudioText;

  const currentLevelText = levelBox.textContent;
  const updatedLevelText = levelText();
  if (currentLevelText !== updatedLevelText)
    levelBox.innerText = updatedLevelText;
}

resetLevel();
requestAnimationFrame(tick);

function checkCollisions(t: number) {
  circleColorProps.fill(0.0);
  // Cache collision checks?
  for (let i = 0; i < circleProps.length; i += 4) {
    const iCircleIndex = Math.floor(i / 4);
    const iCircle = circles[iCircleIndex];
    if (i === 0) {
      circleColorProps[i + 0] = 0.0;
      circleColorProps[i + 1] = 1.0;
      circleColorProps[i + 2] = 0.0;
    } else {
      circleColorProps[i + 0] = 1.0;
      circleColorProps[i + 1] = 1.0;
      circleColorProps[i + 2] = 1.0;
    }

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

      if (intersects) {
        const smallerIndex = r1 < r2 ? i : j;
        circleColorProps[smallerIndex + 3] = 1.0;

        // circles[absorberIndex].animation.startTime = t;
        // circles[absorberIndex].animation.endTime = t + GROW_TIME;
        // circles[absorberIndex].animation.startValue =
        //   circleProps[absorberIndexProps + 2];
        // absorberCircle.radius += absorbeeCircle.radius / 4;
        // circles[absorberIndex].animation.endValue = absorberCircle.radius;
        // circles[absorbeeIndex].animation.startTime = t;
        // circles[absorbeeIndex].animation.endTime = t + GROW_TIME;
        // circles[absorbeeIndex].animation.startValue =
        //   circleProps[absorbeeIndexProps + 2];
        // absorbeeCircle.radius = 0;
        // circles[absorbeeIndex].animation.endValue = absorbeeCircle.radius;
      }
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
        grow(absorberCircle, absorbeeCircle);
        circles[absorberIndex].animation.endValue = absorberCircle.radius;

        circles[absorbeeIndex].animation.startTime = t;
        circles[absorbeeIndex].animation.endTime = t + GROW_TIME;
        circles[absorbeeIndex].animation.startValue =
          circleProps[absorbeeIndexProps + 2];
        absorbeeCircle.radius = 0;
        circles[absorbeeIndex].animation.endValue = absorbeeCircle.radius;

        if (absorbeeIndex === 0) gameOverAbsorbed(t);

        if (!gameState.levelWon && !gameState.gameOver && playerIsTooSmall()) {
          gameOverTooSmall(t);
        }

        // stopSoundBankFunction("absorbed", 2);
      }
    }
  }
}

function grow(absorberCircle: Circle, absorbeeCircle: Circle) {
  absorberCircle.radius = calculateGrowthRadius(
    absorberCircle.radius,
    absorbeeCircle.radius
  );
}

function calculateGrowthRadius(
  absorberCircleRadius: number,
  absorbeeCircleRadius: number
): number {
  return absorberCircleRadius + absorbeeCircleRadius / 8;
}

function won(t: number) {
  console.log("WON level", gameState.currentLevel);
  gameState.levelWon = true;
  gameState.readyToTryAgainAt = t + RESTART_TIME;
  resetInput();

  if (gameState.currentLevel == levelPropMap.length) {
    console.log(
      "YOU WON THE WHOLE THING",
      gameState.currentLevel,
      levelPropMap.length
    );
    gameState.gameWon = true;
    displayText("absorption complete<br />good job");
  } else {
    displayText(
      `${gameState.currentLevel} of ${levelPropMap.length} complete<br />`
    );
  }
}

// let displayedOnce = false;
const radiusSort = (a: Circle, b: Circle) => a.radius - b.radius;
function playerIsTooSmall(): boolean {
  let playerIsTooSmall = false;
  // TODO: !!! expensive
  const sortedCircles = [...circles].sort(radiusSort);
  let theoPlayerRadius = player.radius;

  for (let i = 0; i < sortedCircles.length; i++) {
    const circle = sortedCircles[i];
    if (circle === player) continue;
    if (circle.radius === 0) continue;

    if (theoPlayerRadius < circle.radius) {
      playerIsTooSmall = true;
      break;
    }

    theoPlayerRadius = calculateGrowthRadius(theoPlayerRadius, circle.radius);
  }

  return playerIsTooSmall;
}

function playerIsBiggest(): boolean {
  let isPlayerTheBiggest = true;
  const playerRadius = player.radius;
  for (let i = 1; i < circles.length; i++) {
    const otherCircleRadius = circles[i].radius;
    isPlayerTheBiggest = playerRadius > otherCircleRadius;
    if (!isPlayerTheBiggest) break;
  }

  return isPlayerTheBiggest;
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
  const levelProps = getLevelProps();
  const { borderSize, numCircles } = levelProps;
  // console.log(borderSize, numCircles);
  ctx.uniform1f(programInfo.uniforms.uBorder, borderSize);

  //////////////// circle props
  // ctx.uniform1i(programInfo.uniforms.uNumCircles, NUM_CIRCLES);
  ctx.uniform4fv(programInfo.uniforms.uCircleProps, circleProps);
  ctx.uniform4fv(programInfo.uniforms.uCircleColorProps, circleColorProps);

  //////////////// time
  ctx.uniform1f(programInfo.uniforms.uTime, t);

  //////////////// game won
  ctx.uniform1i(programInfo.uniforms.uGameWon, gameState.gameWon ? 1 : 0);

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

function updateCircleVelocity(circle: Circle) {
  if (circle.radius === 0) return;
  const levelProps = getLevelProps();
  const { borderSize } = levelProps;
  const sizeFactor = velSizeFactor(circle.radius);

  if (circle.index !== player.index) {
    const xAcc = accelerationForCircleVelocity(circle.vel[0]);
    const yAcc = accelerationForCircleVelocity(circle.vel[1]);

    circle.acc[0] += clamp(xAcc, -MAX_ACC, MAX_ACC);
    circle.acc[1] += clamp(yAcc, -MAX_ACC, MAX_ACC);
  }

  const maxVel =
    circle.index === player.index ? MAX_VEL : MAX_VEL_OTHER_CIRCLES;

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
}

// TODO: Add AI to go after circles?
function updateCircles(t: number) {
  // const levelProps = getLevelProps();
  // const { borderSize } = levelProps;
  for (let i = 0; i < circles.length; i++) {
    const circle = circles[i];

    updateCircleVelocity(circle);

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
    textBox.innerHTML = text;
    textBox.style.opacity = "1.0";
  }, delay);
}

function hideText(delay = 0) {
  setTimeout(() => {
    textBox.style.opacity = "0.0";
  }, delay);
}
