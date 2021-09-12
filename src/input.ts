import { createAudioContext, setVolume } from "./audio";
import { gameState, VOLUME } from "./index";

let inputPressedOnce = false;

window.addEventListener("keydown", (e: KeyboardEvent) => {
  handleInitialInput();
  switch (e.key) {
    case "ArrowLeft":
      inputState.left = true;
      break;
    case "ArrowRight":
      inputState.right = true;
      break;
    case "ArrowUp":
      inputState.up = true;
      break;
    case "ArrowDown":
      inputState.down = true;
      break;
  }
});

window.addEventListener("keyup", (e: KeyboardEvent) => {
  switch (e.key) {
    case "ArrowLeft":
      inputState.left = false;
      break;
    case "ArrowRight":
      inputState.right = false;
      break;
    case "ArrowUp":
      inputState.up = false;
      break;
    case "ArrowDown":
      inputState.down = false;
      break;
  }
});

export function addEventListeners(element: HTMLElement) {
  element.addEventListener("mousedown", mousePressed, false);
  element.addEventListener("mousemove", mouseMoved, false);
  element.addEventListener("mouseup", inputReleased, false);

  element.addEventListener("touchstart", touchPressed, { passive: false });
  element.addEventListener("touchend", inputReleased, { passive: false });
  element.addEventListener("touchmove", touchMoved, { passive: false });
  element.addEventListener("touchcancel", preventDefault, { passive: false });
}

export function userHasInteracted(): boolean {
  return inputPressedOnce;
}

export const inputState: InputState = {
  left: false,
  right: false,
  up: false,
  down: false,
};

export function resetInput() {
  inputState.left = false;
  inputState.right = false;
  inputState.up = false;
  inputState.down = false;
}

function touchPressed(e: TouchEvent) {
  e.preventDefault();

  const x = e.changedTouches[0].clientX;
  const y = e.changedTouches[0].clientY;

  inputPressed(x, y);
}

function mousePressed(e: MouseEvent) {
  e.preventDefault();

  const x = e.clientX;
  const y = e.clientY;
  inputPressed(x, y);
}

function inputPressed(xInput: number, yInput: number) {
  let x = xInput / window.innerWidth - 0.5;
  let y = yInput / window.innerHeight - 0.5;
  const MIN_INPUT = 0.01;

  if (Math.abs(x) > MIN_INPUT && x > 0) {
    inputState.right = true;
  }

  if (Math.abs(x) > MIN_INPUT && x < 0) {
    inputState.left = true;
  }

  if (Math.abs(y) > MIN_INPUT && y > 0) {
    inputState.down = true;
  }

  if (Math.abs(y) > MIN_INPUT && y < 0) {
    inputState.up = true;
  }

  handleInitialInput();
}

function handleInitialInput() {
  if (!inputPressedOnce) {
    inputPressedOnce = true;
    createAudioContext();
    setVolume(gameState.audio ? VOLUME : 0.0);
  }
}

function inputReleased(e: MouseEvent | TouchEvent) {
  e.preventDefault();
  e.stopPropagation();
  inputState.up = false;
  inputState.right = false;
  inputState.down = false;
  inputState.left = false;
}

function mouseMoved(e: MouseEvent) {
  if (!anyInputPressed()) return;
  inputReleased(e);
  mousePressed(e);
}

function touchMoved(e: TouchEvent) {
  inputReleased(e);
  touchPressed(e);
}

function preventDefault(e: TouchEvent) {
  e.preventDefault();
  e.stopPropagation();
}

export function anyInputPressed() {
  return (
    inputState.up || inputState.right || inputState.down || inputState.left
  );
}

interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}
