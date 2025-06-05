import { useEffect, useRef, useState } from "react";
import { useCanvasZoomPan } from "./use-canvas-zoom-pan";
import { Cropper } from "@/components/Cropper";
import { Button } from "@/components/ui/button";
import {
  ResizablePanel,
  ResizableHandle,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { getPanelGroupElement } from "react-resizable-panels";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [mode, setMode] = useState<"edit" | "crop">("crop");
  const { zoomLevel, offset, zoomIn, zoomOut, resetZoom, listeners } =
    useCanvasZoomPan(canvasRef, imageRef, mode === "edit");

  // Reset zoom when in crop mode
  useEffect(() => {
    if (mode == "crop") {
      resetZoom();
    }
  }, [mode, resetZoom]);

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
      // We trigger a recalculation of zoomLevel and image offset by calling resetZoom
      // Otherwise the useEffect which renders the image on change on zoom level might not be called
      // the first time. Or, it is called, but the imageRef.current is still null so we render nothing
      // Once the image is loaded, we need to calculate the zoom level and image offset once more
      resetZoom();
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
  function handleImagePanelResize(panelWidth: number) {
    const CONTAINER_PADDING = 32;
    // We have to manually resize the canvas when the panel width changes
    if (canvasRef.current && containerRef.current) {
      // The onResize callback returns the percentage of the container width this panel occupies
      // We have to find the actual width by calculating it as percentage of the parent element's width
      // And it's not straightfoward to get hold of the panel group element in react-resizable-panel
      // Have to use getPanelGroupElement which is not documented anywhere
      // https://github.com/bvaughn/react-resizable-panels/tree/main/packages/react-resizable-panels/src/utils/dom
      const containerEl = getPanelGroupElement("container-panel");
      if (containerEl) {
        const containerWidth = containerEl.clientWidth;
        const newCanvasWidth =
          containerWidth * panelWidth * 0.01 - CONTAINER_PADDING;
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          ctx.canvas.width = newCanvasWidth;
          ctx.canvas.height = canvasRef.current.height;
          resetZoom();
        }
      }
    }
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
            <div className="flex gap-2">
              <Button
                variant={mode == "edit" ? "default" : "secondary"}
                onClick={() => setMode("edit")}
              >
                Edit
              </Button>
              <Button
                variant={mode == "crop" ? "default" : "secondary"}
                onClick={() => setMode("crop")}
              >
                Crop
              </Button>
            </div>
          </div>
        </div>
      </div>
      <ResizablePanelGroup
        id="container-panel"
        direction="horizontal"
        className="flex flex-1"
        ref={containerRef}
      >
        <ResizablePanel
          className="flex"
          defaultSize={75}
          onResize={handleImagePanelResize}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
            }}
            className="p-2"
          >
            <div className="flex-1 border-2 relative">
              <canvas ref={canvasRef} {...listeners} />
              {mode === "crop" && imageRef.current ? (
                <Cropper
                  key={JSON.stringify(offset)}
                  cropBounds={{
                    minX: offset.x,
                    minY: offset.y,
                    maxX: offset.x + imageRef.current.width * zoomLevel,
                    maxY: offset.y + imageRef.current.height * zoomLevel,
                  }}
                />
              ) : null}
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={25}>
          <div>abcd</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
