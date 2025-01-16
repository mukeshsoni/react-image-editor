// Function to get relative mouse position in canvas
export function getMousePos(
  canvas: HTMLCanvasElement | null,
  event: WheelEvent,
) {
  if (!canvas) {
    return { x: 0, y: 0 };
  }

  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

export function isMouseInCanvas(
  canvas: HTMLCanvasElement | null,
  event: WheelEvent,
) {
  if (!canvas) return false;

  const rect = canvas.getBoundingClientRect();
  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  );
}

// Function to get canvas center position
export function getCanvasCenter(canvas: HTMLCanvasElement | null) {
  if (!canvas) return { x: 0, y: 0 };

  return {
    x: canvas.width / 2,
    y: canvas.height / 2,
  };
}

export const getTouchDistance = (touches: TouchList): number => {
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
};
