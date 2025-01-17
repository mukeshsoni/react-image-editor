import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  getCanvasCenter,
  getMousePosInCanvas,
  isMouseInCanvas,
  getTouchDistance,
} from "./dom-helpers";

export function calculateInitialImageStartOffset(
  canvas: HTMLCanvasElement | null,
  image: HTMLImageElement,
  zoomLevel: number,
): { x: number; y: number } {
  if (!canvas) {
    return {
      x: 0,
      y: 0,
    };
  }

  const canvasWidth = canvas.width || 800;
  const canvasHeight = canvas.height || 600;

  const imageWidth = image.width;
  const imageHeight = image.height;
  const scaledImageWidth = zoomLevel * imageWidth;
  const scaledImageHeight = zoomLevel * imageHeight;

  // x coordinate where to start drawing the image
  // If the canvas is smaller than the image width, we start drawing the image from outside the canvas peripheries
  // Which means a portion of the image will be clipped
  // As user zoom in further, we start drawing the image ever further beyond the peripheries (say a bigger negative x coordinate)
  // And so a smaller part of the image is inside the canvas and hence the zoom effect
  // To give the effect of zooming around the mouse cursor, we adjust the start coordinates based on the mouse position
  const imageX = (canvasWidth - scaledImageWidth) / 2;
  // y coordinates on where the start drawing the image
  const imageY = (canvasHeight - scaledImageHeight) / 2;

  return { x: imageX, y: imageY };
}

// When we load the image for the first time, we want the image to fit inside the canvas
// If the canvas size is smaller than the image, we want to scale the image down to fit inside the canvas
export function calculateInitialZoomLevel(
  canvas: HTMLCanvasElement | null,
  image: HTMLImageElement,
): number {
  if (!canvas) {
    return 1;
  }

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const imageWidth = image.width;
  const imageHeight = image.height;

  // How much do we need to scale the image on the x axis to fit inside the canvas
  const zoomX = canvasWidth / imageWidth;
  const zoomY = canvasHeight / imageHeight;
  // We take the minimum of zoomX and zoomY so that both ends fit in the canvas
  // If we took the bigger of zoomX and zoomY, the other end would be clipped
  // And then we restrict the zoom level to 1. So that if zoomX and zoomY are > 1
  // because the canvas is bigger than the image, we don't enlarge the image and
  // in the process pixelate it
  const zoomLelvel = Math.min(Math.min(zoomX, zoomY), 1);

  return zoomLelvel;
}

// When panning we don't allow any movement if image is smaller than the canvas
// If image is larger than the canvas, then we stop the panning when the image is at the edge of the canvas
function calculatePanBounds(
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number,
  zoomLevel: number,
) {
  const scaledImageWidth = zoomLevel * imageWidth;
  const scaledImageHeight = zoomLevel * imageHeight;

  // if the image is smaller than the canvas, we don't allow any panning
  if (scaledImageWidth <= canvasWidth) {
    const x = (canvasWidth - scaledImageWidth) / 2;
    return { minX: x, maxX: x, minY: 0, maxY: 0 };
  }

  // If the image is wider than the canvas, allow horizontal panning within bounds
  // minX is negative. We start drawing the image from outside the canvas
  // Once user reaches minX, by panning left, we stop the panning. The right edge
  // of the image will be at the right edge of the canvas at this stage
  const minX = canvasWidth - scaledImageWidth;
  const maxX = 0; // We stop the pan once the image left edge reaches canvas left edge

  // If the image is taller than the canvas, allow vertical panning within bounds
  const minY = canvasHeight - scaledImageHeight;
  const maxY = 0;

  return { minX, maxX, minY, maxY };
}

// We calculate the offset normally during panning. But then clamp the offset by
// the bounds we have set
function clampOffset(
  offset: { x: number; y: number },
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
) {
  return {
    x: Math.min(Math.max(offset.x, bounds.minX), bounds.maxX),
    y: Math.min(Math.max(offset.y, bounds.minY), bounds.maxY),
  };
}

