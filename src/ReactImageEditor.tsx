import React, { useEffect, useRef, useState } from "react";
import { useCanvasZoomPan } from "./use-canvas-zoom-pan";

// Given a canvas element ref and an Image instance, render the
// image to the canvas
function renderImageToCanvas(
  canvasRef: HTMLCanvasElement | null,
  imageRef: HTMLImageElement,
  zoomLevel: number,
  offset: { x: number; y: number },
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
      offset.x,
      offset.y,
      scaledImageWidth,
      scaledImageHeight,
    );
  }
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
  const {
    zoomLevel,
    offset,
    setZoomLevel,
    zoomIn,
    zoomOut,
    setOffset,
    listeners,
  } = useCanvasZoomPan(canvasRef);
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
        setOffset(initialImageStartOffset);
        renderImageToCanvas(
          canvasRef.current,
          imageRef.current,
          initialZoomLevel,
          initialImageStartOffset,
        );
      };
    }
  }, [setZoomLevel, setOffset, imageFile]);
  const renderRef = useRef<number | null>(null);
  // rerender the image when the zoomLevel has changed
  useEffect(() => {
    if (renderRef.current) {
      cancelAnimationFrame(renderRef.current);
    }

    // We try to render the image to the canvas at 60fps
    renderRef.current = requestAnimationFrame(() => {
      if (imageRef.current) {
        renderImageToCanvas(
          canvasRef.current,
          imageRef.current,
          zoomLevel,
          offset,
        );
      }
    });
  }, [zoomLevel, offset]);
  function handleResetZoomClick() {
    if (imageRef.current) {
      const newZoomLevel = calculateInitialZoomLevel(
        canvasRef.current,
        imageRef.current,
      );
      setOffset(
        calculateInitialImageStartOffset(
          canvasRef.current,
          imageRef.current,
          newZoomLevel,
        ),
      );
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
              onClick={zoomOut}
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
              onClick={zoomIn}
            >
              +
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 border-2">
        <canvas ref={canvasRef} {...listeners} />
      </div>
    </div>
  );
}
