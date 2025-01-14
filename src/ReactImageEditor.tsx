import React, { useEffect, useRef, useState } from "react";

// Given a canvas element ref and an Image instance, render the
// image to the canvas
function renderImageToCanvas(
  canvasRef: HTMLCanvasElement | null,
  imageRef: HTMLImageElement,
  zoomLevel: number,
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

    // x coordinate where to start drawing the image
    // if canvas width is larger than the image width, we will try to center the image on the canvas
    const imageX =
      canvasWidth > scaledImageWidth ? (canvasWidth - scaledImageWidth) / 2 : 0;
    const imageY =
      canvasHeight > scaledImageHeight
        ? (canvasHeight - scaledImageHeight) / 2
        : 0;

    // y coordinate where to start drawing the image
    // For now we just draw the whole image to the canvas
    // If the canvas size is smaller than the image, a part of the image will be clipped
    ctx.drawImage(
      imageRef,
      imageX,
      imageY,
      scaledImageWidth,
      scaledImageHeight,
    );
  }
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
        const initialZoomLevel = calculateInitialZoomLevel(
          canvasRef.current,
          img,
        );
        imageRef.current = img;
        setZoomLevel(initialZoomLevel);
        renderImageToCanvas(
          canvasRef.current,
          imageRef.current,
          initialZoomLevel,
        );
      };
    }
  }, [imageFile]);
  // rerender the image when the zoomLevel has changed
  useEffect(() => {
    if (imageRef.current) {
      renderImageToCanvas(canvasRef.current, imageRef.current, zoomLevel);
    }
  }, [zoomLevel]);
  // When user clicks on the minus (-) button, we zoom out the image a bit
  // The zoom out is not absolute amount. It will depend on the existing zoomLevel
  // Otherwise, at lower zoom levels, it will feel like it's zooming out too fast
  // TODO: We are zooming from the center of the image always. We will fix it in the next iteration
  function handleZoomOutClick() {
    // Decrease zoom by 5%
    const newZoomLevel = zoomLevel - zoomLevel * 0.05;
    setZoomLevel(newZoomLevel);
  }
  function handleZoomInClick() {
    // Increase zoom by 5%
    const newZoomLevel = zoomLevel + zoomLevel * 0.05;
    setZoomLevel(newZoomLevel);
  }
  function handleResetZoomClick() {
    if (imageRef.current) {
      setZoomLevel(
        calculateInitialZoomLevel(canvasRef.current, imageRef.current),
      );
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
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
