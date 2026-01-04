import { useEffect, useMemo, useRef, useState } from "react";

import { getPanelGroupElement } from "react-resizable-panels";
import { PlusIcon, MinusIcon } from "@radix-ui/react-icons";
import {
  ResizablePanel,
  ResizableHandle,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMaxInnerAxisAlignedRectSize } from "@/geometry/rotation";

import {
  canvasToBlob,
  drawImageWithRotation,
  renderCommittedImageToOffscreenCanvas,
  triggerDownload,
  type ExportFormat,
} from "./export-download";

import { applyLightAdjustmentsToRgbaBytes } from "./lib/light-adjustments";
import { useCanvasZoomPan } from "./use-canvas-zoom-pan";
import { Cropper, CropOptions } from "./Cropper";
import { useCropStore, type CropRect } from "./store/cropStore";

function formatSigned(value: number, digits: number) {
  const normalized = Object.is(value, -0) ? 0 : value;
  const sign = normalized > 0 ? "+" : normalized < 0 ? "-" : "+";
  return `${sign}${Math.abs(normalized).toFixed(digits)}`;
}

function formatSignedInt(value: number) {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "+";
  return `${sign}${Math.abs(rounded)}`;
}

const WHITE_BALANCE_PRESETS = [
  { value: "as-shot", label: "As Shot" },
  { value: "auto", label: "Auto" },
  { value: "daylight", label: "Daylight" },
  { value: "cloudy", label: "Cloudy" },
  { value: "shade", label: "Shade" },
  { value: "tungsten", label: "Tungsten" },
  { value: "fluorescent", label: "Fluorescent" },
  { value: "flash", label: "Flash" },
  { value: "custom", label: "Custom" },
] as const;

type LightSliderProps = {
  label: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  format: (value: number) => string;
  onValueChange: (value: number) => void;
};

function LightSlider({
  label,
  name,
  value,
  min,
  max,
  step,
  disabled,
  format,
  onValueChange,
}: LightSliderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-700" htmlFor={name}>
          {label}
        </label>
        <span className="text-xs tabular-nums text-gray-700 w-[52px] text-right">
          {format(value)}
        </span>
      </div>
      <input
        id={name}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onValueChange(Number(e.target.value))}
        disabled={disabled}
        aria-label={label}
        className="w-full"
      />
    </div>
  );
}

// Given a canvas element ref and an Image instance, render the
// image to the canvas
function renderImageToCanvas(
  canvasRef: HTMLCanvasElement | null,
  imageRef: HTMLImageElement | HTMLCanvasElement,
  zoomLevel: number,
  offset: { x: number; y: number },
  rotation: number,
  lightAdjustments?: Parameters<typeof applyLightAdjustmentsToRgbaBytes>[2],
  cache?: {
    baseCanvas: HTMLCanvasElement;
    baseKey: string;
    adjustedCanvas: HTMLCanvasElement;
    in: Uint8ClampedArray;
    out: Uint8ClampedArray;
  },
) {
  if (!canvasRef) return;

  const ctx = canvasRef.getContext("2d");
  if (!ctx) return;

  // We restrict the canvas width to the canvas container width
  const canvasWidth = canvasRef.width;
  const canvasHeight = canvasRef.height;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const shouldApplyLight =
    lightAdjustments != null &&
    (lightAdjustments.exposure !== 0 ||
      lightAdjustments.contrast !== 0 ||
      lightAdjustments.highlights !== 0 ||
      lightAdjustments.shadows !== 0 ||
      lightAdjustments.whites !== 0 ||
      lightAdjustments.blacks !== 0);

  if (!shouldApplyLight || !cache) {
    ctx.save();
    drawImageWithRotation(ctx, imageRef, zoomLevel, offset, rotation);
    ctx.restore();
    return;
  }

  const baseKey = `${canvasWidth}x${canvasHeight}:${zoomLevel}:${offset.x}:${offset.y}:${rotation}`;

  if (cache.baseKey !== baseKey) {
    cache.baseCanvas.width = canvasWidth;
    cache.baseCanvas.height = canvasHeight;

    const baseCtx = cache.baseCanvas.getContext("2d", { willReadFrequently: true });
    if (!baseCtx) return;

    baseCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    baseCtx.save();
    drawImageWithRotation(baseCtx, imageRef, zoomLevel, offset, rotation);
    baseCtx.restore();

    const imageData = baseCtx.getImageData(0, 0, canvasWidth, canvasHeight);
    cache.in = imageData.data;
    cache.out = new Uint8ClampedArray(cache.in.length);

    cache.baseKey = baseKey;
  }

  const source = cache.in;
  const dest = cache.out;

  applyLightAdjustmentsToRgbaBytes(source, dest, lightAdjustments);

  cache.adjustedCanvas.width = canvasWidth;
  cache.adjustedCanvas.height = canvasHeight;

  const adjustedCtx = cache.adjustedCanvas.getContext("2d");
  if (!adjustedCtx) return;

  const adjustedData = new ImageData(dest, canvasWidth, canvasHeight);
  adjustedCtx.putImageData(adjustedData, 0, 0);

  ctx.save();
  ctx.drawImage(cache.adjustedCanvas, 0, 0);
  ctx.restore();
}

