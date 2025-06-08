import { useEffect, useRef, useState } from "react";
import { useCanvasZoomPan } from "./use-canvas-zoom-pan";
import { Cropper, CropOptions } from "./Cropper";
import { useCropStore, type CropRect } from "./store/cropStore";
import {
  ResizablePanel,
  ResizableHandle,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { getPanelGroupElement } from "react-resizable-panels";

// Given a canvas element ref and an Image instance, render the
// image to the canvas
function renderImageToCanvas(
  canvasRef: HTMLCanvasElement | null,
  imageRef: HTMLImageElement,
  zoomLevel: number,
  offset: { x: number; y: number },
  appliedCrop?: {
    cropRect: CropRect;
    originalZoomLevel: number;
    imageOffset: { x: number; y: number };
  },
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

    if (appliedCrop) {
      // Convert crop coordinates from canvas space to image space using the original zoom level
      const { cropRect, originalZoomLevel, imageOffset } = appliedCrop;

      // Calculate the crop area in actual image pixels using the original image offset
      const cropX = (cropRect.x - imageOffset.x) / originalZoomLevel;
      const cropY = (cropRect.y - imageOffset.y) / originalZoomLevel;
      const cropWidth = cropRect.width / originalZoomLevel;
      const cropHeight = cropRect.height / originalZoomLevel;

      // Create a virtual coordinate system where the cropped area becomes the "full image"
      // The cropped image should behave as if it's a standalone image
      const virtualImageWidth = cropWidth;
      const virtualImageHeight = cropHeight;

      // Calculate how to fit the virtual image in the canvas at current zoom
      const scaledVirtualWidth = virtualImageWidth * zoomLevel;
      const scaledVirtualHeight = virtualImageHeight * zoomLevel;

      // Draw the cropped portion using the current offset for panning
      ctx.drawImage(
        imageRef,
        cropX, // source x in original image
        cropY, // source y in original image
        cropWidth, // source width
        cropHeight, // source height
        offset.x, // destination x (for panning)
        offset.y, // destination y (for panning)
        scaledVirtualWidth, // destination width (scaled by zoom)
        scaledVirtualHeight, // destination height (scaled by zoom)
      );
    } else {
      // Draw the whole image
      const scaledImageWidth = zoomLevel * imageWidth;
      const scaledImageHeight = zoomLevel * imageHeight;

      ctx.drawImage(
        imageRef,
        offset.x,
        offset.y,
        scaledImageWidth,
        scaledImageHeight,
      );
    }
  }
}

type Props = {
  imageSrc: string;
};
export function ReactImageEditor({ imageSrc }: Props) {
  const [cropMode, setCropMode] = useState(true);
  const [appliedCrop, setAppliedCrop] = useState<{
    imageOffset: { x: number; y: number };
    cropRect: CropRect;
    zoomLevel: number;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const virtualImageRef = useRef<HTMLImageElement | null>(null);

  // Create virtual image for cropped dimensions
  useEffect(() => {
    if (appliedCrop && imageRef.current) {
      const virtualImg = new Image();
      const { cropRect, zoomLevel: originalZoomLevel } = appliedCrop;
      virtualImg.width = cropRect.width / originalZoomLevel;
      virtualImg.height = cropRect.height / originalZoomLevel;
      virtualImageRef.current = virtualImg;
    } else {
      virtualImageRef.current = null;
    }
  }, [appliedCrop]);

  const { zoomLevel, offset, zoomIn, zoomOut, resetZoom, listeners } =
    useCanvasZoomPan(canvasRef, appliedCrop ? virtualImageRef : imageRef);

  // Reset zoom when in crop mode
  useEffect(() => {
    if (cropMode) {
      resetZoom();
    }
  }, [cropMode, resetZoom]);

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
          appliedCrop
            ? {
                cropRect: appliedCrop.cropRect,
                originalZoomLevel: appliedCrop.zoomLevel,
                imageOffset: appliedCrop.imageOffset,
              }
            : undefined,
        );
      }
    });
  }, [zoomLevel, offset, appliedCrop]);

  function handleResetZoomClick() {
    resetZoom();
  }
  function handleImagePanelResize(panelWidth: number) {
    const CONTAINER_PADDING = 32;
    // We have to manually resize the canvas when the panel width changes
    if (canvasRef.current) {
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
  const { resetAll } = useCropStore();

  function handleCropReset() {
    if (imageRef.current) {
      resetAll({
        minX: offset.x,
        minY: offset.y,
        maxX: offset.x + imageRef.current.width * zoomLevel,
        maxY: offset.y + imageRef.current.height * zoomLevel,
      });
    }
  }
  function handleCropApplication(cropRect: CropRect) {
    console.log("Crop applied:", cropRect);
    setAppliedCrop({
      imageOffset: { x: offset.x, y: offset.y },
      cropRect,
      zoomLevel,
    });
    setCropMode(false);
    // Reset zoom to fit the cropped image
    setTimeout(() => resetZoom(), 0);
  }

  return (
    <div className="w-full h-full flex flex-col">
      <ResizablePanelGroup
        id="container-panel"
        direction="horizontal"
        className="flex flex-1"
      >
        <ResizablePanel
          className="flex flex-col"
          defaultSize={75}
          onResize={handleImagePanelResize}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
            }}
            className="p-0"
          >
            <div className="flex-1 border-2 relative">
              <canvas ref={canvasRef} {...listeners} />
              {cropMode && imageRef.current ? (
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
          <div className="flex flex-row-reverse w-full py-2 px-4">
            <div
              className="flex gap-4"
              style={{ display: !cropMode ? "flex" : "none" }}
            >
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
        </ResizablePanel>
        <ResizableHandle className="w-[2px] bg-gray-300 mx-2" />
        <ResizablePanel defaultSize={25}>
          <div className="w-full bg-gray-100 py-1 px-2 flex gap-2">
            <Button
              onClick={() => setCropMode(!cropMode)}
              variant={cropMode ? "default" : "outline"}
              size="sm"
            >
              Crop
            </Button>
            {appliedCrop && (
              <Button
                onClick={() => {
                  setAppliedCrop(null);
                }}
                variant="outline"
                size="sm"
              >
                Reset Crop
              </Button>
            )}
          </div>
          {cropMode && !appliedCrop ? (
            <div className="m-2">
              <CropOptions
                onReset={handleCropReset}
                onApply={handleCropApplication}
              />
            </div>
          ) : null}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