// This is the trickiest part of the whole zoom operation
// I think i still don't understand how it works, but it does work
// We adjust the current offset a slight bit
//  1. Based on change of zoom level
// And then adjust a slight bit more based on the point around which we want to zoom
// The 2nd adjustment makes sure that the part of image below the reference point doesn't move from that point
// We want to cement the position of that point
function calculateImageStartOffsetAroundAReferencePoint(
  oldZoomLevel: number,
  newZoomLevel: number,
  currentOffset: { x: number; y: number },
  zoomReferencePoint: { x: number; y: number }, // Point around which to zoom. This point shouldn't move from whereever it is now
) {
  const zoomRatio = newZoomLevel / oldZoomLevel;
  // If we didn't have to worry about the reference point around which to zoom, we can easily calculate the new offset
  // By just multiplying by the zoomRatio
  const newOffsetXWithoutAdjustment = currentOffset.x * zoomRatio;
  const newOffsetYWithoutAdjustment = currentOffset.y * zoomRatio;

  // Adjustment around reference point
  // We adjust the x and y offset points by a slight bit based on the reference point
  // We want that the part of image below the reference point should stay whereever it is now
  const adjustAroundReferencePointX =
    zoomReferencePoint.x - zoomReferencePoint.x * zoomRatio;
  const adjustAroundRefernecePointY =
    zoomReferencePoint.y - zoomReferencePoint.y * zoomRatio;

  // Adjust for where the mouse cursor is. So that the part of image below the mouse cursor
  // always remains below the cursor even when the image is zooming
  // If we would have zoomed in around the center, the image portion below the cursor
  // would have kept going away from the cursor, if we didn't adjust our x and y offset accordingly
  const newOffset = {
    x: newOffsetXWithoutAdjustment + adjustAroundReferencePointX,
    y: newOffsetYWithoutAdjustment + adjustAroundRefernecePointY,
  };

  return newOffset;
}

export type ZoomPanOptions = {
  minZoom?: number; // minimum zoom level (e.g., 10%)
  maxZoom?: number; // maximum zoom level (e.g., 400%)
  zoomStep: number; // zoom increment/decrement amount
  enableWheel: boolean; // enable mouse wheel zoom
  enableTouch: boolean; // enable touch gestures
};
const defaultZoomPanConfig: ZoomPanOptions = {
  minZoom: 0.1,
  maxZoom: 4,
  zoomStep: 0.1,
  enableWheel: true,
  enableTouch: true,
};

