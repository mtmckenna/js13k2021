window.addEventListener("keydown", (e: KeyboardEvent) => {
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
    case "s":
      inputState.s = true;
      console.log("meow down");
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
    case "s":
      inputState.s = false;
      console.log("meow up");
      break;
  }
});

export function addEventListeners(element: HTMLElement) {
  element.addEventListener("mousedown", inputPressed, false);
  element.addEventListener("mousemove", mouseMoved, false);
  element.addEventListener("mouseup", inputReleased, false);

  element.addEventListener("touchstart", inputPressed, { passive: false });
  element.addEventListener("touchend", inputReleased, { passive: false });
  element.addEventListener("touchmove", inputMoved, { passive: false });
  element.addEventListener("touchcancel", preventDefault, { passive: false });
}

export const inputState: InputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  s: false,
};

function inputPressed(e: MouseEvent | TouchEvent) {
  e.preventDefault();
  let x: number = null;
  let y: number = null;

  if (e instanceof TouchEvent) {
    x = e.changedTouches[0].clientX;
    y = e.changedTouches[0].clientY;
  } else {
    x = e.clientX;
    y = e.clientY;
  }

  x = x / window.innerWidth - 0.5;
  y = y / window.innerHeight - 0.5;
  const MIN_INPUT = 0.01;

  if (Math.abs(x) > MIN_INPUT && x > 0) {
    inputState.left = true;
  }

  if (Math.abs(x) > MIN_INPUT && x < 0) {
    inputState.right = true;
  }

  if (Math.abs(y) > MIN_INPUT && y > 0) {
    inputState.up = true;
  }

  if (Math.abs(y) > MIN_INPUT && y < 0) {
    inputState.down = true;
  }

  // console.log(x, y);
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
  inputPressed(e);
}

function inputMoved(e: MouseEvent | TouchEvent) {
  inputReleased(e);
  inputPressed(e);
}

function preventDefault(e: TouchEvent) {
  e.preventDefault();
  e.stopPropagation();
}

function anyInputPressed() {
  return (
    inputState.up || inputState.right || inputState.down || inputState.left
  );
}

interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  s: boolean;
}
