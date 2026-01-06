import { useEffect, useMemo, useRef, useState } from "react";

import { EditorCanvas } from "@/editor/EditorCanvas";

import { getPanelGroupElement } from "react-resizable-panels";
import { PlusIcon, MinusIcon } from "@radix-ui/react-icons";
import {
  ResizablePanel,
  ResizableHandle,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";

import { ExportTool } from "@/editor/ExportTool";
import { getMaxInnerAxisAlignedRectSize } from "@/geometry/rotation";

import type { ExportFormat } from "./export-download";

import {
  estimateWhiteBalanceFromRgb,
  sampleAverageRgb,
  WHITE_BALANCE_PRESETS,
} from "./lib/white-balance";


import { ToneCurveEditor } from "./components/ToneCurveEditor";
import { useCanvasZoomPan } from "./use-canvas-zoom-pan";
import {
  CropToolButtons,
  CropToolOptions,
  CropToolOverlay,
} from "@/editor/CropTool";
import { LightPanel } from "@/editor/LightPanel";
import { ColorPanel } from "@/editor/ColorPanel";
import { WhiteBalancePanel } from "@/editor/WhiteBalancePanel";
import { useCropStore } from "./store/cropStore";


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

const WHITE_BALANCE_PRESETS_UI = [
  { value: "daylight", label: "Daylight" },
  { value: "cloudy", label: "Cloudy" },
  { value: "shade", label: "Shade" },
  { value: "tungsten", label: "Tungsten" },
  { value: "fluorescent", label: "Fluorescent" },
  { value: "flash", label: "Flash" },
  { value: "custom", label: "Custom" },
] as const;

const WHITE_BALANCE_PICKER_RADIUS = 2;

type LightSliderProps = {
  label: string;
  name: string;
  value: number;
  defaultValue: number;
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
  defaultValue,
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
        onDoubleClick={() => onValueChange(defaultValue)}
        disabled={disabled}
        aria-label={label}
        className="w-full"
      />
    </div>
  );
}