type Props = {
  imageSrc: string;
};

export function ReactImageEditor({ imageSrc }: Props) {
  const [cropMode, setCropMode] = useState(false);
  const [hasAppliedCrop, setHasAppliedCrop] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [jpegQuality, setJpegQuality] = useState(92);
  const [isDownloading, setIsDownloading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const bakedImageUrlRef = useRef<string | null>(null);

  const {
    resetAll,
    cropSettings,
    setRotation,
    resetRotation,
    lightAdjustments,
    setLightAdjustment,
    resetLightAdjustments,
  } = useCropStore();
  const rotation = cropSettings.rotation ?? 0;

  const { zoomLevel, offset, zoomIn, zoomOut, resetZoom, listeners } =
    useCanvasZoomPan(canvasRef, imageRef);

  // Reset zoom when in crop mode
  useEffect(() => {
    if (cropMode) {
      resetZoom();
    }
  }, [cropMode, resetZoom]);

  useEffect(() => {
    if (!cropMode) return;

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        resetRotation();
        return;
      }

      if (event.key !== "[" && event.key !== "]") return;

      event.preventDefault();

      const step = event.shiftKey ? 5 : 1;
      const delta = event.key === "[" ? -step : step;
      setRotation(rotation + delta);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [cropMode, resetRotation, rotation, setRotation]);

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
    img.crossOrigin = "anonymous";
    img.src = imageSrc;

    // when the browser is done loading the image to our Image instance
    // we try to render it to the canvas
    setIsImageLoaded(false);

    img.onload = () => {
      imageRef.current = img;
      originalImageRef.current = img;
      setHasAppliedCrop(false);
      setIsImageLoaded(true);
      if (bakedImageUrlRef.current) {
        URL.revokeObjectURL(bakedImageUrlRef.current);
        bakedImageUrlRef.current = null;
      }

      // We trigger a recalculation of zoomLevel and image offset by calling resetZoom
      // Otherwise the useEffect which renders the image on change on zoom level might not be called
      // the first time. Or, it is called, but the imageRef.current is still null so we render nothing
      // Once the image is loaded, we need to calculate the zoom level and image offset once more
      resetZoom();
    };
  }, [imageSrc, resetZoom]);

  useEffect(() => {
    return () => {
      if (bakedImageUrlRef.current) {
        URL.revokeObjectURL(bakedImageUrlRef.current);
      }
    };
  }, []);

  const renderRef = useRef<number | null>(null);
  const lightRenderCacheRef = useRef<{
    baseCanvas: HTMLCanvasElement;
    baseKey: string;
    adjustedCanvas: HTMLCanvasElement;
    in: Uint8ClampedArray;
    out: Uint8ClampedArray;
  } | null>(null);

  if (!lightRenderCacheRef.current && typeof document !== "undefined") {
    lightRenderCacheRef.current = {
      baseCanvas: document.createElement("canvas"),
      baseKey: "",
      adjustedCanvas: document.createElement("canvas"),
      in: new Uint8ClampedArray(0),
      out: new Uint8ClampedArray(0),
    };
  }

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
          rotation,
          lightAdjustments,
          lightRenderCacheRef.current ?? undefined,
        );
      }
    });
  }, [zoomLevel, offset, rotation, lightAdjustments]);

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

  async function handleDownload() {
    if (!imageRef.current) return;
    if (!isImageLoaded) return;

    setExportError(null);
    setIsDownloading(true);

    try {
      if (cropMode) {
        setExportError("Apply crop to download");
        return;
      }

      const mimeType = exportFormat === "png" ? "image/png" : "image/jpeg";
      const extension = exportFormat === "png" ? "png" : "jpg";
      const background = exportFormat === "png" ? "transparent" : "white";

      const offscreen = renderCommittedImageToOffscreenCanvas(
        imageRef.current,
        rotation,
        background,
      );
      if (!offscreen) {
        setExportError("Failed to export image");
        return;
      }

      const quality = exportFormat === "jpeg" ? jpegQuality / 100 : undefined;
      const blob = await canvasToBlob(offscreen, mimeType, quality);
      if (!blob) {
        setExportError("Failed to export image");
        return;
      }

      triggerDownload(blob, `edited-image.${extension}`);
    } catch {
      setExportError("Failed to export image");
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleCropApplication(cropRect: CropRect) {
    if (!imageRef.current) return;
    if (!Number.isFinite(zoomLevel) || zoomLevel <= 0) return;

    const outputWidth = Math.max(1, Math.round(cropRect.width / zoomLevel));
    const outputHeight = Math.max(1, Math.round(cropRect.height / zoomLevel));

    const offscreen = document.createElement("canvas");
    offscreen.width = outputWidth;
    offscreen.height = outputHeight;

    const ctx = offscreen.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, offscreen.width, offscreen.height);
    ctx.save();

    // Convert canvas-space offset/cropRect into image-pixel space, so we render at zoom=1.
    const bakedOffset = {
      x: (offset.x - cropRect.x) / zoomLevel,
      y: (offset.y - cropRect.y) / zoomLevel,
    };

    drawImageWithRotation(ctx, imageRef.current, 1, bakedOffset, rotation);

    ctx.restore();

    const blob = await canvasToBlob(offscreen, "image/png");
    if (!blob) return;

    if (bakedImageUrlRef.current) {
      URL.revokeObjectURL(bakedImageUrlRef.current);
    }

    const url = URL.createObjectURL(blob);
    bakedImageUrlRef.current = url;

    const bakedImage = new Image();
    bakedImage.crossOrigin = "anonymous";
    bakedImage.src = url;

      bakedImage.onload = () => {
        imageRef.current = bakedImage;
        setHasAppliedCrop(true);
        setIsImageLoaded(true);
        setCropMode(false);
        resetRotation();
        resetZoom();
      };

    bakedImage.onerror = () => {
      if (bakedImageUrlRef.current) {
        URL.revokeObjectURL(bakedImageUrlRef.current);
        bakedImageUrlRef.current = null;
      }
    };
  }
  const cropBounds = useMemo(() => {
    if (!imageRef.current) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    const imageWidth = imageRef.current.width * zoomLevel;
    const imageHeight = imageRef.current.height * zoomLevel;

    const baseBounds = {
      minX: offset.x,
      minY: offset.y,
      maxX: offset.x + imageWidth,
      maxY: offset.y + imageHeight,
    };

    const constrainCrop = cropSettings.constrainCrop ?? true;
    if (!constrainCrop || rotation === 0) {
      return baseBounds;
    }

    const constrainedSize = getMaxInnerAxisAlignedRectSize(
      imageWidth,
      imageHeight,
      rotation,
    );

    if (constrainedSize.width <= 0 || constrainedSize.height <= 0) {
      return baseBounds;
    }

    const centerX = offset.x + imageWidth / 2;
    const centerY = offset.y + imageHeight / 2;

    const constrainedWidth = Math.min(constrainedSize.width, imageWidth);
    const constrainedHeight = Math.min(constrainedSize.height, imageHeight);

    return {
      minX: centerX - constrainedWidth / 2,
      minY: centerY - constrainedHeight / 2,
      maxX: centerX + constrainedWidth / 2,
      maxY: centerY + constrainedHeight / 2,
    };
  }, [cropSettings.constrainCrop, offset.x, offset.y, rotation, zoomLevel]);

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
          <div className="flex flex-col flex-1 p-0">
            <div className="flex-1 border-2 relative">
              <canvas ref={canvasRef} {...listeners} />
              {cropMode && imageRef.current ? (
                <Cropper cropBounds={cropBounds} />
              ) : null}
            </div>
          </div>
          <div className="flex flex-row-reverse w-full py-2 px-4">
            <div
              className="flex gap-0.5"
              style={{ display: !cropMode ? "flex" : "none" }}
            >
              <Button
                className="size-8"
                onClick={zoomOut}
                size="icon"
                variant="outline"
                title="Zoom Out"
              >
                <MinusIcon />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="size-8 px-6"
                onClick={handleResetZoomClick}
                title="Reset"
              >
                {Math.round(zoomLevel * 100)}%
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="size-8"
                onClick={zoomIn}
                title="Zoom In"
              >
                <PlusIcon />
              </Button>
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle className="w-[2px] bg-gray-300 mx-2" />
          <ResizablePanel defaultSize={25}>
            <div className="w-full bg-gray-100 py-1 px-2 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => setCropMode(!cropMode)}
                  variant={cropMode ? "default" : "outline"}
                  size="sm"
                >
                  Crop
                </Button>
                {hasAppliedCrop && (
                  <Button
                    onClick={() => {
                      if (!originalImageRef.current) return;
                      imageRef.current = originalImageRef.current;
                      setHasAppliedCrop(false);
                      resetRotation();
                      resetZoom();
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Reset Crop
                  </Button>
                )}

                <Button
                  onClick={handleDownload}
                  variant="default"
                  size="sm"
                  disabled={!isImageLoaded || isDownloading || cropMode}
                  title={
                    !isImageLoaded
                      ? "Load an image to download"
                      : cropMode
                        ? "Apply crop to download"
                        : undefined
                  }
                >
                  {isDownloading ? "Downloading…" : "Download"}
                </Button>

                <Select
                  value={exportFormat}
                  onValueChange={(value) => setExportFormat(value as ExportFormat)}
                >
                  <SelectTrigger
                    size="sm"
                    className="w-[110px]"
                    data-testid="export-format"
                  >
                    <SelectValue placeholder="Format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="png">PNG</SelectItem>
                    <SelectItem value="jpeg">JPEG</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <details className="rounded-md border bg-white" open>
                <summary className="cursor-pointer select-none list-none px-3 py-2 text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span>Basic</span>
                  </span>
                  <span className="text-xs text-gray-500">▾</span>
                </summary>

                <div className="px-3 pb-3">
                  <div className="flex items-center justify-between py-2">
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={!isImageLoaded}>
                        Auto
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={!isImageLoaded}>
                        B&W
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={!isImageLoaded}>
                        HDR
                      </Button>
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-gray-700">Profile</div>
                      <div className="text-xs text-gray-500">▾</div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-xs text-gray-600">Profile:</div>
                      <input
                        type="text"
                        disabled
                        value=""
                        className="w-[140px] rounded-sm border bg-gray-50 px-2 py-1 text-xs text-gray-500"
                        aria-label="Profile"
                      />
                    </div>
                  </div>

                  <div className="mt-4 border-t pt-3">
                    <div className="text-xs font-medium text-gray-700">WB</div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="text-xs text-gray-600">WB:</div>
                      <select
                        value={WHITE_BALANCE_PRESETS[0].value}
                        disabled
                        aria-label="White Balance"
                        className="h-8 w-[140px] rounded-md border bg-gray-50 px-2 text-xs text-gray-700 disabled:opacity-70"
                      >
                        {WHITE_BALANCE_PRESETS.map((preset) => (
                          <option key={preset.value} value={preset.value}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-3 flex flex-col gap-3">
                      <LightSlider
                        label="Temp"
                        name="temp"
                        value={0}
                        min={-100}
                        max={100}
                        step={1}
                        disabled
                        format={(value) => formatSignedInt(value)}
                        onValueChange={() => {}}
                      />
                      <LightSlider
                        label="Tint"
                        name="tint"
                        value={0}
                        min={-100}
                        max={100}
                        step={1}
                        disabled
                        format={(value) => formatSignedInt(value)}
                        onValueChange={() => {}}
                      />
                    </div>
                  </div>

                  <div className="mt-4 border-t pt-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-gray-700">Tone</div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => resetLightAdjustments()}
                        disabled={!isImageLoaded}
                      >
                        Reset
                      </Button>
                    </div>

                    <div className="mt-3 flex flex-col gap-3">
                      <LightSlider
                        label="Exposure"
                        name="exposure"
                        value={lightAdjustments.exposure}
                        min={-2}
                        max={2}
                        step={0.01}
                        disabled={!isImageLoaded}
                        format={(value) => formatSigned(value, 2)}
                        onValueChange={(value) =>
                          setLightAdjustment("exposure", value)
                        }
                      />

                      <LightSlider
                        label="Contrast"
                        name="contrast"
                        value={lightAdjustments.contrast}
                        min={-100}
                        max={100}
                        step={1}
                        disabled={!isImageLoaded}
                        format={(value) => formatSignedInt(value)}
                        onValueChange={(value) =>
                          setLightAdjustment("contrast", value)
                        }
                      />

                      <LightSlider
                        label="Highlights"
                        name="highlights"
                        value={lightAdjustments.highlights}
                        min={-100}
                        max={100}
                        step={1}
                        disabled={!isImageLoaded}
                        format={(value) => formatSignedInt(value)}
                        onValueChange={(value) =>
                          setLightAdjustment("highlights", value)
                        }
                      />

                      <LightSlider
                        label="Shadows"
                        name="shadows"
                        value={lightAdjustments.shadows}
                        min={-100}
                        max={100}
                        step={1}
                        disabled={!isImageLoaded}
                        format={(value) => formatSignedInt(value)}
                        onValueChange={(value) =>
                          setLightAdjustment("shadows", value)
                        }
                      />

                      <LightSlider
                        label="Whites"
                        name="whites"
                        value={lightAdjustments.whites}
                        min={-100}
                        max={100}
                        step={1}
                        disabled={!isImageLoaded}
                        format={(value) => formatSignedInt(value)}
                        onValueChange={(value) => setLightAdjustment("whites", value)}
                      />

                      <LightSlider
                        label="Blacks"
                        name="blacks"
                        value={lightAdjustments.blacks}
                        min={-100}
                        max={100}
                        step={1}
                        disabled={!isImageLoaded}
                        format={(value) => formatSignedInt(value)}
                        onValueChange={(value) => setLightAdjustment("blacks", value)}
                      />
                    </div>
                  </div>

                  <div className="mt-4 border-t pt-3">
                    <div className="text-xs font-medium text-gray-700">Presence</div>
                    <div className="mt-3 flex flex-col gap-3">
                      <LightSlider
                        label="Texture"
                        name="texture"
                        value={0}
                        min={-100}
                        max={100}
                        step={1}
                        disabled
                        format={(value) => formatSignedInt(value)}
                        onValueChange={() => {}}
                      />
                      <LightSlider
                        label="Clarity"
                        name="clarity"
                        value={0}
                        min={-100}
                        max={100}
                        step={1}
                        disabled
                        format={(value) => formatSignedInt(value)}
                        onValueChange={() => {}}
                      />
                      <LightSlider
                        label="Dehaze"
                        name="dehaze"
                        value={0}
                        min={-100}
                        max={100}
                        step={1}
                        disabled
                        format={(value) => formatSignedInt(value)}
                        onValueChange={() => {}}
                      />
                      <LightSlider
                        label="Vibrance"
                        name="vibrance"
                        value={0}
                        min={-100}
                        max={100}
                        step={1}
                        disabled
                        format={(value) => formatSignedInt(value)}
                        onValueChange={() => {}}
                      />
                      <LightSlider
                        label="Saturation"
                        name="saturation"
                        value={0}
                        min={-100}
                        max={100}
                        step={1}
                        disabled
                        format={(value) => formatSignedInt(value)}
                        onValueChange={() => {}}
                      />
                    </div>
                  </div>
                </div>
              </details>

              {exportFormat === "jpeg" ? (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-700" htmlFor="jpeg-quality">
                  Quality
                </label>
                <input
                  id="jpeg-quality"
                  data-testid="jpeg-quality"
                  type="range"
                  min={10}
                  max={100}
                  step={1}
                  value={jpegQuality}
                  onChange={(e) => setJpegQuality(Number(e.target.value))}
                />
                <span className="text-xs tabular-nums text-gray-700 w-[40px] text-right">
                  {jpegQuality}
                </span>
              </div>
            ) : null}

            {cropMode ? (
              <div className="text-xs text-gray-700">Apply crop to download</div>
            ) : null}

            {exportError ? (
              <div className="text-xs text-red-600">{exportError}</div>
            ) : null}
          </div>
          {cropMode ? (
            <div className="m-2">
              <CropOptions onReset={handleCropReset} onApply={handleCropApplication} />
            </div>
          ) : null}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