// Hook which maintains the zoom state of the image
// And the offset coordinates from where to draw the image
// It will also expose the methods to zoom in and out and pan
export const useCanvasZoomPan = (
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
  imageRef: React.MutableRefObject<HTMLImageElement | null>,
  config: Partial<ZoomPanOptions> = {},
) => {
  const [zoomPanConfig] = useState<ZoomPanOptions>(() => {
    return { ...defaultZoomPanConfig, ...config };
  });
  const [zoomLevel, setZoomLevel] = useState(1);
  // The amount to which the image is scaled/zoomed
  // When the user loads an image, we calculate the zoomLevel so that the image fits in the canvas
  // Users can then change the zoom level themselves
  const [offset, setOffset] = useState({
    x: 0,
    y: 0,
  });
  const isDragging = useRef(false);
  // We will store the last mouse position when the user starts dragging the image
  // We use it to pan the image on mouse move event
  // Once we have panned the image from last mouse pos to the current one,
  // we set the current mouse pos to current mouse pos
  const lastMousePos = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const animationFrameId = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // requestAnimationFrame takes a callback. That callback is called with a timestamp.
  // The timestamp indicates the endtime of previous frames rendering
  // We keep calling this function with requestAnimationFrame. After the user has stopped dragging the image
  // This will make it feel like the pan had inertia
  const updatePosition = useCallback(
    (offset: { x: number; y: number }, timestamp: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;

        animationFrameId.current = requestAnimationFrame(
          updatePosition.bind(null, offset),
        );
        return;
      }

      const deltaTime = timestamp - lastTimeRef.current;
      const friction = 0.8;
      // The friction will slow down the velocity
      velocity.current = {
        x: velocity.current.x * friction,
        y: velocity.current.y * friction,
      };
      // Update offset based on the velocity
      const newOffset = {
        x: offset.x + velocity.current.x * deltaTime,
        y: offset.y + velocity.current.y * deltaTime,
      };

      lastTimeRef.current = timestamp;
      // Only continue animating if the movement is significant
      if (
        Math.abs(velocity.current.x) > 0.2 ||
        Math.abs(velocity.current.y) > 0.2
      ) {
        const canvasWidth = canvasRef.current?.width || 0;
        const canvasHeight = canvasRef.current?.height || 0;
        const imageWidth = imageRef.current?.width || 0;
        const imageHeight = imageRef.current?.height || 0;
        setOffset(
          clampOffset(
            newOffset,
            calculatePanBounds(
              canvasWidth,
              canvasHeight,
              imageWidth,
              imageHeight,
              zoomLevel,
            ),
          ),
        );
        animationFrameId.current = requestAnimationFrame(
          // We need to bind the new offset to the callback because otherwise the updatePosition closure
          // will keep using the old offset
          updatePosition.bind(null, newOffset),
        );
      }
    },
    [canvasRef, imageRef, zoomLevel],
  );

  const zoomToPoint = useCallback(
    (newZoomLevel: number, point: { x: number; y: number }) => {
      const newOffset = calculateImageStartOffsetAroundAReferencePoint(
        zoomLevel,
        newZoomLevel,
        offset,
        point,
      );
      setOffset(newOffset);
      setZoomLevel(newZoomLevel);
    },
    [offset, zoomLevel],
  );
  // User can zoom in and out of the image using the mouse wheel
  // This event is also called when user tries to zoom in/out of the image
  // from the trackpad using pinch zoom
  // When a user scroll wheel when the mouse is over a particular part of the image
  // they want to zoom into that part. We can't just zoom around the center of the image.
  // What does that mean?
  // When we zoom into an image which is larger than the canvas, we do so by start to draw the image
  // from outside the canvas. So the portion of image we draw outside the canvas is clipped and we
  // see a part of the image, which appear bigger than it was. When user zooms in further, we start drawing
  // the image from even further outside the canvas. Now a bigger part of image is clipped and a smaller
  // part is drawn inside the canvas and appear even bigger.
  // Say we have a canvas of size 1000x800 and an image of size 4000x3000
  // If our zoomLevel dictates that we can draw only 3000 pixels of the image on the x axis,
  // we can start drawing from -500px ((canvasWidth - imageWidth)/2). Now image pixels on x axis from 500px to 3500px will show up on the canvas.
  // This will always zoom the central part of the image
  // To zoom into some other section of the image, we can change the starting coordinates where we render the image.
  // E.g. in above case, if we start drawing from -200px, then the image pixels on x axis from 200px to 3200px will show up on the canvas.
  // And it will feel like we are zooming on the top left quadrant of the image.
  // Which means we need to store the offset where we start drawing the image,
  // based on where the mouse is when the user starts zooming in/out of the image
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      // We only want to zoom in/out of the image when the mouse is over the canvas
      if (isMouseInCanvas(canvasRef.current, event)) {
        event.preventDefault();
        const zoomAdjustment = Math.abs(event.deltaY) >= 1 ? 0.002 : 0.1;
        // negative deltaY means user is scrolling the wheel towards themselves and we
        // want to zoom in
        const newZoomLevel =
          zoomLevel - event.deltaY * zoomLevel * zoomAdjustment;
        zoomToPoint(
          newZoomLevel,
          getMousePosInCanvas(canvasRef.current, event),
        );
      }
    },
    // TODO: This is atrociuous. Recreating this function on every zoomLevel and imageStartOffset change is
    // very expensive
    [zoomToPoint, canvasRef, zoomLevel],
  );

  // Panning the image
  // When user holds the mouse down, we set isDragging to true
  // We reset isDragging to false on onMouseUp and onMouseLeave events of the canvas
  // If isDragging is true, and we receive a onMouseMove event, we pan the image
  // We need to know how much the mouse has moved from the last position
  // So we store the last mouse position in lastMousePos
  const startPan = useCallback(
    (eventCoords: { pageX: number; pageY: number }) => {
      // We don't need to rerender the view when we set dragging to true
      isDragging.current = true;
      const { pageX, pageY } = eventCoords;
      lastMousePos.current = { x: pageX, y: pageY };
      lastTimeRef.current = performance.now();

      // cancel any ongoing animation
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      velocity.current = { x: 0, y: 0 };
    },
    [],
  );
  function handleMouseDown(event: React.MouseEvent<HTMLCanvasElement>) {
    startPan({ pageX: event.pageX, pageY: event.pageY });
  }
  const touchState = useRef<{ startDistance?: number }>({});
  // We will pan the image if the mouse moves and the user is dragging the mouse
  const handlePointerMove = useCallback(
    ({ pageX, pageY }: { pageX: number; pageY: number }) => {
      if (!canvasRef.current || !isDragging.current) {
        return;
      }

      const dx = pageX - lastMousePos.current.x;
      const dy = pageY - lastMousePos.current.y;
      const newOffset = {
        x: offset.x + dx,
        y: offset.y + dy,
      };
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTimeRef.current;
      // We keep track of the velocity of the mouse movement
      // We will use it when the user stops. We will decellerate from the last velocity we record.
      const newVelocity = {
        x: dx / deltaTime,
        y: dy / deltaTime,
      };
      const canvasWidth = canvasRef.current.width;
      const canvasHeight = canvasRef.current.height;
      const imageWidth = imageRef.current?.width || 0;
      const imageHeight = imageRef.current?.height || 0;
      const clampedOffset = clampOffset(
        newOffset,
        calculatePanBounds(
          canvasWidth,
          canvasHeight,
          imageWidth,
          imageHeight,
          zoomLevel,
        ),
      );
      setOffset(clampedOffset);
      velocity.current = newVelocity;
      lastMousePos.current = { x: pageX, y: pageY };
      lastTimeRef.current = currentTime;
    },
    [canvasRef, imageRef, zoomLevel, offset.x, offset.y],
  );

  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      if (isMouseInCanvas(canvasRef.current, event)) {
        event.preventDefault();
        // If user is using 2 fingers, it's probably for pinch and zoom
        // We will store the original distance between the 2 fingers
        if (event.touches.length === 2) {
          touchState.current.startDistance = getTouchDistance(event.touches);
        } else {
          startPan({
            // To use pageX/pageY or clientX/clientY?
            // pageX is the distance from the left edge of the viewport
            // But if our component is used in a page which has been scrolled,
            // pageX might give the wrong value
            // pageX is the distance from the left edge of the document
            // Only way to fix this is by putting the component in a page which has been scrolled
            // https://stackoverflow.com/questions/6073505/what-is-the-difference-between-screenx-y-clientx-y-and-pagex-y
            // Experiment done: Looks like pageX and pageY work fine even if the component is loaded in a page bigger than the
            // viewport and has been scrolled
            pageX: event.touches[0].pageX,
            pageY: event.touches[0].pageY,
          });
        }
      }
    },
    [canvasRef, startPan],
  );
  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (isMouseInCanvas(canvasRef.current, event)) {
        event.preventDefault();

        // if there are 2 fingers and we also have a startDistance, it's probably a pinch and zoom
        if (
          event.touches.length === 2 &&
          touchState.current.startDistance &&
          canvasRef.current
        ) {
          const currentDistance = getTouchDistance(event.touches);
          const scale = currentDistance / touchState.current.startDistance;
          const newZoomLevel = zoomLevel * scale;
          const centerX = (event.touches[0].pageX + event.touches[1].pageX) / 2;
          const centerY = (event.touches[0].pageY + event.touches[1].pageY) / 2;

          const canvas = canvasRef.current;
          const rect = canvas.getBoundingClientRect();
          const canvasPoint = {
            x: centerX - rect.left,
            y: centerY - rect.top,
          };

          const newOffset = calculateImageStartOffsetAroundAReferencePoint(
            zoomLevel,
            newZoomLevel,
            offset,
            canvasPoint,
          );
          setZoomLevel(newZoomLevel);
          const canvasWidth = canvasRef.current.width;
          const canvasHeight = canvasRef.current.height;
          const imageWidth = imageRef.current?.width || 0;
          const imageHeight = imageRef.current?.height || 0;
          const clampedOffset = clampOffset(
            newOffset,
            calculatePanBounds(
              canvasWidth,
              canvasHeight,
              imageWidth,
              imageHeight,
              zoomLevel,
            ),
          );
          setOffset(clampedOffset);
          // In case the user wants to zoom in further, we need to adjust the startDistance
          touchState.current.startDistance = currentDistance;
        } else {
          handlePointerMove({
            pageX: event.touches[0].pageX,
            pageY: event.touches[0].pageY,
          });
        }
      }
    },
    [canvasRef, imageRef, handlePointerMove, offset, zoomLevel],
  );
  const handleMouseUp = useCallback(() => {
    touchState.current.startDistance = undefined;
    isDragging.current = false;

    // cancel any existing animation
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    // We start our smooth stop of the pan after the user has stopped
    animationFrameId.current = requestAnimationFrame(
      updatePosition.bind(null, offset),
    );
  }, [offset, updatePosition]);
  // When user clicks on the minus (-) button, we zoom out the image a bit
  // The zoom out is not absolute amount. It will depend on the existing zoomLevel
  // Otherwise, at lower zoom levels, it will feel like it's zooming out too fast
  // TODO: We are zooming from the center of the image always. We will fix it in the next iteration
  const zoomOut = useCallback(() => {
    // Decrease zoom by 5%
    let newZoomLevel = zoomLevel - zoomLevel * zoomPanConfig.zoomStep;
    if (zoomPanConfig.minZoom && newZoomLevel < zoomPanConfig.minZoom) {
      newZoomLevel = zoomPanConfig.minZoom;
    }
    const canvasCenter = getCanvasCenter(canvasRef.current);
    zoomToPoint(newZoomLevel, canvasCenter);
  }, [
    zoomToPoint,
    zoomLevel,
    canvasRef,
    zoomPanConfig.zoomStep,
    zoomPanConfig.minZoom,
  ]);
  const zoomIn = useCallback(() => {
    // Increase zoom by 5%
    let newZoomLevel = zoomLevel + zoomLevel * zoomPanConfig.zoomStep;
    if (zoomPanConfig.maxZoom && newZoomLevel > zoomPanConfig.maxZoom) {
      newZoomLevel = zoomPanConfig.maxZoom;
    }
    const canvasCenter = getCanvasCenter(canvasRef.current);
    zoomToPoint(newZoomLevel, canvasCenter);
  }, [
    zoomToPoint,
    canvasRef,
    zoomLevel,
    zoomPanConfig.zoomStep,
    zoomPanConfig.maxZoom,
  ]);
  const resetZoom = useCallback(() => {
    if (canvasRef.current && imageRef.current) {
      const initialZoomLevel = calculateInitialZoomLevel(
        canvasRef.current,
        imageRef.current,
      );
      setZoomLevel(initialZoomLevel);
      const initialOffset = calculateInitialImageStartOffset(
        canvasRef.current,
        imageRef.current,
        initialZoomLevel,
      );

      setOffset(initialOffset);
    }
  }, [canvasRef, imageRef]);

  const lastTapTime = useRef(0);
  const handleTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLCanvasElement>) => {
      const currentTime = performance.now();
      const tapLength = currentTime - lastTapTime.current;
      if (
        tapLength < 300 &&
        tapLength > 0 &&
        canvasRef.current &&
        imageRef.current
      ) {
        event.preventDefault();
        if (event.changedTouches.length === 1) {
          const touch = event.changedTouches[0];
          const rect = canvasRef.current.getBoundingClientRect();
          const point = {
            x: touch.pageX - rect.left,
            y: touch.pageY - rect.top,
          };
          const defaultZoomLevel = calculateInitialZoomLevel(
            canvasRef.current,
            imageRef.current,
          );
          // If the current zoom level is the default zoom level, we will zoom in
          // Otherwise we will reset the zoom to the default zoom level, i.e.
          // the zoom which should have been when we load the image
          if (defaultZoomLevel !== zoomLevel) {
            resetZoom();
          } else {
            const newZoomLevel = defaultZoomLevel * 2;
            zoomToPoint(newZoomLevel, point);
          }
        }
      }
      lastTapTime.current = currentTime;
      // TODO
      handleMouseUp();
    },
    [zoomToPoint, resetZoom, canvasRef, imageRef, handleMouseUp, zoomLevel],
  );

  function handleMouseMove(event: React.MouseEvent<HTMLCanvasElement>) {
    handlePointerMove({ pageX: event.pageX, pageY: event.pageY });
  }
  function handleMouseLeave() {
    isDragging.current = false;
    // cancel any existing animation
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    velocity.current = { x: 0, y: 0 };
    // We start our smooth stop of the pan after the user has stopped
    // animationFrameId.current = requestAnimationFrame(updatePosition);
  }

  // stop any existing animations
  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);
  useEffect(() => {
    if (zoomPanConfig.enableWheel) {
      document.addEventListener("wheel", handleWheel, { passive: false });
    }

    return () => {
      document.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel, zoomPanConfig.enableWheel]);
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case "+":
          case "=":
            event.preventDefault();
            zoomIn();
            break;
          case "-":
            event.preventDefault();
            zoomOut();
            break;
          case "0":
            event.preventDefault();
            resetZoom();
            break;
        }
      }
    },
    [zoomIn, zoomOut, resetZoom],
  );
  // Keyboard support
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleDoubleClick = useCallback(
    (event: MouseEvent) => {
      if (canvasRef.current && imageRef.current) {
        // We don't want to zoom in if the user double clicks outside the canvas
        // This caused a subtle bug where i was trying to zoom in using the + button
        // And every few clicks later, the image changed position but went to original zoom
        // size. Because the double click handler came into effect
        if (isMouseInCanvas(canvasRef.current, event)) {
          event.preventDefault();

          const defaultZoomLevel = calculateInitialZoomLevel(
            canvasRef.current,
            imageRef.current,
          );
          // If the current zoom level is the default zoom level, we will zoom in
          // Otherwise we will reset the zoom to the default zoom level, i.e.
          // the zoom which should have been when we load the image
          if (defaultZoomLevel !== zoomLevel) {
            resetZoom();
          } else {
            const newZoomLevel = defaultZoomLevel * 2;
            const newStartOffset =
              calculateImageStartOffsetAroundAReferencePoint(
                zoomLevel,
                newZoomLevel,
                offset,
                getMousePosInCanvas(canvasRef.current, event),
              );

            setOffset(newStartOffset);
            setZoomLevel(newZoomLevel);
          }
        }
      }
    },
    [resetZoom, canvasRef, imageRef, offset, zoomLevel],
  );
  useEffect(() => {
    document.addEventListener("dblclick", handleDoubleClick);

    return () => {
      document.removeEventListener("dblclick", handleDoubleClick);
    };
  }, [handleDoubleClick]);
  useEffect(() => {
    if (zoomPanConfig.enableTouch) {
      document.addEventListener("touchstart", handleTouchStart, {
        passive: false,
      });
      document.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
    }

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
    };
  }, [handleTouchMove, handleTouchStart, zoomPanConfig.enableTouch]);

  return {
    // zoom state
    zoomLevel,
    offset,
    // controls
    zoomIn,
    zoomOut,
    resetZoom,
    // event handlers to attach to the canvas element
    listeners: {
      onTouchEnd: handleTouchEnd,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
    },
  };
};