// Preview canvas rendering is handled by `EditorCanvas`.

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

  const [isPickingWhiteBalance, setIsPickingWhiteBalance] = useState(false);

  useEffect(() => {
    if (!isPickingWhiteBalance) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      event.preventDefault();
      setIsPickingWhiteBalance(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPickingWhiteBalance]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const bakedImageUrlRef = useRef<string | null>(null);

  const {
    resetAll,
    cropSettings,
    setRotation,
    resetRotation,
    whiteBalance,
    setWhiteBalance,
    resetWhiteBalance,
    lightAdjustments,
    setLightAdjustment,
    resetLightAdjustments,
    colorAdjustments,
    setColorAdjustment,
    resetColorAdjustments,
    toneCurve,
    setToneCurveMode,
    setToneCurveChannel,
    setToneCurvePoints,
    setToneCurveParametricRgb,
    resetToneCurve,
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
                {isPickingWhiteBalance ? (
                  <div className="absolute left-2 top-2 z-10 rounded-md bg-white/90 px-2 py-1 text-xs text-gray-700 shadow">
                    Click image to pick white balance (Esc to cancel)
                  </div>
                ) : null}

              <EditorCanvas
                canvasRef={canvasRef}
                imageRef={imageRef}
                zoomLevel={zoomLevel}
                offset={offset}
                rotation={rotation}
                whiteBalance={whiteBalance}
                lightAdjustments={lightAdjustments}
                toneCurve={toneCurve}
                colorAdjustments={colorAdjustments}
                listeners={listeners}
                isPickingWhiteBalance={isPickingWhiteBalance}
                onPickWhiteBalance={(event) => {
                  if (!isPickingWhiteBalance) {
                    return;
                  }

                  if (!canvasRef.current) return;

                  // Cancel pick mode after a click attempt.
                  setIsPickingWhiteBalance(false);

                  // Read a small region from the preview canvas. This can fail if the
                  // canvas is tainted (CORS).
                  const ctx = canvasRef.current.getContext("2d", {
                    willReadFrequently: true,
                  });
                  if (!ctx) return;

                  try {
                    const rect = canvasRef.current.getBoundingClientRect();
                    const x = Math.round(event.clientX - rect.left);
                    const y = Math.round(event.clientY - rect.top);

                    const radius = WHITE_BALANCE_PICKER_RADIUS;
                    const size = radius * 2 + 1;

                    const sx = Math.max(0, x - radius);
                    const sy = Math.max(0, y - radius);
                    const sw = Math.min(size, Math.max(1, canvasRef.current.width - sx));
                    const sh = Math.min(size, Math.max(1, canvasRef.current.height - sy));

                    const imageData = ctx.getImageData(sx, sy, sw, sh);
                    const avg = sampleAverageRgb(
                      imageData.data,
                      sw,
                      sh,
                      radius,
                      radius,
                      radius,
                    );
                    const estimated = estimateWhiteBalanceFromRgb(avg);

                    setWhiteBalance({
                      preset: "custom",
                      temperatureKelvin: Math.round(estimated.temperatureKelvin),
                      tint: Math.round(estimated.tint),
                    });
                  } catch {
                    // Likely a tainted canvas; silently ignore for now.
                  }
                }}
              />
              <CropToolOverlay
                cropMode={cropMode}
                imageRef={imageRef}
                cropBounds={cropBounds}
              />
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
                <CropToolButtons
                  cropMode={cropMode}
                  setCropMode={setCropMode}
                  hasAppliedCrop={hasAppliedCrop}
                  imageRef={imageRef}
                  originalImageRef={originalImageRef}
                  setHasAppliedCrop={setHasAppliedCrop}
                  resetRotation={resetRotation}
                  resetZoom={resetZoom}
                />

                <ExportTool
                  imageRef={imageRef}
                  isImageLoaded={isImageLoaded}
                  cropMode={cropMode}
                  rotation={rotation}
                  whiteBalance={whiteBalance}
                  lightAdjustments={lightAdjustments}
                  toneCurve={toneCurve}
                  colorAdjustments={colorAdjustments}
                  exportFormat={exportFormat}
                  setExportFormat={setExportFormat}
                  jpegQuality={jpegQuality}
                  setJpegQuality={setJpegQuality}
                  isDownloading={isDownloading}
                  setIsDownloading={setIsDownloading}
                  exportError={exportError}
                  setExportError={setExportError}
                />
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

                    <WhiteBalancePanel
                      isImageLoaded={isImageLoaded}
                      whiteBalance={whiteBalance}
                      resetWhiteBalance={resetWhiteBalance}
                      setIsPickingWhiteBalance={setIsPickingWhiteBalance}
                      presets={WHITE_BALANCE_PRESETS_UI}
                      formatSignedInt={formatSignedInt}
                      Slider={LightSlider}
                      onPresetChange={(nextPreset) => {
                        const preset =
                          nextPreset as (typeof WHITE_BALANCE_PRESETS_UI)[number]["value"];

                        if (preset === "custom") {
                          setWhiteBalance({ preset: "custom" });
                          return;
                        }

                        const presetKey = preset as keyof typeof WHITE_BALANCE_PRESETS;
                        const presetValues = WHITE_BALANCE_PRESETS[presetKey];
                        setWhiteBalance({
                          preset,
                          temperatureKelvin: presetValues.temperatureKelvin,
                          tint: presetValues.tint,
                        });
                      }}
                      onTempChange={(value) =>
                        setWhiteBalance({ temperatureKelvin: value })
                      }
                      onTintChange={(value) => setWhiteBalance({ tint: value })}
                    />


                  <LightPanel
                    isImageLoaded={isImageLoaded}
                    lightAdjustments={lightAdjustments}
                    resetLightAdjustments={resetLightAdjustments}
                    setLightAdjustment={setLightAdjustment}
                    formatSigned={formatSigned}
                    formatSignedInt={formatSignedInt}
                    Slider={LightSlider}
                  />


                  <ColorPanel
                    isImageLoaded={isImageLoaded}
                    colorAdjustments={colorAdjustments}
                    resetColorAdjustments={resetColorAdjustments}
                    setColorAdjustment={setColorAdjustment}
                    formatSignedInt={formatSignedInt}
                    Slider={LightSlider}
                  />
                </div>
              </details>

              <details
                className="rounded-md border bg-white"
                data-testid="tone-curve-accordion"
              >
                <summary className="cursor-pointer select-none list-none px-3 py-2 text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span>Tone Curve</span>
                  </span>
                  <span className="text-xs text-gray-500">▾</span>
                </summary>

                <div className="px-3 pb-3">
                  <div className="flex items-center justify-between py-2">
                    <div className="text-xs font-medium text-gray-700">
                      Tone Curve
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => resetToneCurve()}
                      disabled={!isImageLoaded}
                    >
                      Reset
                    </Button>
                  </div>

                  <div className="mt-3 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-gray-600">Mode:</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className={`h-7 rounded-md border px-2 text-xs ${
                            toneCurve.mode === "point"
                              ? "bg-gray-900 text-white"
                              : "bg-white text-gray-700"
                          }`}
                          onClick={() => setToneCurveMode("point")}
                          disabled={!isImageLoaded}
                          aria-label="Tone Curve mode: Point"
                        >
                          Point
                        </button>
                        <button
                          type="button"
                          className={`h-7 rounded-md border px-2 text-xs ${
                            toneCurve.mode === "parametric"
                              ? "bg-gray-900 text-white"
                              : "bg-white text-gray-700"
                          }`}
                          onClick={() => setToneCurveMode("parametric")}
                          disabled={!isImageLoaded}
                          aria-label="Tone Curve mode: Parametric"
                        >
                          Region
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-gray-600">Adjust:</div>
                      <div className="flex items-center gap-2">
                        {([
                          { key: "rgb", label: "RGB" },
                          { key: "r", label: "R" },
                          { key: "g", label: "G" },
                          { key: "b", label: "B" },
                        ] as const).map((channel) => (
                          <button
                            key={channel.key}
                            type="button"
                            className={`h-7 rounded-md border px-2 text-xs ${
                              toneCurve.activeChannel === channel.key
                                ? "bg-gray-900 text-white"
                                : "bg-white text-gray-700"
                            }`}
                            onClick={() => setToneCurveChannel(channel.key)}
                            disabled={!isImageLoaded}
                            aria-label={`Tone Curve channel: ${channel.label}`}
                          >
                            {channel.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <ToneCurveEditor
                      points={toneCurve.point[toneCurve.activeChannel]}
                      onChangePoints={(nextPoints) =>
                        setToneCurvePoints(toneCurve.activeChannel, nextPoints)
                      }
                      disabled={!isImageLoaded || toneCurve.mode !== "point"}
                    />

                    <div className="border-t pt-3">
                      <div className="text-xs font-medium text-gray-700">
                        Region
                      </div>
                      <div className="mt-3 flex flex-col gap-3">
                        <LightSlider
                          label="Highlights"
                          name="tone-curve-highlights"
                          value={toneCurve.parametric.rgb.highlights}
                          defaultValue={0}
                          min={-100}
                          max={100}
                          step={1}
                          disabled={!isImageLoaded || toneCurve.mode !== "parametric"}
                          format={(value) => formatSignedInt(value)}
                          onValueChange={(value) =>
                            setToneCurveParametricRgb({ highlights: value })
                          }
                        />
                        <LightSlider
                          label="Lights"
                          name="tone-curve-lights"
                          value={toneCurve.parametric.rgb.lights}
                          defaultValue={0}
                          min={-100}
                          max={100}
                          step={1}
                          disabled={!isImageLoaded || toneCurve.mode !== "parametric"}
                          format={(value) => formatSignedInt(value)}
                          onValueChange={(value) =>
                            setToneCurveParametricRgb({ lights: value })
                          }
                        />
                        <LightSlider
                          label="Darks"
                          name="tone-curve-darks"
                          value={toneCurve.parametric.rgb.darks}
                          defaultValue={0}
                          min={-100}
                          max={100}
                          step={1}
                          disabled={!isImageLoaded || toneCurve.mode !== "parametric"}
                          format={(value) => formatSignedInt(value)}
                          onValueChange={(value) =>
                            setToneCurveParametricRgb({ darks: value })
                          }
                        />
                        <LightSlider
                          label="Shadows"
                          name="tone-curve-shadows"
                          value={toneCurve.parametric.rgb.shadows}
                          defaultValue={0}
                          min={-100}
                          max={100}
                          step={1}
                          disabled={!isImageLoaded || toneCurve.mode !== "parametric"}
                          format={(value) => formatSignedInt(value)}
                          onValueChange={(value) =>
                            setToneCurveParametricRgb({ shadows: value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </details>

          </div>
          <CropToolOptions
            cropMode={cropMode}
            imageRef={imageRef}
            bakedImageUrlRef={bakedImageUrlRef}
            setCropMode={setCropMode}
            setHasAppliedCrop={setHasAppliedCrop}
            setIsImageLoaded={setIsImageLoaded}
            zoomLevel={zoomLevel}
            offset={offset}
            rotation={rotation}
            resetRotation={resetRotation}
            resetZoom={resetZoom}
            resetAll={resetAll}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
