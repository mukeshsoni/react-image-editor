import { useEffect, useMemo, useRef, useState } from "react";

import { MinusIcon, PlusIcon } from "@radix-ui/react-icons";
import { getPanelGroupElement } from "react-resizable-panels";

import { DebouncedRange } from "@/components/DebouncedRange";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { CropToolButtons, CropToolOptions, CropToolOverlay } from "@/editor/CropTool";
import { EditorCanvas } from "@/editor/EditorCanvas";
import { ExportTool } from "@/editor/ExportTool";
import { HealingToolButtons, HealingToolPanel } from "@/editor/HealingTool";
import { GeometryOpticsPanel } from "@/editor/GeometryOpticsPanel";
import { getPanelRegistry } from "@/editor/panels";
import {
  downscaleLuminanceNearest,
  estimateStraightenDegreesFromLuminance,
  extractLuminance,
} from "@/geometry/auto-straighten";
import { getMaxInnerAxisAlignedRectSize } from "@/geometry/rotation";
import { applyEditsSnapshot } from "@/store";
import type { HistoryEntry } from "@/store";
import { useGeometryOpticsStore } from "@/store/geometryOpticsStore";
import {
  areEditsEqual,
  createEditorSerializableState,
  getHistoryDisplayForEditsChange,
} from "@/store/historyRecording";

import type { ExportFormat } from "./export-download";
import { getMousePosInCanvas } from "./dom-helpers";
import { estimateWhiteBalanceFromRgb, sampleAverageRgb } from "./lib/white-balance";
import {
  calculateInitialImageStartOffset,
  calculateInitialZoomLevel,
  useCanvasZoomPan,
} from "./use-canvas-zoom-pan";

const HISTORY_COMMIT_DEBOUNCE_MS = 250;
import { getImageEditorEdits, subscribeToEdits, useHistoryStore } from "./store";
import { useResetAll } from "./store/editorActions";
import { type Bounds, useCropStore } from "./store/cropStore";
import { selectCanRedo, selectCanUndo } from "./store/historyStore";
import { useDenoiseStore } from "./store/denoiseStore";
import { useHealingStore } from "./store/healingStore";
import { useSharpeningStore } from "./store/sharpeningStore";
import { useWhiteBalanceStore } from "./store/whiteBalanceStore";


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
  const [draftValue, setDraftValue] = useState(value);
  const draftValueRef = useRef(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraftValue(value);
    draftValueRef.current = value;
  }, [value]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const scheduleCommit = useMemo(() => {
    return (nextValue: number) => {
      draftValueRef.current = nextValue;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        onValueChange(draftValueRef.current);
      }, 150);
    };
  }, [onValueChange]);

  const flushCommit = useMemo(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Commit the latest draft value immediately.
      onValueChange(draftValueRef.current);
    };
  }, [onValueChange]);


  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-700" htmlFor={name}>
          {label}
        </label>
        <span className="text-xs tabular-nums text-gray-700 w-[52px] text-right">
          {format(draftValue)}
        </span>
      </div>
      <input
        id={name}
        type="range"
        min={min}
        max={max}
        step={step}
        value={draftValue}
        onChange={(e) => {
          const next = Number(e.target.value);
          setDraftValue(next);
          scheduleCommit(next);
        }}
        onPointerUp={flushCommit}
        onMouseUp={flushCommit}
        onTouchEnd={flushCommit}
        onKeyUp={flushCommit}
        onBlur={flushCommit}
        onDoubleClick={() => {
          setDraftValue(defaultValue);
          scheduleCommit(defaultValue);
          flushCommit();
        }}
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
  onEditsChange?: (edits: import("@/store").ImageEditorEdits) => void;
};

