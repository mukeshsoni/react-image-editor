import React, { useCallback, useEffect, useRef, useState } from "react";
import { getCanvasCenter, getMousePos, isMouseInCanvas } from "./dom-helpers";

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

// Hook which maintains the zoom state of the image
// And the offset coordinates from where to draw the image
// It will also expose the methods to zoom in and out and pan
export const useCanvasZoomPan = (
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
) => {
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
  const updatePosition = (
    offset: { x: number; y: number },
    timestamp: number,
  ) => {
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
      setOffset(newOffset);
      animationFrameId.current = requestAnimationFrame(
        // We need to bind the new offset to the callback because otherwise the updatePosition closure
        // will keep using the old offset
        updatePosition.bind(null, newOffset),
      );
    }
  };

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
        // negative deltaY means user is scrolling the wheel towards themselves and we
        // want to zoom in
        const newZoomLevel = zoomLevel - (event.deltaY * zoomLevel) / 500;

        const newStartOffset = calculateImageStartOffsetAroundAReferencePoint(
          zoomLevel,
          newZoomLevel,
          offset,
          getMousePos(canvasRef.current, event),
        );

        setOffset(newStartOffset);
        setZoomLevel(newZoomLevel);
      }
    },
    // TODO: This is atrociuous. Recreating this function on every zoomLevel and imageStartOffset change is
    // very expensive
    [canvasRef, zoomLevel, offset],
  );

  // Panning the image
  // When user holds the mouse down, we set isDragging to true
  // We reset isDragging to false on onMouseUp and onMouseLeave events of the canvas
  // If isDragging is true, and we receive a onMouseMove event, we pan the image
  // We need to know how much the mouse has moved from the last position
  // So we store the last mouse position in lastMousePos
  function startPan(eventCoords: { pageX: number; pageY: number }) {
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
  }
  function handleMouseDown(event: React.MouseEvent<HTMLCanvasElement>) {
    startPan({ pageX: event.pageX, pageY: event.pageY });
  }
  function handleTouchStart(event: React.TouchEvent<HTMLCanvasElement>) {
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

  // We will pan the image if the mouse moves and the user is dragging the mouse
  function handlePointerMove({
    pageX,
    pageY,
  }: {
    pageX: number;
    pageY: number;
  }) {
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
    setOffset(newOffset);
    velocity.current = newVelocity;
    lastMousePos.current = { x: pageX, y: pageY };
    lastTimeRef.current = currentTime;
  }
  function handleMouseMove(event: React.MouseEvent<HTMLCanvasElement>) {
    handlePointerMove({ pageX: event.pageX, pageY: event.pageY });
  }
  // TODO: touchmove is also a passive event. The browser will not allow us to
  // do a preventDefault on it. We need to bind that event on the document with passive: false option.
  function handleTouchMove(event: React.TouchEvent<HTMLCanvasElement>) {
    event.preventDefault();
    handlePointerMove({
      pageX: event.touches[0].pageX,
      pageY: event.touches[0].pageY,
    });
  }
  function handleMouseUp() {
    isDragging.current = false;

    // cancel any existing animation
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    // We start our smooth stop of the pan after the user has stopped
    animationFrameId.current = requestAnimationFrame(
      updatePosition.bind(null, offset),
    );
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
    document.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      document.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);
  // When user clicks on the minus (-) button, we zoom out the image a bit
  // The zoom out is not absolute amount. It will depend on the existing zoomLevel
  // Otherwise, at lower zoom levels, it will feel like it's zooming out too fast
  // TODO: We are zooming from the center of the image always. We will fix it in the next iteration
  const zoomOut = useCallback(() => {
    // Decrease zoom by 5%
    const newZoomLevel = zoomLevel - zoomLevel * 0.05;
    const canvasCenter = getCanvasCenter(canvasRef.current);
    const newOffset = calculateImageStartOffsetAroundAReferencePoint(
      zoomLevel,
      newZoomLevel,
      offset,
      canvasCenter,
    );
    setOffset(newOffset);
    setZoomLevel(newZoomLevel);
  }, [canvasRef, offset, zoomLevel]);
  const zoomIn = useCallback(() => {
    // Increase zoom by 5%
    const newZoomLevel = zoomLevel + zoomLevel * 0.05;
    const canvasCenter = getCanvasCenter(canvasRef.current);
    const newOffset = calculateImageStartOffsetAroundAReferencePoint(
      zoomLevel,
      newZoomLevel,
      offset,
      canvasCenter,
    );
    setOffset(newOffset);
    setZoomLevel(newZoomLevel);
  }, [canvasRef, offset, zoomLevel]);

  return {
    // zoom state
    zoomLevel,
    offset,
    // controls
    setZoomLevel,
    setOffset,
    zoomIn,
    zoomOut,
    // event handlers to attach to the canvas element
    listeners: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleMouseUp,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
    },
  };
};
