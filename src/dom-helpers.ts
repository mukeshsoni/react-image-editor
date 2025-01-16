// Function to get relative mouse position in canvas
export function getMousePosInCanvas(
  canvas: HTMLCanvasElement | null,
  event: WheelEvent | MouseEvent,
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
  event: WheelEvent | MouseEvent | TouchEvent,
) {
  if (!canvas) return false;

  const rect = canvas.getBoundingClientRect();
  if (event.touches) {
    return {
      x: event.touches[0].pageX - rect.left,
      y: event.touches[0].pageY - rect.top,
    };
  }
  return (
    event.pageX >= rect.left &&
    event.pageX <= rect.right &&
    event.pageY >= rect.top &&
    event.pageY <= rect.bottom
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
