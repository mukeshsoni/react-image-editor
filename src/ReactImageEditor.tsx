import React, { useEffect, useRef, useState } from "react";

// Function to get relative mouse position in canvas
const getMousePos = (
  canvas: HTMLCanvasElement | null,
  event: React.MouseEvent<HTMLCanvasElement>,
) => {
  if (!canvas) {
    return { x: 0, y: 0 };
  }

  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
};

// Function to get canvas center position
function getCanvasCenter(canvas: HTMLCanvasElement | null) {
  if (!canvas) return { x: 0, y: 0 };

  return {
    x: canvas.width / 2,
    y: canvas.height / 2,
  };
}

// Given a canvas element ref and an Image instance, render the
// image to the canvas
function renderImageToCanvas(
  canvasRef: HTMLCanvasElement | null,
  imageRef: HTMLImageElement,
  zoomLevel: number,
  imageStarOffset: { x: number; y: number },
) {
  if (!canvasRef) return;

  const ctx = canvasRef.getContext("2d");
  if (ctx) {
    // We restrict the canvas width to the canvas container width
    const canvasWidth = canvasRef.parentElement?.clientWidth || 800;
    const canvasHeight = canvasRef.parentElement?.clientHeight || 600;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const imageWidth = imageRef.width;
    const imageHeight = imageRef.height;
    const scaledImageWidth = zoomLevel * imageWidth;
    const scaledImageHeight = zoomLevel * imageHeight;

    // y coordinate where to start drawing the image
    // For now we just draw the whole image to the canvas
    // If the canvas size is smaller than the image, a part of the image will be clipped
    ctx.drawImage(
      imageRef,
      imageStarOffset.x,
      imageStarOffset.y,
      scaledImageWidth,
      scaledImageHeight,
    );
  }
}

// This is the trickiest part of the whole zoom operation
// I think i still don't understand how it works, but it does work
// We adjust the current offset a slight bit
//  1. Based on change of zoom level
// And then adjust a slight bit more based on the point around which we want to zoom
// The 2nd adjustment makes sure that the part of image below the reference point doesn't move from that point
// We want to cement the position of that point
function calculateImageStartOffsetAroundCenter(
  canvas: HTMLCanvasElement | null,
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

function calculateInitialImageStartOffset(
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

  const canvasWidth = canvas.parentElement?.clientWidth || 800;
  const canvasHeight = canvas.parentElement?.clientHeight || 600;

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
function calculateInitialZoomLevel(
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

export function ReactImageEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  // The amount to which the image is scaled/zoomed
  // When the user loads an image, we calculate the zoomLevel so that the image fits in the canvas
  // Users can then change the zoom level themselves
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imageStartOffset, setImageStartOffset] = useState({
    x: 0,
    y: 0,
  });

  // Set canvas width and height
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.width =
        canvasRef.current.parentElement?.clientWidth || 800;
      canvasRef.current.height =
        canvasRef.current.parentElement?.clientHeight || 600;
    }
  }, []);
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    // Let's save the user selected file in a state variable
    setImageFile(event.target.files ? event.target.files[0] : null);
  }
  // On change of imageFile we will try to render the image pointed by that file
  useEffect(() => {
    if (imageFile) {
      const img = new Image();
      img.src = URL.createObjectURL(imageFile);

      // when the browser is done loading the image to our Image instance
      // we try to render it to the canvas
      img.onload = () => {
        imageRef.current = img;
        const initialZoomLevel = calculateInitialZoomLevel(
          canvasRef.current,
          img,
        );
        setZoomLevel(initialZoomLevel);
        const initialImageStartOffset = calculateInitialImageStartOffset(
          canvasRef.current,
          imageRef.current,
          initialZoomLevel,
        );
        setImageStartOffset(initialImageStartOffset);
        renderImageToCanvas(
          canvasRef.current,
          imageRef.current,
          initialZoomLevel,
          initialImageStartOffset,
        );
      };
    }
  }, [imageFile]);
  // rerender the image when the zoomLevel has changed
  useEffect(() => {
    if (imageRef.current) {
      renderImageToCanvas(
        canvasRef.current,
        imageRef.current,
        zoomLevel,
        imageStartOffset,
      );
    }
  }, [zoomLevel, imageStartOffset]);
  // When user clicks on the minus (-) button, we zoom out the image a bit
  // The zoom out is not absolute amount. It will depend on the existing zoomLevel
  // Otherwise, at lower zoom levels, it will feel like it's zooming out too fast
  // TODO: We are zooming from the center of the image always. We will fix it in the next iteration
  function handleZoomOutClick() {
    if (imageRef.current) {
      // Decrease zoom by 5%
      const newZoomLevel = zoomLevel - zoomLevel * 0.05;
      const canvasCenter = getCanvasCenter(canvasRef.current);
      const newOffset = calculateImageStartOffsetAroundCenter(
        canvasRef.current,
        zoomLevel,
        newZoomLevel,
        imageStartOffset,
        canvasCenter,
      );
      setImageStartOffset(newOffset);
      setZoomLevel(newZoomLevel);
    }
  }
  function handleZoomInClick() {
    // Increase zoom by 5%
    const newZoomLevel = zoomLevel + zoomLevel * 0.05;
    const canvasCenter = getCanvasCenter(canvasRef.current);
    const newOffset = calculateImageStartOffsetAroundCenter(
      canvasRef.current,
      zoomLevel,
      newZoomLevel,
      imageStartOffset,
      canvasCenter,
    );
    setImageStartOffset(newOffset);
    setZoomLevel(newZoomLevel);
  }
  function handleResetZoomClick() {
    if (imageRef.current) {
      const newZoomLevel = calculateInitialZoomLevel(
        canvasRef.current,
        imageRef.current,
      );
      setImageStartOffset(
        calculateInitialImageStartOffset(
          canvasRef.current,
          imageRef.current,
          newZoomLevel,
        ),
      );
      setZoomLevel(newZoomLevel);
    }
  }
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
  function handleWheel(event: React.WheelEvent<HTMLCanvasElement>) {
    if (imageRef.current) {
      // negative deltaY means user is scrolling the wheel towards themselves and we
      // want to zoom in
      const newZoomLevel = zoomLevel - (event.deltaY * zoomLevel) / 5000;

      const newStartOffset = calculateImageStartOffsetAroundCenter(
        canvasRef.current,
        zoomLevel,
        newZoomLevel,
        imageStartOffset,
        getMousePos(canvasRef.current, event),
      );

      setImageStartOffset(newStartOffset);
      setZoomLevel(newZoomLevel);
    }
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="p-2">
        <div className="flex gap-4">
          <input type="file" onChange={handleFileChange} />
          <div className="flex gap-4">
            <button
              className="px-2 rounded border border-indigo-600"
              onClick={handleZoomOutClick}
            >
              -
            </button>
            <button
              className="px-2 rounded border border-indigo-600"
              onClick={handleResetZoomClick}
              title="Reset"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              className="px-2 rounded border border-indigo-600"
              onClick={handleZoomInClick}
            >
              +
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 border-2">
        <canvas ref={canvasRef} onWheel={handleWheel} />
      </div>
    </div>
  );
}