export function ReactImageEditor({ imageSrc, onEditsChange }: Props) {
  const [cropMode, setCropMode] = useState(false);
  const [healingModeEnabled, setHealingModeEnabled] = useState(false);
  const healingBrush = useHealingStore((state) => state.healingBrush);
  const [healingCursor, setHealingCursor] = useState<{
    canvas: { x: number; y: number };
    image: import("@/store/cropStore").Point | null;
  } | null>(null);
  const cropCommitted = useCropStore((state) => state.cropCommitted);
  const cropCommit = useCropStore((state) => state.cropCommit);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [jpegQuality, setJpegQuality] = useState(92);
  const [isDownloading, setIsDownloading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [isPickingWhiteBalance, setIsPickingWhiteBalance] = useState(false);

  const [isAutoStraightening, setIsAutoStraightening] = useState(false);
  const [guidedUprightEnabled, setGuidedUprightEnabled] = useState(false);

  const geometryOptics = useGeometryOpticsStore((state) => state.settings);
  const setPerspective = useGeometryOpticsStore((state) => state.setPerspective);


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

  const cropSettings = useCropStore((state) => state.cropSettings);
  const setRotation = useCropStore((state) => state.setRotation);
  const resetRotation = useCropStore((state) => state.resetRotation);
  const setConstrainCrop = useCropStore((state) => state.setConstrainCrop);

  const resetHistoryToBaseline = useHistoryStore((state) => state.resetToBaseline);

  const resetAll = useResetAll();

  const setWhiteBalance = useWhiteBalanceStore((state) => state.setWhiteBalance);

  const rotation = cropSettings.rotation ?? 0;

  const historyEntries = useHistoryStore((state) => state.entries);
  const historyIndex = useHistoryStore((state) => state.index);
  const historyJumpTo = useHistoryStore((state) => state.jumpTo);
  const historyUndo = useHistoryStore((state) => state.undo);
  const historyRedo = useHistoryStore((state) => state.redo);
  const editsPush = useHistoryStore((state) => state.push);

  const canUndo = useHistoryStore(selectCanUndo);
  const canRedo = useHistoryStore(selectCanRedo);

  const lastCommittedEditsRef = useRef(getImageEditorEdits());

  const zoomPanStateRef = useRef({ zoomLevel: 1, offset: { x: 0, y: 0 } });
  const commitCameraTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitializingRef = useRef(true);
  const isApplyingHistoryRef = useRef(false);

  const { zoomLevel, offset, zoomIn, zoomOut, resetZoom, setCamera, listeners } =
    useCanvasZoomPan(canvasRef, imageRef, {
      enableWheel: true,
      onCameraChange: (camera) => {
        if (isInitializingRef.current || isApplyingHistoryRef.current) {
          zoomPanStateRef.current = camera;
          return;
        }

        if (commitCameraTimeoutRef.current) {
          clearTimeout(commitCameraTimeoutRef.current);
        }

        commitCameraTimeoutRef.current = setTimeout(() => {
          commitCameraTimeoutRef.current = null;

          const lastCamera = zoomPanStateRef.current;
          if (
            lastCamera.zoomLevel === camera.zoomLevel &&
            lastCamera.offset.x === camera.offset.x &&
            lastCamera.offset.y === camera.offset.y
          ) {
            return;
          }

          editsPush({
            label: "Zoom/Pan",
            state: createEditorSerializableState({
              edits: lastCommittedEditsRef.current,
              zoomLevel: camera.zoomLevel,
              offset: camera.offset,
            }),
          });

          zoomPanStateRef.current = camera;
        }, HISTORY_COMMIT_DEBOUNCE_MS);
      },
    });


  useEffect(() => {
    return () => {
      if (commitCameraTimeoutRef.current) {
        clearTimeout(commitCameraTimeoutRef.current);
      }
    };
  }, []);

  const applyHistoryEntry = useMemo(() => {
    return (entry: HistoryEntry) => {
      isApplyingHistoryRef.current = true;
      try {
        applyEditsSnapshot(entry.state.edits);
        const camera = entry.state.camera;
        if (camera) {
          setCamera(camera.zoomLevel, camera.offset);
          zoomPanStateRef.current = {
            zoomLevel: camera.zoomLevel,
            offset: camera.offset,
          };
        }

        lastCommittedEditsRef.current = entry.state.edits;
      } finally {
        queueMicrotask(() => {
          isApplyingHistoryRef.current = false;
        });
      }
    };
  }, [setCamera]);

  const getDrawTransform = useMemo(() => {
    return () => {
      if (cropCommitted && cropCommit) {
        return {
          zoomLevel: 1,
          offset: cropCommit.bakedOffset,
          rotationDegrees: cropCommit.rotationDegrees,
        };
      }

      return {
        zoomLevel,
        offset,
        rotationDegrees: rotation,
      };
    };
  }, [cropCommit, cropCommitted, offset, rotation, zoomLevel]);

  const canvasPointToImagePoint = useMemo(() => {
    return (point: { x: number; y: number }): import("@/store/cropStore").Point | null => {
      if (!imageRef.current) return null;

      const { zoomLevel: drawZoom, offset: drawOffset, rotationDegrees } = getDrawTransform();

      const imageWidth = imageRef.current.width;
      const imageHeight = imageRef.current.height;

      const center = {
        x: drawOffset.x + (imageWidth * drawZoom) / 2,
        y: drawOffset.y + (imageHeight * drawZoom) / 2,
      };

      const radians = (-rotationDegrees * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);

      const dx = point.x - center.x;
      const dy = point.y - center.y;

      const unrotatedCanvasPoint = {
        x: dx * cos - dy * sin + center.x,
        y: dx * sin + dy * cos + center.y,
      };

      const x = (unrotatedCanvasPoint.x - drawOffset.x) / drawZoom;
      const y = (unrotatedCanvasPoint.y - drawOffset.y) / drawZoom;

      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      if (x < 0 || y < 0 || x > imageWidth || y > imageHeight) return null;

      return { x, y };
    };
  }, [getDrawTransform]);

  const drawZoomLevelForCursor = useMemo(() => {
    const drawZoom = cropCommitted && cropCommit ? 1 : zoomLevel;
    return drawZoom;
  }, [cropCommit, cropCommitted, zoomLevel]);

  // Reset zoom when in crop mode
  useEffect(() => {
    if (cropMode) {
      resetZoom();
    }
  }, [cropMode, resetZoom]);

  useEffect(() => {
    function handleUndoRedoKeyDown(event: KeyboardEvent) {
      const isModifierPressed = event.metaKey || event.ctrlKey;
      if (!isModifierPressed) return;

      const target = event.target;
      if (target instanceof HTMLTextAreaElement) return;
      if (target instanceof HTMLElement && target.isContentEditable) return;

      // Only ignore real text-entry inputs. Sliders (`type="range"`) should still
      // allow Cmd/Ctrl+Z.
      if (target instanceof HTMLInputElement) {
        const inputType = (target.type || "text").toLowerCase();
        const isTextEntryType =
          inputType === "text" ||
          inputType === "search" ||
          inputType === "email" ||
          inputType === "password" ||
          inputType === "tel" ||
          inputType === "url" ||
          inputType === "number" ||
          inputType === "date" ||
          inputType === "time" ||
          inputType === "datetime-local";

        if (isTextEntryType) return;
      }

      if (event.key.toLowerCase() !== "z") return;

      event.preventDefault();

      if (event.shiftKey) {
        const entry = historyRedo();
        if (entry) {
          applyHistoryEntry(entry);
        }
        return;
      }

      const entry = historyUndo();
      if (entry) {
        applyHistoryEntry(entry);
      }
    }

    document.addEventListener("keydown", handleUndoRedoKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleUndoRedoKeyDown, true);
    };
  }, [applyHistoryEntry, historyRedo, historyUndo]);

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
      isInitializingRef.current = true;

      if (commitCameraTimeoutRef.current) {
        clearTimeout(commitCameraTimeoutRef.current);
        commitCameraTimeoutRef.current = null;
      }

      imageRef.current = img;
      originalImageRef.current = img;
      useCropStore.getState?.().clearCommittedCrop?.();
      setCropMode(false);

      const initialZoomLevel = calculateInitialZoomLevel(canvasRef.current, img);
      const initialOffset = calculateInitialImageStartOffset(
        canvasRef.current,
        img,
        initialZoomLevel,
      );

      const bounds: Bounds = {
        minX: initialOffset.x,
        minY: initialOffset.y,
        maxX: initialOffset.x + img.width * initialZoomLevel,
        maxY: initialOffset.y + img.height * initialZoomLevel,
      };

      resetAll(bounds);
      useSharpeningStore.getState().resetSharpening();
      useDenoiseStore.getState().resetDenoise();

      const baselineState = createEditorSerializableState({
        edits: getImageEditorEdits(),
        zoomLevel: initialZoomLevel,
        offset: initialOffset,
      });

      resetHistoryToBaseline({
        label: "Original",
        state: baselineState,
      });

      lastCommittedEditsRef.current = baselineState.edits;
      zoomPanStateRef.current = {
        zoomLevel: baselineState.camera?.zoomLevel ?? initialZoomLevel,
        offset: baselineState.camera?.offset ?? initialOffset,
      };

      setIsImageLoaded(true);

      // We trigger a recalculation of zoomLevel and image offset by calling resetZoom
      // Otherwise the useEffect which renders the image on change on zoom level might not be called
      // the first time. Or, it is called, but the imageRef.current is still null so we render nothing
      // Once the image is loaded, we need to calculate the zoom level and image offset once more
      resetZoom();

      // ResetZoom triggers onCameraChange; ignore it during initialization.
      queueMicrotask(() => {
        isInitializingRef.current = false;
      });
    };
  }, [imageSrc, resetAll, resetHistoryToBaseline, resetZoom]);

  useEffect(() => {
    const unsubscribe = subscribeToEdits((nextEdits) => {
      if (isApplyingHistoryRef.current || isInitializingRef.current) {
        // Don’t record history while we’re programmatically applying snapshots.
        lastCommittedEditsRef.current = nextEdits;
        onEditsChange?.(nextEdits);
        return;
      }

      if (!areEditsEqual(lastCommittedEditsRef.current, nextEdits)) {
        const display = getHistoryDisplayForEditsChange(
          lastCommittedEditsRef.current,
          nextEdits,
        );

        editsPush({
          label: display.label,
          delta: display.delta,
          state: createEditorSerializableState({
            edits: nextEdits,
            zoomLevel: zoomPanStateRef.current.zoomLevel,
            offset: zoomPanStateRef.current.offset,
          }),
        });
        lastCommittedEditsRef.current = nextEdits;
      }

      onEditsChange?.(nextEdits);
    });

    return unsubscribe;
  }, [editsPush, onEditsChange]);



  function handleResetZoomClick() {
    resetZoom();
  }

  async function handleAutoStraighten() {
    if (!isImageLoaded) return;
    if (!canvasRef.current) return;

    setIsAutoStraightening(true);
    try {
      // Analyze a downscaled luminance buffer from the current canvas.
      const ctx = canvasRef.current.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const width = Math.max(1, Math.floor(canvasRef.current.width));
      const height = Math.max(1, Math.floor(canvasRef.current.height));
      const imageData = ctx.getImageData(0, 0, width, height);

      const luminance = extractLuminance(imageData.data, width, height);
      const scaled = downscaleLuminanceNearest(luminance, width, height, 320);
      const result = estimateStraightenDegreesFromLuminance(
        scaled.grays,
        scaled.width,
        scaled.height,
      );

      // Guardrails: ignore low confidence.
      if (result.confidence < 0.12) {
        return;
      }

      setRotation(result.degrees);
    } finally {
      setIsAutoStraightening(false);
    }
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
    <div className="w-full h-full flex flex-col overflow-hidden">
      <ResizablePanelGroup
        id="container-panel"
        direction="horizontal"
        className="flex flex-1 min-h-0 overflow-hidden"
      >
        <ResizablePanel defaultSize={18} className="min-h-0">
          <div className="w-full bg-gray-100 py-1 px-2 flex flex-col gap-2 h-full min-h-0 overflow-y-auto">
            <details
              className="rounded-md border bg-white"
              data-testid="history-accordion"
              open
            >
              <summary className="cursor-pointer select-none list-none px-3 py-2 text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span>History</span>
                </span>
                <span className="text-xs text-gray-500">▾</span>
              </summary>

              <div className="px-3 pb-3">
                <div data-testid="history-list" className="flex flex-col gap-1">
                  {historyEntries.length === 0 ? (
                    <div
                      data-testid="history-entry-placeholder"
                      className="text-xs text-gray-600"
                    >
                      History entries will appear here
                    </div>
                  ) : (
                    historyEntries.map((entry, idx) => (
                      <button
                        key={entry.id}
                        type="button"
                        data-testid={`history-entry-${idx}`}
                        onClick={() => {
                          isApplyingHistoryRef.current = true;

                          try {
                            const nextEntry = historyJumpTo(idx);
                            if (nextEntry) {
                              applyEditsSnapshot(nextEntry.state.edits);
                              const camera = nextEntry.state.camera;
                              if (camera) {
                                setCamera(camera.zoomLevel, camera.offset);
                              }

                              lastCommittedEditsRef.current = nextEntry.state.edits;
                              const nextCamera = nextEntry.state.camera;
                              if (nextCamera) {
                                zoomPanStateRef.current = {
                                  zoomLevel: nextCamera.zoomLevel,
                                  offset: nextCamera.offset,
                                };
                              }
                            }
                          } finally {
                            queueMicrotask(() => {
                              isApplyingHistoryRef.current = false;
                            });
                          }
                        }}
                        className={
                          idx === historyIndex
                            ? "flex items-center gap-2 rounded-sm bg-gray-900 px-2 py-1 text-left text-xs text-white"
                            : "flex items-center gap-2 rounded-sm px-2 py-1 text-left text-xs text-gray-800 hover:bg-gray-200"
                        }
                      >
                        <span className="flex-1 truncate">{entry.label}</span>
                        {entry.delta ? (
                          <span className="tabular-nums text-right min-w-[3rem]">
                            {entry.delta}
                          </span>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </details>
          </div>
        </ResizablePanel>

        <ResizableHandle className="w-[2px] bg-gray-300 mx-2" />

        <ResizablePanel
          className="flex flex-col min-h-0 overflow-hidden"
          defaultSize={57}
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
                 listeners={
                   healingModeEnabled
                     ? {
                         ...listeners,
                         onMouseDown: undefined,
                         onMouseMove: undefined,
                         onMouseUp: undefined,
                         onMouseLeave: undefined,
                         onPointerMove: (event) => {
                           if (!canvasRef.current) return;
                           const canvasPos = getMousePosInCanvas(canvasRef.current, event);
                           setHealingCursor({
                             canvas: canvasPos,
                             image: canvasPointToImagePoint(canvasPos),
                           });
                         },
                         onPointerLeave: () => {
                           setHealingCursor(null);
                         },
                         onPointerCancel: () => {
                           setHealingCursor(null);
                         },
                       }
                     : listeners
                 }
                 cursor={healingModeEnabled ? "none" : undefined}
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

               {healingModeEnabled && healingCursor ? (
                 <div
                   className="pointer-events-none absolute left-0 top-0 z-10"
                   style={{
                     transform: `translate(${healingCursor.canvas.x}px, ${healingCursor.canvas.y}px)`,
                   }}
                 >
                   <div
                     className="rounded-full border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.65)]"
                     style={{
                       width: Math.max(1, healingBrush.size * drawZoomLevelForCursor),
                       height: Math.max(1, healingBrush.size * drawZoomLevelForCursor),
                       transform: "translate(-50%, -50%)",
                     }}
                   />
                 </div>
               ) : null}
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
          <ResizablePanel defaultSize={25} className="min-h-0">
            <div className="flex h-full min-h-0 flex-col">
              <div className="w-full bg-gray-100 py-1 px-2 flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="ml-auto flex items-center gap-1">
                   <Button
                     type="button"
                     size="icon"
                     variant="outline"
                     title="Undo (⌘Z)"
                     aria-label="Undo (⌘Z)"
                     disabled={!canUndo}
                     onClick={() => {
                       const nextEntry = historyUndo();
                       if (!nextEntry) return;

                       isApplyingHistoryRef.current = true;
                       try {
                         applyEditsSnapshot(nextEntry.state.edits);
                         const camera = nextEntry.state.camera;
                         if (camera) {
                           setCamera(camera.zoomLevel, camera.offset);
                         }

                         lastCommittedEditsRef.current = nextEntry.state.edits;
                         if (camera) {
                           zoomPanStateRef.current = {
                             zoomLevel: camera.zoomLevel,
                             offset: camera.offset,
                           };
                         }
                       } finally {
                         queueMicrotask(() => {
                           isApplyingHistoryRef.current = false;
                         });
                       }
                     }}
                   >
                     ↶
                   </Button>
                   <Button
                     type="button"
                     size="icon"
                     variant="outline"
                     title="Redo (⇧⌘Z)"
                     aria-label="Redo (⇧⌘Z)"
                     disabled={!canRedo}
                     onClick={() => {
                       const nextEntry = historyRedo();
                       if (!nextEntry) return;

                       isApplyingHistoryRef.current = true;
                       try {
                         applyEditsSnapshot(nextEntry.state.edits);
                         const camera = nextEntry.state.camera;
                         if (camera) {
                           setCamera(camera.zoomLevel, camera.offset);
                         }

                         lastCommittedEditsRef.current = nextEntry.state.edits;
                         if (camera) {
                           zoomPanStateRef.current = {
                             zoomLevel: camera.zoomLevel,
                             offset: camera.offset,
                           };
                         }
                       } finally {
                         queueMicrotask(() => {
                           isApplyingHistoryRef.current = false;
                         });
                       }
                     }}
                   >
                     ↷
                   </Button>
                 </div>

                   <HealingToolButtons
                     enabled={healingModeEnabled}
                     disabled={!isImageLoaded}
                     onToggle={() => {
                       setHealingModeEnabled((prev) => {
                         const next = !prev;
                         if (next) {
                           setCropMode(false);
                         }
                         return next;
                       });
                     }}
                   />

                   <CropToolButtons
                     cropMode={cropMode}
                     setCropMode={(next) => {
                       setCropMode(next);
                       if (next) {
                         setHealingModeEnabled(false);
                       }
                     }}
                     hasAppliedCrop={cropCommitted}
                     onResetCrop={() => {

                      if (!originalImageRef.current) return;
                      imageRef.current = originalImageRef.current;
                      useCropStore.getState?.().clearCommittedCrop?.();
                      resetRotation();
                      resetZoom();
                    }}
                  />

                  <ExportTool
                    imageRef={imageRef}
                    isImageLoaded={isImageLoaded}
                    cropMode={cropMode}
                    rotation={rotation}
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

                 {healingModeEnabled ? (
                   <details className="rounded-md border bg-white" open>
                     <summary className="cursor-pointer select-none list-none px-3 py-2 text-sm font-medium flex items-center justify-between">
                       <span className="flex items-center gap-2">
                         <span>Healing</span>
                       </span>
                       <span className="text-xs text-gray-500">▾</span>
                     </summary>
                     <HealingToolPanel
                       enabled={healingModeEnabled}
                       isImageLoaded={isImageLoaded}
                     />
                   </details>
                 ) : null}

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
                  {getPanelRegistry()
                    .filter((panel) => panel.groupId === "basic")
                    .map((panel) => (
                      <panel.Component
                        key={panel.id}
                        isImageLoaded={isImageLoaded}
                        Slider={LightSlider}
                        formatSigned={formatSigned}
                        formatSignedInt={formatSignedInt}
                        setIsPickingWhiteBalance={setIsPickingWhiteBalance}
                      />
                    ))}

                </div>
              </details>

              <details className="rounded-md border bg-white" open>
                <summary className="cursor-pointer select-none list-none px-3 py-2 text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span>Transform</span>
                  </span>
                  <span className="text-xs text-gray-500">▾</span>
                </summary>

                <div className="px-3 pb-3">
                  <div className="border-t pt-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-gray-700">Straighten</div>
                    </div>

                    <div className="mt-2 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs" htmlFor="transform-rotate">
                          Rotate
                        </label>
                        <span className="text-xs font-medium tabular-nums">
                          {(cropSettings.rotation ?? 0).toFixed(1)}°
                        </span>
                      </div>

                      <DebouncedRange
                        id="transform-rotate"
                        label="Rotate"
                        value={cropSettings.rotation ?? 0}
                        defaultValue={0}
                        min={-45}
                        max={45}
                        step={0.1}
                        onValueChange={setRotation}
                        className="w-full"
                        disabled={!isImageLoaded}
                      />

                      <div className="flex justify-between gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={resetRotation}
                          disabled={!isImageLoaded}
                        >
                          Reset
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={handleAutoStraighten}
                          disabled={!isImageLoaded || isAutoStraightening}
                        >
                          {isAutoStraightening ? "Straightening…" : "Auto Straighten"}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs" htmlFor="transform-rotate-input">
                          Angle
                        </label>
                        <input
                          id="transform-rotate-input"
                          type="number"
                          min={-45}
                          max={45}
                          step={0.1}
                          value={(cropSettings.rotation ?? 0).toFixed(1)}
                          onChange={(e) => setRotation(Number(e.target.value))}
                          disabled={!isImageLoaded}
                          className="w-[84px] rounded-sm border bg-white px-2 py-1 text-xs text-gray-700"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-3 mt-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-gray-700">Perspective</div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => setPerspective({ vertical: 0, horizontal: 0, aspect: 0 })}
                        disabled={!isImageLoaded}
                      >
                        Reset
                      </Button>
                    </div>

                    <div className="mt-2 flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs" htmlFor="transform-vertical">
                            Vertical
                          </label>
                          <span className="text-xs font-medium tabular-nums">
                            {formatSignedInt(geometryOptics.perspective.vertical)}
                          </span>
                        </div>
                          <DebouncedRange
                            id="transform-vertical"
                            label="Vertical"
                            value={geometryOptics.perspective.vertical}
                            defaultValue={0}
                            min={-100}
                            max={100}
                            step={1}
                            onValueChange={(value) => setPerspective({ vertical: value })}
                            className="w-full"
                            disabled={!isImageLoaded}
                          />

                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs" htmlFor="transform-horizontal">
                            Horizontal
                          </label>
                          <span className="text-xs font-medium tabular-nums">
                            {formatSignedInt(geometryOptics.perspective.horizontal)}
                          </span>
                        </div>
                          <DebouncedRange
                            id="transform-horizontal"
                            label="Horizontal"
                            value={geometryOptics.perspective.horizontal}
                            defaultValue={0}
                            min={-100}
                            max={100}
                            step={1}
                            onValueChange={(value) => setPerspective({ horizontal: value })}
                            className="w-full"
                            disabled={!isImageLoaded}
                          />

                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs" htmlFor="transform-aspect">
                            Aspect
                          </label>
                          <span className="text-xs font-medium tabular-nums">
                            {formatSignedInt(geometryOptics.perspective.aspect ?? 0)}
                          </span>
                        </div>
                          <DebouncedRange
                            id="transform-aspect"
                            label="Aspect"
                            value={geometryOptics.perspective.aspect ?? 0}
                            defaultValue={0}
                            min={-100}
                            max={100}
                            step={1}
                            onValueChange={(value) => setPerspective({ aspect: value })}
                            className="w-full"
                            disabled={!isImageLoaded}
                          />

                      </div>

                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={cropSettings.constrainCrop ?? true}
                          onChange={(e) => setConstrainCrop(e.target.checked)}
                          disabled={!isImageLoaded}
                        />
                        Constrain crop
                      </label>
                    </div>
                  </div>

                  <div className="border-t pt-3 mt-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-gray-700">Guided Upright</div>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={guidedUprightEnabled}
                          onChange={(e) => setGuidedUprightEnabled(e.target.checked)}
                          disabled={!isImageLoaded}
                        />
                        Guided
                      </label>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => setGuidedUprightEnabled(false)}
                        disabled={!isImageLoaded || !guidedUprightEnabled}
                      >
                        Apply Guided
                      </Button>
                    </div>
                  </div>
                </div>
              </details>

               <details className="rounded-md border bg-white" open>
                 <summary className="cursor-pointer select-none list-none px-3 py-2 text-sm font-medium flex items-center justify-between">
                   <span className="flex items-center gap-2">
                     <span>Lens Corrections</span>
                   </span>
                   <span className="text-xs text-gray-500">▾</span>
                 </summary>

                 <div className="px-3 pb-3">
                   <GeometryOpticsPanel isImageLoaded={isImageLoaded} section="lens" />
                 </div>
               </details>

               <details className="rounded-md border bg-white" open>
                 <summary className="cursor-pointer select-none list-none px-3 py-2 text-sm font-medium flex items-center justify-between">
                   <span className="flex items-center gap-2">
                     <span>Optics</span>
                   </span>
                   <span className="text-xs text-gray-500">▾</span>
                 </summary>

                 <div className="px-3 pb-3">
                   <GeometryOpticsPanel isImageLoaded={isImageLoaded} section="optics" />
                 </div>
               </details>

  
                {getPanelRegistry()

                 .filter((panel) => panel.groupId !== "basic")
                 .map((panel) => (
                   <panel.Component
                     key={panel.id}
                     isImageLoaded={isImageLoaded}
                     Slider={LightSlider}
                     formatSigned={formatSigned}
                     formatSignedInt={formatSignedInt}
                     setIsPickingWhiteBalance={setIsPickingWhiteBalance}
                   />
                 ))}




              </div>
              <div className="sticky bottom-0 mt-auto border-t bg-gray-100 px-2 py-2">
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={historyIndex <= 0}
                    onClick={() => {
                      const baseline = historyJumpTo(0);
                      if (!baseline) return;

                      isApplyingHistoryRef.current = true;
                      try {
                        applyEditsSnapshot(baseline.state.edits);
                        const camera = baseline.state.camera;
                        if (camera) {
                          setCamera(camera.zoomLevel, camera.offset);
                        }

                        lastCommittedEditsRef.current = baseline.state.edits;
                        if (camera) {
                          zoomPanStateRef.current = {
                            zoomLevel: camera.zoomLevel,
                            offset: camera.offset,
                          };
                        }
                      } finally {
                        queueMicrotask(() => {
                          isApplyingHistoryRef.current = false;
                        });
                      }
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            <CropToolOptions
            cropMode={cropMode}
            imageRef={imageRef}
            zoomLevel={zoomLevel}
            offset={offset}
            rotation={rotation}
            resetAll={resetAll}
            onCropCommitted={() => {
              setIsImageLoaded(true);
              setCropMode(false);
              resetRotation();
              resetZoom();
            }}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
