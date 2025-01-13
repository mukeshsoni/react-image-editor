import React, { useEffect, useRef, useState } from "react";

// Given a canvas element ref and an Image instance, render the
// image to the canvas
function renderImageToCanvas(
  canvasRef: HTMLCanvasElement | null,
  imageRef: HTMLImageElement,
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
    // We want to fit the image inside the canvas when we first load it
    // We need to calculate the new image width and height keeping the aspect
    // ratio intact
    // If canvas width is more than image width, the scale is > 1. We will restrict the max scale to 1.
    // If the canvas width is less than the image width, the scale is < 1. Which means we will scale down the
    // image so that it fits in the canvas.
    const scaleX = canvasRef.width / imageRef.width;
    const scaleY = canvasRef.height / imageRef.height;
    // We pick one of scaleX or scaleY as the final scale value to scale both the width and height
    // So that the aspect ratio is maintained
    // We pick the smaller one. If we pick the larger one, the side which needed a smaller scale will
    // overflow the canvas
    // The max scale is 1. Otherwise the image will pixelate.
    const scale = Math.min(Math.min(scaleX, scaleY), 1);
    const scaledImageWidth = scale * imageWidth;
    const scaledImageHeight = scale * imageHeight;

    // For now we just draw the whole image to the canvas
    // If the canvas size is smaller than the image, a part of the image will be clipped
    ctx.drawImage(imageRef, 0, 0, scaledImageWidth, scaledImageHeight);
  }
}

export function ReactImageEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

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
        renderImageToCanvas(canvasRef.current, img);
      };
    }
  }, [imageFile]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="p-2">
        <input type="file" onChange={handleFileChange} />
      </div>
      <div className="flex-1 border-2">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
