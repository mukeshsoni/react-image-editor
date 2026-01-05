// Function to get relative mouse position in canvas
type CanvasPointingEvent = {
  clientX: number;
  clientY: number;
};

type CanvasTouchEvent = {
  touches: ArrayLike<{ pageX: number; pageY: number }>;
};

type CanvasPageEvent = {
  pageX: number;
  pageY: number;
};

export function getMousePosInCanvas(
  canvas: HTMLCanvasElement | null,
  event: CanvasPointingEvent,
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
  event: CanvasPageEvent | CanvasTouchEvent,
) {
  if (!canvas) return false;

  const rect = canvas.getBoundingClientRect();
  if ("touches" in event && event.touches?.length) {
    return (
      event.touches[0].pageX >= rect.left &&
      event.touches[0].pageX <= rect.right &&
      event.touches[0].pageY >= rect.top &&
      event.touches[0].pageY <= rect.bottom
    );
  }

  if ("pageX" in event) {
    return (
      event.pageX >= rect.left &&
      event.pageX <= rect.right &&
      event.pageY >= rect.top &&
      event.pageY <= rect.bottom
    );
  }

  return false;
}

// Function to get canvas center position
export function getCanvasCenter(canvas: HTMLCanvasElement | null) {
  if (!canvas) return { x: 0, y: 0 };

  return {
    x: canvas.width / 2,
    y: canvas.height / 2,
  };
}

export const getTouchDistance = (
  touches: ArrayLike<{ pageX: number; pageY: number }>,
): number => {
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
};
