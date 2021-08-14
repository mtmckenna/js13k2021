window.addEventListener("mouseup", inputReleased, false);
window.addEventListener("touchend", inputReleased, false);
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

export const inputState: InputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  s: false,
};

function inputReleased(event: Event) {}

interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  s: boolean;
}
