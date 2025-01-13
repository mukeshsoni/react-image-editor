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
    const canvasWidth = canvasRef.width;
    const canvasHeight = canvasRef.height;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    // For now we just draw the whole image to the canvas
    // If the canvas size is smaller than the image, a part of the image will be clipped
    ctx.drawImage(imageRef, 0, 0);
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
        canvas
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
