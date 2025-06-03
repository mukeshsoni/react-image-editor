import React, { useEffect, useRef } from "react";
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
    const canvasWidth = canvasRef.width;
    const canvasHeight = canvasRef.height;
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

type Props = {
  imageSrc: string;
};
export function ReactImageEditor({ imageSrc }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const { zoomLevel, offset, zoomIn, zoomOut, resetZoom, listeners } =
    useCanvasZoomPan(canvasRef, imageRef);
  // Set canvas width and height
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.width =
        canvasRef.current.parentElement?.clientWidth || 800;
      canvasRef.current.height =
        canvasRef.current.parentElement?.clientHeight || 600;
    }
  }, []);
  // On change of imageFile we will try to render the image pointed by that file
  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;

    // when the browser is done loading the image to our Image instance
    // we try to render it to the canvas
    img.onload = () => {
      imageRef.current = img;
    };
  }, [imageSrc, resetZoom]);
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
    resetZoom();
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="p-2">
        <div className="flex gap-4">
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
