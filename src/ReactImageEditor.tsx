import { useEffect, useMemo, useRef, useState } from "react";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MinusIcon,
  PlusIcon,
} from "@radix-ui/react-icons";
import { getPanelGroupElement } from "react-resizable-panels";

import { DebouncedRange } from "@/components/DebouncedRange";
import { Button } from "@/components/ui/button";
import { useThemeMode } from "@/hooks/useThemeMode";
import { useLocalStorageBoolean } from "@/hooks/useLocalStorageBoolean";
import { EditorThemeProvider } from "@/components/ui/editor-theme";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  CropToolButtons,
  CropToolOptions,
  CropToolOverlay,
} from "@/editor/CropTool";
import { EditorCanvas } from "@/editor/EditorCanvas";
import { ExportTool } from "@/editor/ExportTool";
import { HealingToolButtons, HealingToolPanel } from "@/editor/HealingTool";
import { GeometryOpticsPanel } from "@/editor/GeometryOpticsPanel";
import { DesktopEditorLayout } from "@/editor/layouts/DesktopEditorLayout";
import { MobileEditorLayout } from "@/editor/layouts/MobileEditorLayout";
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
import { useHistoryLabelStore } from "@/store/historyLabelStore";

import type { ExportFormat } from "./export-download";
import { getMousePosInCanvas } from "./dom-helpers";
import { rgbToHsl } from "./lib/color-adjustments";
import {
  estimateWhiteBalanceFromRgb,
  sampleAverageRgb,
} from "./lib/white-balance";
import type { ThemeMode } from "./lib/theme";
import {
  calculateInitialImageStartOffset,
  calculateInitialZoomLevel,
  calculatePanBounds,
  clampOffset,
  useCanvasZoomPan,
} from "./use-canvas-zoom-pan";
import { computeMobileTrayNudge } from "@/editor/mobileTrayNudge";
import type { ImageEditorEdits } from "./store/edits";
import type { Point } from "./store/cropStore";

const HISTORY_COMMIT_DEBOUNCE_MS = 250;
import {
  getImageEditorEdits,
  subscribeToEdits,
  useHistoryStore,
} from "./store";
import { useResetAll } from "./store/editorActions";
import { type Bounds, useCropStore } from "./store/cropStore";
import { selectCanRedo, selectCanUndo } from "./store/historyStore";
import { useColorStore } from "./store/colorStore";
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
const POINT_COLOR_PICKER_RADIUS = 2;

const mobileEditTabRegistry = [
  { id: "basic", label: "Basic" },
  { id: "color", label: "Color" },
  { id: "tone", label: "Tone" },
  { id: "details", label: "Details" },
  { id: "geometry", label: "Geometry" },
] as const;

const mobileBottomTabRegistry = [
  { id: "presets", label: "Presets" },
  { id: "crop", label: "Crop" },
  { id: "healing", label: "Healing" },
  { id: "edit", label: "Edit" },
  { id: "history", label: "History" },
] as const;

type MobileEditTabId = (typeof mobileEditTabRegistry)[number]["id"];
type MobileBottomTabId = (typeof mobileBottomTabRegistry)[number]["id"];

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

  const progress = useMemo(() => {
    const range = max - min;
    if (range <= 0) return 0;

    const percent = ((draftValue - min) / range) * 100;
    return Math.max(0, Math.min(100, percent));
  }, [draftValue, max, min]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-foreground" htmlFor={name}>
          {label}
        </label>
        <span className="text-xs tabular-nums text-foreground w-[52px] text-right">
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
        style={
          {
            "--range-progress": `${progress}%`,
          } as unknown as import("react").CSSProperties
        }
      />
    </div>
  );
}

// Preview canvas rendering is handled by `EditorCanvas`.

type Props = {
  imageSrc: string;
  onEditsChange?: (edits: ImageEditorEdits) => void;
  themeMode?: ThemeMode;
  themeScope?: "global" | "local";
};

export function ReactImageEditor({
  imageSrc,
  onEditsChange,
  themeMode = "dark",
  themeScope = "local",
}: Props) {
  const [cropMode, setCropMode] = useState(false);
  const [healingModeEnabled, setHealingModeEnabled] = useState(false);

  const [isHistoryPaneOpen, setIsHistoryPaneOpen] = useState(true);

  const [isHistoryAccordionOpen, setIsHistoryAccordionOpen] =
    useLocalStorageBoolean({
      key: "react-image-editor:accordion:history",
      defaultValue: false,
    });

  const [isBasicPanelOpen, setIsBasicPanelOpen] = useLocalStorageBoolean({
    key: "react-image-editor:accordion:basic",
    defaultValue: false,
  });

  const [isPresetsPanelOpen, setIsPresetsPanelOpen] = useLocalStorageBoolean({
    key: "react-image-editor:accordion:presets",
    defaultValue: false,
  });

  const [isTransformPanelOpen, setIsTransformPanelOpen] =
    useLocalStorageBoolean({
      key: "react-image-editor:accordion:transform",
      defaultValue: false,
    });

  const [isLensCorrectionsPanelOpen, setIsLensCorrectionsPanelOpen] =
    useLocalStorageBoolean({
      key: "react-image-editor:accordion:lens-corrections",
      defaultValue: false,
    });

  const [isOpticsPanelOpen, setIsOpticsPanelOpen] = useLocalStorageBoolean({
    key: "react-image-editor:accordion:optics",
    defaultValue: false,
  });

  const [isHealingPanelOpen, setIsHealingPanelOpen] = useLocalStorageBoolean({
    key: "react-image-editor:accordion:healing",
    defaultValue: false,
  });
  const healingMode = useHealingStore((state) => state.healingMode);
  const healingBrush = useHealingStore((state) => state.healingBrush);
  const cloneSource = useHealingStore((state) => state.cloneSource);
  const setCloneSource = useHealingStore((state) => state.setCloneSource);
  const addHealingOp = useHealingStore((state) => state.addHealingOp);
  const healingOps = useHealingStore((state) => state.healingOps);
  const setSpotSource = useHealingStore((state) => state.setSpotSource);
  const removeHealingOp = useHealingStore((state) => state.removeHealingOp);
  const [healingCursor, setHealingCursor] = useState<{
    canvas: { x: number; y: number };
    image: Point | null;
  } | null>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [isHoveringSpotSource, setIsHoveringSpotSource] = useState(false);
  const [isDraggingSpotSource, setIsDraggingSpotSource] = useState(false);
  const draggingSpotSourceIdRef = useRef<string | null>(null);
  const draftStrokeRef = useRef<{
    points: Point[];
  } | null>(null);
  const panRef = useRef<{
    isPanning: boolean;
    last: { x: number; y: number } | null;
  }>({
    isPanning: false,
    last: null,
  });
  const spaceDownRef = useRef(false);
  const cropCommitted = useCropStore((state) => state.cropCommitted);
  const cropCommit = useCropStore((state) => state.cropCommit);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  const isMobile = useIsMobile();
  const [activeMobileBottomTab, setActiveMobileBottomTab] =
    useState<MobileBottomTabId | null>(null);
  const [activeMobileEditTab, setActiveMobileEditTab] =
    useState<MobileEditTabId | null>(null);

  const isMobileTrayContentOpen =
    activeMobileBottomTab != null &&
    (activeMobileBottomTab !== "edit" || activeMobileEditTab != null);

  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [jpegQuality, setJpegQuality] = useState(92);
  const [isDownloading, setIsDownloading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleMobileBottomTabToggle = (tabId: MobileBottomTabId) => {
    const next = activeMobileBottomTab === tabId ? null : tabId;
    setActiveMobileBottomTab(next);

    if (tabId === "edit" && next === "edit") {
      // Opening the Edit tray should not auto-open the Basic tab.
      setActiveMobileEditTab(null);
    }

    if (tabId === "crop") {
      const isEnabled = next === "crop";
      setCropMode(isEnabled);
      if (isEnabled) {
        setHealingModeEnabled(false);
      }
      return;
    }

    if (tabId === "healing") {
      const isEnabled = next === "healing";
      setHealingModeEnabled(isEnabled);
      if (isEnabled) {
        setCropMode(false);
      }
      return;
    }

    setCropMode(false);
    setHealingModeEnabled(false);
  };

  const handleMobileEditTabToggle = (tabId: MobileEditTabId) => {
    setActiveMobileBottomTab("edit");
    setActiveMobileEditTab((current) => (current === tabId ? null : tabId));
    setCropMode(false);
    setHealingModeEnabled(false);
  };

  const [isPickingWhiteBalance, setIsPickingWhiteBalance] = useState(false);
  const [isPickingPointColor, setIsPickingPointColor] = useState(false);

  const [isAutoStraightening, setIsAutoStraightening] = useState(false);
  const [guidedUprightEnabled, setGuidedUprightEnabled] = useState(false);

  const geometryOptics = useGeometryOpticsStore((state) => state.settings);
  const setPerspective = useGeometryOpticsStore(
    (state) => state.setPerspective,
  );

  useEffect(() => {
    if (!isPickingWhiteBalance && !isPickingPointColor) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      event.preventDefault();
      setIsPickingWhiteBalance(false);
      setIsPickingPointColor(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPickingPointColor, isPickingWhiteBalance]);

  useEffect(() => {
    if (!healingModeEnabled) {
      spaceDownRef.current = false;
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== " ") return;

      event.preventDefault();
      spaceDownRef.current = true;
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key !== " ") return;

      event.preventDefault();
      spaceDownRef.current = false;
      panRef.current.isPanning = false;
      panRef.current.last = null;
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [healingModeEnabled]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);

  const mobileCanvasViewportRef = useRef<HTMLDivElement | null>(null);
  const mobileTrayRef = useRef<HTMLDivElement | null>(null);
  const mobileTrayScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileNudgeRafRef = useRef<number | null>(null);

  const isAutoCameraAdjustRef = useRef(false);
  const mobileNudgeBaseCameraRef = useRef<{
    zoomLevel: number;
    offset: { x: number; y: number };
  } | null>(null);
  const mobileNudgeLastAppliedCameraRef = useRef<{
    zoomLevel: number;
    offset: { x: number; y: number };
  } | null>(null);
  const wasMobileTrayContentOpenRef = useRef(false);

  const cropSettings = useCropStore((state) => state.cropSettings);
  const setRotation = useCropStore((state) => state.setRotation);
  const resetRotation = useCropStore((state) => state.resetRotation);
  const setConstrainCrop = useCropStore((state) => state.setConstrainCrop);

  const resetHistoryToBaseline = useHistoryStore(
    (state) => state.resetToBaseline,
  );

  const resetAll = useResetAll();

  const setWhiteBalance = useWhiteBalanceStore(
    (state) => state.setWhiteBalance,
  );

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
  const liveCameraRef = useRef({ zoomLevel: 1, offset: { x: 0, y: 0 } });
  const commitCameraTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isInitializingRef = useRef(true);
  const isApplyingHistoryRef = useRef(false);

  const {
    zoomLevel,
    offset,
    zoomIn,
    zoomOut,
    resetZoom,
    setCamera,
    listeners,
  } = useCanvasZoomPan(canvasRef, imageRef, {
    enableWheel: true,
    onCameraChange: (camera) => {
      liveCameraRef.current = camera;
      if (
        isInitializingRef.current ||
        isApplyingHistoryRef.current ||
        isAutoCameraAdjustRef.current
      ) {
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

      if (mobileNudgeRafRef.current) {
        cancelAnimationFrame(mobileNudgeRafRef.current);
        mobileNudgeRafRef.current = null;
      }
    };
  }, []);

  const isMobileTrayContentOpenRef = useRef(isMobileTrayContentOpen);
  useEffect(() => {
    isMobileTrayContentOpenRef.current = isMobileTrayContentOpen;
  }, [isMobileTrayContentOpen]);

  const applyMobileTrayNudge = useMemo(() => {
    return (reason: "tray" | "viewport") => {
      if (!isMobile) return;

      const currentCamera = liveCameraRef.current;

      if (!canvasRef.current) return;

      const viewportEl = mobileCanvasViewportRef.current;
      const trayEl = mobileTrayRef.current;
      if (!viewportEl || !trayEl) return;

      // Use client sizes (integers) to avoid subpixel jitter from getBoundingClientRect
      // that can cause the camera to drift by ~0.5-1px across open/close cycles.
      const viewportWidth = Math.max(1, viewportEl.clientWidth);
      const viewportHeight = Math.max(1, viewportEl.clientHeight);
      const trayHeight = Math.max(0, trayEl.clientHeight);

      trayEl.style.setProperty("--mobile-tray-overlap", "0px");

      // Keep backing buffer in sync with visible viewport.
      if (canvasRef.current.width !== viewportWidth) {
        canvasRef.current.width = viewportWidth;
      }
      if (canvasRef.current.height !== viewportHeight) {
        canvasRef.current.height = viewportHeight;
      }

      if (!imageRef.current) {
        return;
      }

      if (
        !Number.isFinite(currentCamera.zoomLevel) ||
        currentCamera.zoomLevel <= 0
      )
        return;

      // Clamp current camera after resize.
      const panBounds = calculatePanBounds(
        viewportWidth,
        viewportHeight,
        imageRef.current.width,
        imageRef.current.height,
        currentCamera.zoomLevel,
      );

      // When the image is smaller than the viewport, default pan bounds lock it centered.
      // For the tray nudge behavior we allow moving the image up until the top margin.
      const renderedHeight = imageRef.current.height * currentCamera.zoomLevel;
      if (renderedHeight <= viewportHeight) {
        const centerY = panBounds.minY;
        const topMargin = 20;
        panBounds.minY = Math.min(centerY, topMargin);
        panBounds.maxY = centerY;
      }

      const clamped = clampOffset(currentCamera.offset, panBounds);

      // When the tray is closed, we don't want the auto-adjust logic to subtly
      // reposition the image (it should return to the user's previous camera).
      // Still enforce clamping after resizes so the camera stays within bounds.
      if (!isMobileTrayContentOpenRef.current) {
        if (isInitializingRef.current || isApplyingHistoryRef.current) {
          zoomPanStateRef.current = {
            zoomLevel: currentCamera.zoomLevel,
            offset: clamped,
          };
          liveCameraRef.current = {
            zoomLevel: currentCamera.zoomLevel,
            offset: clamped,
          };
          return;
        }

        if (
          currentCamera.offset.x === clamped.x &&
          currentCamera.offset.y === clamped.y
        ) {
          return;
        }

        isAutoCameraAdjustRef.current = true;
        try {
          setCamera(currentCamera.zoomLevel, clamped);
        } finally {
          queueMicrotask(() => {
            isAutoCameraAdjustRef.current = false;
          });
        }
        zoomPanStateRef.current = {
          zoomLevel: currentCamera.zoomLevel,
          offset: clamped,
        };
        liveCameraRef.current = {
          zoomLevel: currentCamera.zoomLevel,
          offset: clamped,
        };
        return;
      }

      // Only nudge when it helps reveal the image above the tray.
      const nudge = computeMobileTrayNudge({
        offsetY: clamped.y,
        zoomLevel: currentCamera.zoomLevel,
        imageHeight: imageRef.current.height,
        viewportHeight,
        trayHeight,
        topMargin: 20,
      });

      const nextOffset = {
        x: clamped.x,
        y: nudge.nextOffsetY,
      };

      const nextClamped = clampOffset(nextOffset, panBounds);

      trayEl.style.setProperty("--mobile-tray-overlap", `${nudge.overlapPx}px`);

      // Apply the camera update. This will also update state used by rendering.
      // Avoid nudging while applying history or during initialization.
      if (isInitializingRef.current || isApplyingHistoryRef.current) {
        zoomPanStateRef.current = {
          zoomLevel: currentCamera.zoomLevel,
          offset: nextClamped,
        };
        liveCameraRef.current = {
          zoomLevel: currentCamera.zoomLevel,
          offset: nextClamped,
        };
        mobileNudgeLastAppliedCameraRef.current = {
          zoomLevel: currentCamera.zoomLevel,
          offset: nextClamped,
        };
        return;
      }

      // Skip redundant state updates.
      if (
        currentCamera.offset.x === nextClamped.x &&
        currentCamera.offset.y === nextClamped.y
      ) {
        return;
      }

      void reason;

      isAutoCameraAdjustRef.current = true;
      try {
        setCamera(currentCamera.zoomLevel, nextClamped);
      } finally {
        queueMicrotask(() => {
          isAutoCameraAdjustRef.current = false;
        });
      }
      zoomPanStateRef.current = {
        zoomLevel: currentCamera.zoomLevel,
        offset: nextClamped,
      };
      liveCameraRef.current = {
        zoomLevel: currentCamera.zoomLevel,
        offset: nextClamped,
      };
      mobileNudgeLastAppliedCameraRef.current = {
        zoomLevel: currentCamera.zoomLevel,
        offset: nextClamped,
      };
    };
  }, [isMobile, setCamera]);

  useEffect(() => {
    if (!isMobile) return;
    if (typeof ResizeObserver === "undefined") return;

    const viewportEl = mobileCanvasViewportRef.current;
    const trayEl = mobileTrayRef.current;
    if (!viewportEl || !trayEl) return;

    const schedule = (reason: "tray" | "viewport") => {
      if (mobileNudgeRafRef.current) {
        cancelAnimationFrame(mobileNudgeRafRef.current);
      }
      mobileNudgeRafRef.current = requestAnimationFrame(() => {
        mobileNudgeRafRef.current = null;
        applyMobileTrayNudge(reason);
      });
    };

    const viewportObserver = new ResizeObserver(() => schedule("viewport"));
    viewportObserver.observe(viewportEl);

    const trayObserver = new ResizeObserver(() => schedule("tray"));
    trayObserver.observe(trayEl);

    // Run once on mount of mobile layout.
    schedule("tray");

    return () => {
      viewportObserver.disconnect();
      trayObserver.disconnect();
      if (mobileNudgeRafRef.current) {
        cancelAnimationFrame(mobileNudgeRafRef.current);
        mobileNudgeRafRef.current = null;
      }
    };
  }, [applyMobileTrayNudge, isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    if (!isImageLoaded) return;

    if (mobileNudgeRafRef.current) {
      cancelAnimationFrame(mobileNudgeRafRef.current);
    }
    mobileNudgeRafRef.current = requestAnimationFrame(() => {
      mobileNudgeRafRef.current = null;
      applyMobileTrayNudge("tray");
    });
  }, [applyMobileTrayNudge, isImageLoaded, isMobile]);

  useEffect(() => {
    if (!isMobile) return;

    const el = mobileTrayScrollRef.current;
    if (!el) return;

    // Each mobile tray tab should start scrolled to the top.
    // Without this, switching tabs retains the prior scroll position.
    el.scrollTop = 0;
  }, [activeMobileBottomTab, activeMobileEditTab, isMobile]);

  useEffect(() => {
    if (!isMobile) return;

    const wasOpen = wasMobileTrayContentOpenRef.current;
    wasMobileTrayContentOpenRef.current = isMobileTrayContentOpen;

    if (!wasOpen && isMobileTrayContentOpen) {
      // Capture the pre-nudge camera so we can restore it when the tray content closes,
      // but only if the user hasn't manually changed the camera in the meantime.
      mobileNudgeBaseCameraRef.current = {
        zoomLevel,
        offset,
      };
      mobileNudgeLastAppliedCameraRef.current = null;
      return;
    }

    if (wasOpen && !isMobileTrayContentOpen) {
      const base = mobileNudgeBaseCameraRef.current;
      const lastApplied = mobileNudgeLastAppliedCameraRef.current;

      mobileNudgeBaseCameraRef.current = null;
      mobileNudgeLastAppliedCameraRef.current = null;

      if (!base || !lastApplied) return;

      // Only restore if the current camera still matches the last auto-applied camera.
      // If the user panned/zoomed while the tray was open, keep their camera.
      const isStillAutoApplied =
        zoomLevel === lastApplied.zoomLevel &&
        offset.x === lastApplied.offset.x &&
        offset.y === lastApplied.offset.y;

      if (!isStillAutoApplied) return;
      if (!canvasRef.current || !imageRef.current) return;

      const viewportEl = mobileCanvasViewportRef.current;
      if (!viewportEl) return;

      const viewportWidth = Math.max(1, viewportEl.clientWidth);
      const viewportHeight = Math.max(1, viewportEl.clientHeight);

      const panBounds = calculatePanBounds(
        viewportWidth,
        viewportHeight,
        imageRef.current.width,
        imageRef.current.height,
        base.zoomLevel,
      );

      const renderedHeight = imageRef.current.height * base.zoomLevel;
      if (renderedHeight <= viewportHeight) {
        const centerY = panBounds.minY;
        const topMargin = 20;
        panBounds.minY = Math.min(centerY, topMargin);
        panBounds.maxY = centerY;
      }

      const restoredOffset = clampOffset(base.offset, panBounds);

      isAutoCameraAdjustRef.current = true;
      try {
        setCamera(base.zoomLevel, restoredOffset);
      } finally {
        queueMicrotask(() => {
          isAutoCameraAdjustRef.current = false;
        });
      }

      zoomPanStateRef.current = {
        zoomLevel: base.zoomLevel,
        offset: restoredOffset,
      };
      liveCameraRef.current = {
        zoomLevel: base.zoomLevel,
        offset: restoredOffset,
      };
    }
  }, [
    activeMobileBottomTab,
    activeMobileEditTab,
    isMobile,
    isMobileTrayContentOpen,
    offset,
    setCamera,
    zoomLevel,
  ]);

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
          liveCameraRef.current = {
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
    return (point: { x: number; y: number }): Point | null => {
      if (!imageRef.current) return null;

      const {
        zoomLevel: drawZoom,
        offset: drawOffset,
        rotationDegrees,
      } = getDrawTransform();

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

  const imagePointToCanvasPoint = useMemo(() => {
    return (point: Point): { x: number; y: number } | null => {
      if (!imageRef.current) return null;

      const {
        zoomLevel: drawZoom,
        offset: drawOffset,
        rotationDegrees,
      } = getDrawTransform();

      const imageWidth = imageRef.current.width;
      const imageHeight = imageRef.current.height;

      const unrotated = {
        x: drawOffset.x + point.x * drawZoom,
        y: drawOffset.y + point.y * drawZoom,
      };

      const center = {
        x: drawOffset.x + (imageWidth * drawZoom) / 2,
        y: drawOffset.y + (imageHeight * drawZoom) / 2,
      };

      const radians = (rotationDegrees * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);

      const dx = unrotated.x - center.x;
      const dy = unrotated.y - center.y;

      return {
        x: dx * cos - dy * sin + center.x,
        y: dx * sin + dy * cos + center.y,
      };
    };
  }, [getDrawTransform]);

  const spotPins = useMemo(() => {
    if (!imageRef.current)
      return [] as Array<{
        id: string;
        centerCanvas: { x: number; y: number };
        sourceCanvas: { x: number; y: number };
      }>;

    const imageWidth = imageRef.current.width;
    const imageHeight = imageRef.current.height;

    return healingOps
      .filter((op) => op.type === "spot")
      .map((op) => {
        const centerCanvas = imagePointToCanvasPoint(op.center);
        if (!centerCanvas) return null;

        const radius = op.radius;
        const sourceImage = op.source ?? {
          x: Math.max(0, Math.min(imageWidth, op.center.x + radius * 2)),
          y: Math.max(0, Math.min(imageHeight, op.center.y)),
        };

        const sourceCanvas = imagePointToCanvasPoint(sourceImage);
        if (!sourceCanvas) return null;

        return {
          id: op.id,
          centerCanvas,
          sourceCanvas,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      centerCanvas: { x: number; y: number };
      sourceCanvas: { x: number; y: number };
    }>;
  }, [healingOps, imagePointToCanvasPoint]);

  const selectedSpotPin = useMemo(() => {
    if (!selectedSpotId) return null;
    return spotPins.find((pin) => pin.id === selectedSpotId) ?? null;
  }, [selectedSpotId, spotPins]);

  useEffect(() => {
    if (!selectedSpotId) return;

    if (!spotPins.some((pin) => pin.id === selectedSpotId)) {
      setSelectedSpotId(null);
    }
  }, [selectedSpotId, spotPins]);

  useEffect(() => {
    if (!healingModeEnabled || healingMode !== "spot") {
      draggingSpotSourceIdRef.current = null;
      setIsDraggingSpotSource(false);
      setIsHoveringSpotSource(false);
      setSelectedSpotId(null);
    }
  }, [healingMode, healingModeEnabled]);

  useEffect(() => {
    if (!healingModeEnabled) return;
    if (healingMode !== "spot") return;
    if (!selectedSpotId) return;

    const spotId = selectedSpotId;

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement) return;
      if (target instanceof HTMLElement && target.isContentEditable) return;

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

      if (event.key !== "Delete" && event.key !== "Backspace") return;

      event.preventDefault();
      removeHealingOp(spotId);
      setSelectedSpotId(null);
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [healingMode, healingModeEnabled, removeHealingOp, selectedSpotId]);

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

      const initialZoomLevel = calculateInitialZoomLevel(
        canvasRef.current,
        img,
      );
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
      liveCameraRef.current = {
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

      // Spot sample pin dragging updates the store continuously; record a single
      // history entry on drag end instead of spamming snapshots.
      if (draggingSpotSourceIdRef.current) {
        lastCommittedEditsRef.current = nextEdits;
        onEditsChange?.(nextEdits);
        return;
      }

      if (!areEditsEqual(lastCommittedEditsRef.current, nextEdits)) {
        const pendingLabel = useHistoryLabelStore
          .getState()
          .consumePendingHistoryLabel();

        const display = pendingLabel
          ? { label: pendingLabel }
          : getHistoryDisplayForEditsChange(
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

  async function handleAutoStraighten() {
    if (!isImageLoaded) return;
    if (!canvasRef.current) return;

    setIsAutoStraightening(true);
    try {
      // Analyze a downscaled luminance buffer from the current canvas.
      const ctx = canvasRef.current.getContext("2d", {
        willReadFrequently: true,
      });
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

  const { resolvedTheme } = useThemeMode({
    defaultMode: themeMode,
    persist: false,
  });

  const localThemeClass =
    themeScope === "local" && resolvedTheme === "dark" ? "dark" : "";

  const panelRegistry = getPanelRegistry();
  const basicPanels = panelRegistry.filter(
    (panel) => panel.groupId === "basic" && panel.id !== "presets",
  );
  const advancedPanels = panelRegistry.filter(
    (panel) => panel.groupId !== "basic",
  );
  const mobileBasicPanels = panelRegistry.filter((panel) =>
    ["white-balance", "light", "color"].includes(panel.id),
  );
  const mobileColorPanels = panelRegistry.filter((panel) =>
    ["color-mixer"].includes(panel.id),
  );
  const mobileToneCurvePanels = panelRegistry.filter((panel) =>
    ["tone-curve"].includes(panel.id),
  );
  const mobileDetailsPanels = panelRegistry.filter(
    (panel) => panel.id === "details",
  );
  const mobilePresetsPanels = panelRegistry.filter(
    (panel) => panel.id === "presets",
  );
  const desktopPresetsPanels = panelRegistry.filter(
    (panel) => panel.id === "presets",
  );

  const historyList = (
    <div data-testid="history-list" className="flex flex-col gap-1">
      {historyEntries.length === 0 ? (
        <div
          data-testid="history-entry-placeholder"
          className="text-xs text-muted-foreground"
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
                    liveCameraRef.current = {
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
                ? "flex items-center gap-2 rounded-sm bg-primary px-2 py-1 text-left text-xs text-primary-foreground"
                : "flex items-center gap-2 rounded-sm px-2 py-1 text-left text-xs text-foreground hover:bg-accent"
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
  );

  const historyPanel = (
    <div className="w-full bg-muted py-1 px-2 flex flex-col gap-2 h-full min-h-0 overflow-y-auto">
      <details
        className="rounded-md border bg-card"
        data-testid="history-accordion"
        open={isHistoryAccordionOpen}
        onToggle={(event) => {
          setIsHistoryAccordionOpen((event.target as HTMLDetailsElement).open);
        }}
      >
        <summary className="cursor-pointer select-none list-none px-3 py-2 text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span>History</span>
          </span>
          <span className="text-xs text-muted-foreground">▾</span>
        </summary>

        <div className="px-3 pb-3">{historyList}</div>
      </details>
    </div>
  );

  const canvasPanel = (
    <>
      <div className="flex flex-col flex-1 p-0">
        <div className="flex-1 border-2 relative">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="absolute left-2 top-2 z-20 size-11 md:size-8"
            onClick={() => {
              setIsHistoryPaneOpen((prev: boolean) => !prev);
            }}
            title={isHistoryPaneOpen ? "Hide history" : "Show history"}
            aria-label={isHistoryPaneOpen ? "Hide history" : "Show history"}
          >
            {isHistoryPaneOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </Button>
          {isPickingWhiteBalance ? (
            <div className="absolute left-2 top-2 z-10 rounded-md bg-popover/90 px-2 py-1 text-xs text-popover-foreground shadow">
              Click image to pick white balance (Esc to cancel)
            </div>
          ) : null}

          {isPickingPointColor ? (
            <div className="absolute left-2 top-10 z-10 rounded-md bg-popover/90 px-2 py-1 text-xs text-popover-foreground shadow">
              Click image to pick point color (Esc to cancel)
            </div>
          ) : null}

          <EditorCanvas
            canvasRef={canvasRef}
            imageRef={imageRef}
            zoomLevel={zoomLevel}
            offset={offset}
            rotation={rotation}
            isPickingPointColor={isPickingPointColor}
            listeners={
              healingModeEnabled
                ? {
                    ...listeners,
                    onMouseDown: undefined,
                    onMouseMove: undefined,
                    onMouseUp: undefined,
                    onMouseLeave: undefined,
                    onPointerDown: (event) => {
                      if (!canvasRef.current) return;
                      if (!healingModeEnabled) return;

                      const isPanGesture = spaceDownRef.current;
                      const isPickCloneSource =
                        healingMode === "clone" &&
                        (event.altKey || event.metaKey);

                      if (healingMode === "spot") {
                        const canvasPos = getMousePosInCanvas(
                          canvasRef.current,
                          event,
                        );

                        // Select an existing spot by clicking its target pin.
                        const hitRadius = 10;
                        for (const pin of spotPins) {
                          const dx = canvasPos.x - pin.centerCanvas.x;
                          const dy = canvasPos.y - pin.centerCanvas.y;
                          if (dx * dx + dy * dy <= hitRadius * hitRadius) {
                            event.preventDefault();
                            setSelectedSpotId(pin.id);
                            return;
                          }
                        }

                        // Drag the source pin for the selected spot.
                        if (selectedSpotPin) {
                          const dx =
                            canvasPos.x - selectedSpotPin.sourceCanvas.x;
                          const dy =
                            canvasPos.y - selectedSpotPin.sourceCanvas.y;
                          if (dx * dx + dy * dy <= hitRadius * hitRadius) {
                            event.preventDefault();
                            draggingSpotSourceIdRef.current =
                              selectedSpotPin.id;
                            setIsDraggingSpotSource(true);
                            setIsHoveringSpotSource(true);
                            (
                              event.currentTarget as HTMLElement
                            ).setPointerCapture?.(event.pointerId);
                            return;
                          }
                        }
                      }

                      const canvasPos = getMousePosInCanvas(
                        canvasRef.current,
                        event,
                      );

                      const imagePos = canvasPointToImagePoint(canvasPos);
                      if (!imagePos) return;

                      if (isPickCloneSource) {
                        event.preventDefault();
                        setCloneSource(imagePos);
                        return;
                      }

                      if (isPanGesture) {
                        panRef.current.isPanning = true;
                        panRef.current.last = canvasPos;
                        return;
                      }

                      if (healingMode === "clone" && !cloneSource) {
                        return;
                      }

                      event.preventDefault();
                      (event.currentTarget as HTMLElement).setPointerCapture?.(
                        event.pointerId,
                      );

                      draftStrokeRef.current = { points: [imagePos] };
                    },
                    onPointerMove: (event) => {
                      if (!canvasRef.current) return;

                      const canvasPos = getMousePosInCanvas(
                        canvasRef.current,
                        event,
                      );
                      const imagePos = canvasPointToImagePoint(canvasPos);
                      setHealingCursor({
                        canvas: canvasPos,
                        image: imagePos,
                      });

                      if (healingMode === "spot") {
                        if (selectedSpotPin) {
                          const hitRadius = 10;
                          const dx =
                            canvasPos.x - selectedSpotPin.sourceCanvas.x;
                          const dy =
                            canvasPos.y - selectedSpotPin.sourceCanvas.y;
                          setIsHoveringSpotSource(
                            dx * dx + dy * dy <= hitRadius * hitRadius,
                          );
                        } else {
                          setIsHoveringSpotSource(false);
                        }
                      } else if (isHoveringSpotSource) {
                        setIsHoveringSpotSource(false);
                      }

                      const draggingSpotId = draggingSpotSourceIdRef.current;
                      if (
                        healingMode === "spot" &&
                        draggingSpotId &&
                        imagePos
                      ) {
                        setSpotSource(draggingSpotId, imagePos);
                        return;
                      }

                      if (panRef.current.isPanning) {
                        const last = panRef.current.last;
                        if (!last) {
                          panRef.current.last = canvasPos;
                          return;
                        }

                        const dx = canvasPos.x - last.x;
                        const dy = canvasPos.y - last.y;
                        panRef.current.last = canvasPos;

                        setCamera(zoomLevel, {
                          x: offset.x + dx,
                          y: offset.y + dy,
                        });

                        return;
                      }

                      const draft = draftStrokeRef.current;
                      if (!draft) return;
                      if (!imagePos) return;

                      const lastPoint = draft.points[draft.points.length - 1];
                      const dx = imagePos.x - lastPoint.x;
                      const dy = imagePos.y - lastPoint.y;
                      const distSq = dx * dx + dy * dy;
                      if (distSq < 1.5 * 1.5) return;

                      draft.points.push(imagePos);
                    },
                    onPointerUp: () => {
                      const draggedSpotId = draggingSpotSourceIdRef.current;
                      draggingSpotSourceIdRef.current = null;
                      setIsDraggingSpotSource(false);
                      panRef.current.isPanning = false;
                      panRef.current.last = null;

                      if (draggedSpotId) {
                        const nextEdits = getImageEditorEdits();
                        editsPush({
                          label: "Spot Sample",
                          state: createEditorSerializableState({
                            edits: nextEdits,
                            zoomLevel: zoomPanStateRef.current.zoomLevel,
                            offset: zoomPanStateRef.current.offset,
                          }),
                        });

                        lastCommittedEditsRef.current = nextEdits;
                        onEditsChange?.(nextEdits);
                        return;
                      }

                      const draft = draftStrokeRef.current;

                      draftStrokeRef.current = null;

                      if (!draft) return;
                      if (draft.points.length === 0) return;

                      const id =
                        typeof crypto !== "undefined" && "randomUUID" in crypto
                          ? crypto.randomUUID()
                          : `${Date.now()}-${Math.random()}`;

                      if (healingMode === "spot") {
                        const center = draft.points[draft.points.length - 1];
                        const radius = healingBrush.size / 2;
                        const imageWidth = imageRef.current?.width ?? 0;
                        const imageHeight = imageRef.current?.height ?? 0;
                        const source = {
                          x: Math.max(
                            0,
                            Math.min(imageWidth, center.x + radius * 2),
                          ),
                          y: Math.max(0, Math.min(imageHeight, center.y)),
                        };

                        addHealingOp({
                          id,
                          type: "spot",
                          mode: "spot",
                          center,
                          radius,
                          feather: healingBrush.feather,
                          opacity: 255,
                          source,
                        });
                        setSelectedSpotId(id);
                        return;
                      }

                      addHealingOp({
                        id,
                        type: "stroke",
                        mode: healingMode,
                        points: draft.points,
                        radius: healingBrush.size / 2,
                        feather: healingBrush.feather,
                        opacity: 255,
                        source:
                          healingMode === "clone"
                            ? (cloneSource ?? undefined)
                            : undefined,
                      });
                    },
                    onPointerCancel: () => {
                      draggingSpotSourceIdRef.current = null;
                      setIsDraggingSpotSource(false);
                      panRef.current.isPanning = false;
                      panRef.current.last = null;
                      draftStrokeRef.current = null;
                      setHealingCursor(null);
                    },

                    onPointerLeave: () => {
                      draggingSpotSourceIdRef.current = null;
                      setIsDraggingSpotSource(false);
                      setIsHoveringSpotSource(false);
                      setHealingCursor(null);
                    },
                  }
                : listeners
            }
            cursor={
              healingModeEnabled
                ? healingMode === "spot" &&
                  selectedSpotPin &&
                  (isHoveringSpotSource || isDraggingSpotSource)
                  ? isDraggingSpotSource
                    ? "grabbing"
                    : "pointer"
                  : "none"
                : undefined
            }
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
                const sw = Math.min(
                  size,
                  Math.max(1, canvasRef.current.width - sx),
                );
                const sh = Math.min(
                  size,
                  Math.max(1, canvasRef.current.height - sy),
                );

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
                setExportError("Cannot pick colors from this image (CORS)");
              }
            }}
            isPickingWhiteBalance={isPickingWhiteBalance}
            onPickPointColor={(event) => {
              if (!isPickingPointColor) {
                return;
              }

              if (!canvasRef.current) return;

              // Cancel pick mode after a click attempt.
              setIsPickingPointColor(false);

              const ctx = canvasRef.current.getContext("2d", {
                willReadFrequently: true,
              });
              if (!ctx) return;

              try {
                const rect = canvasRef.current.getBoundingClientRect();
                const x = Math.round(event.clientX - rect.left);
                const y = Math.round(event.clientY - rect.top);

                const radius = POINT_COLOR_PICKER_RADIUS;
                const size = radius * 2 + 1;

                const sx = Math.max(0, x - radius);
                const sy = Math.max(0, y - radius);
                const sw = Math.min(
                  size,
                  Math.max(1, canvasRef.current.width - sx),
                );
                const sh = Math.min(
                  size,
                  Math.max(1, canvasRef.current.height - sy),
                );

                const imageData = ctx.getImageData(sx, sy, sw, sh);
                const avg = sampleAverageRgb(
                  imageData.data,
                  sw,
                  sh,
                  radius,
                  radius,
                  radius,
                );

                const hsl = rgbToHsl(avg.r / 255, avg.g / 255, avg.b / 255);

                useColorStore.getState().setPointColor({
                  hue: hsl.h,
                });
              } catch {
                setExportError("Cannot pick colors from this image (CORS)");
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
                className="rounded-full border border-border bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.65)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.25)]"
                style={{
                  width: Math.max(
                    1,
                    healingBrush.size * drawZoomLevelForCursor,
                  ),
                  height: Math.max(
                    1,
                    healingBrush.size * drawZoomLevelForCursor,
                  ),
                  transform: "translate(-50%, -50%)",
                }}
              />
            </div>
          ) : null}

          {healingModeEnabled && healingMode === "spot" ? (
            <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-full">
              {spotPins.map((pin) => (
                <div
                  key={pin.id}
                  className={
                    pin.id === selectedSpotId
                      ? "absolute rounded-full bg-background shadow-[0_0_0_2px_rgba(0,0,0,0.75)] dark:shadow-[0_0_0_2px_rgba(255,255,255,0.25)]"
                      : "absolute rounded-full bg-background/70 shadow-[0_0_0_2px_rgba(0,0,0,0.55)] dark:shadow-[0_0_0_2px_rgba(255,255,255,0.2)]"
                  }
                  style={{
                    left: pin.centerCanvas.x,
                    top: pin.centerCanvas.y,
                    width: 10,
                    height: 10,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              ))}

              {selectedSpotPin ? (
                <>
                  <svg
                    className="absolute left-0 top-0 h-full w-full"
                    aria-hidden="true"
                  >
                    <line
                      x1={selectedSpotPin.centerCanvas.x}
                      y1={selectedSpotPin.centerCanvas.y}
                      x2={selectedSpotPin.sourceCanvas.x}
                      y2={selectedSpotPin.sourceCanvas.y}
                      stroke="currentColor"
                      strokeWidth={3}
                      className="text-foreground/70"
                    />
                    <line
                      x1={selectedSpotPin.centerCanvas.x}
                      y1={selectedSpotPin.centerCanvas.y}
                      x2={selectedSpotPin.sourceCanvas.x}
                      y2={selectedSpotPin.sourceCanvas.y}
                      stroke="currentColor"
                      strokeWidth={1.5}
                      className="text-background/90"
                    />
                  </svg>
                  <div
                    className="absolute rounded-full bg-background shadow-[0_0_0_2px_rgba(0,0,0,0.75)] dark:shadow-[0_0_0_2px_rgba(255,255,255,0.25)]"
                    style={{
                      left: selectedSpotPin.sourceCanvas.x,
                      top: selectedSpotPin.sourceCanvas.y,
                      width: 10,
                      height: 10,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                </>
              ) : null}
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
            className="size-11 md:size-8"
            onClick={zoomOut}
            size="icon"
            variant="outline"
            title="Zoom Out"
            aria-label="Zoom out"
          >
            <MinusIcon />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="size-11 px-6 md:size-8"
            onClick={resetZoom}
            title="Reset"
          >
            {Math.round(zoomLevel * 100)}%
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="size-11 md:size-8"
            onClick={zoomIn}
            title="Zoom In"
            aria-label="Zoom in"
          >
            <PlusIcon />
          </Button>
        </div>
      </div>
    </>
  );

  const mobileCanvasPanel = (
    <>
      <div className="flex flex-col flex-1 p-0">
        <div
          ref={mobileCanvasViewportRef}
          className="flex-1 relative z-0 overflow-hidden"
        >
          {isPickingWhiteBalance ? (
            <div className="absolute left-2 top-2 z-10 rounded-md bg-popover/90 px-2 py-1 text-xs text-popover-foreground shadow">
              Click image to pick white balance (Esc to cancel)
            </div>
          ) : null}

          {isPickingPointColor ? (
            <div className="absolute left-2 top-10 z-10 rounded-md bg-popover/90 px-2 py-1 text-xs text-popover-foreground shadow">
              Click image to pick point color (Esc to cancel)
            </div>
          ) : null}

          <EditorCanvas
            canvasRef={canvasRef}
            imageRef={imageRef}
            zoomLevel={zoomLevel}
            offset={offset}
            rotation={rotation}
            isPickingPointColor={isPickingPointColor}
            listeners={
              healingModeEnabled
                ? {
                    ...listeners,
                    onMouseDown: undefined,
                    onMouseMove: undefined,
                    onMouseUp: undefined,
                    onMouseLeave: undefined,
                    onPointerDown: (event) => {
                      if (!canvasRef.current) return;
                      if (!healingModeEnabled) return;

                      const isPanGesture = spaceDownRef.current;
                      const isPickCloneSource =
                        healingMode === "clone" &&
                        (event.altKey || event.metaKey);

                      if (healingMode === "spot") {
                        const canvasPos = getMousePosInCanvas(
                          canvasRef.current,
                          event,
                        );

                        // Select an existing spot by clicking its target pin.
                        const hitRadius = 10;
                        for (const pin of spotPins) {
                          const dx = canvasPos.x - pin.centerCanvas.x;
                          const dy = canvasPos.y - pin.centerCanvas.y;
                          if (dx * dx + dy * dy <= hitRadius * hitRadius) {
                            event.preventDefault();
                            setSelectedSpotId(pin.id);
                            return;
                          }
                        }

                        // Drag the source pin for the selected spot.
                        if (selectedSpotPin) {
                          const dx =
                            canvasPos.x - selectedSpotPin.sourceCanvas.x;
                          const dy =
                            canvasPos.y - selectedSpotPin.sourceCanvas.y;
                          if (dx * dx + dy * dy <= hitRadius * hitRadius) {
                            event.preventDefault();
                            draggingSpotSourceIdRef.current =
                              selectedSpotPin.id;
                            setIsDraggingSpotSource(true);
                            setIsHoveringSpotSource(true);
                            (
                              event.currentTarget as HTMLElement
                            ).setPointerCapture?.(event.pointerId);
                            return;
                          }
                        }
                      }

                      const canvasPos = getMousePosInCanvas(
                        canvasRef.current,
                        event,
                      );

                      const imagePos = canvasPointToImagePoint(canvasPos);
                      if (!imagePos) return;

                      if (isPickCloneSource) {
                        event.preventDefault();
                        setCloneSource(imagePos);
                        return;
                      }

                      if (isPanGesture) {
                        panRef.current.isPanning = true;
                        panRef.current.last = canvasPos;
                        return;
                      }

                      if (healingMode === "clone" && !cloneSource) {
                        return;
                      }

                      event.preventDefault();
                      (event.currentTarget as HTMLElement).setPointerCapture?.(
                        event.pointerId,
                      );

                      draftStrokeRef.current = { points: [imagePos] };
                    },
                    onPointerMove: (event) => {
                      if (!canvasRef.current) return;

                      const canvasPos = getMousePosInCanvas(
                        canvasRef.current,
                        event,
                      );
                      const imagePos = canvasPointToImagePoint(canvasPos);
                      setHealingCursor({
                        canvas: canvasPos,
                        image: imagePos,
                      });

                      if (healingMode === "spot") {
                        if (selectedSpotPin) {
                          const hitRadius = 10;
                          const dx =
                            canvasPos.x - selectedSpotPin.sourceCanvas.x;
                          const dy =
                            canvasPos.y - selectedSpotPin.sourceCanvas.y;
                          setIsHoveringSpotSource(
                            dx * dx + dy * dy <= hitRadius * hitRadius,
                          );
                        } else {
                          setIsHoveringSpotSource(false);
                        }
                      } else if (isHoveringSpotSource) {
                        setIsHoveringSpotSource(false);
                      }

                      const draggingSpotId = draggingSpotSourceIdRef.current;
                      if (
                        healingMode === "spot" &&
                        draggingSpotId &&
                        imagePos
                      ) {
                        setSpotSource(draggingSpotId, imagePos);
                        return;
                      }

                      if (panRef.current.isPanning) {
                        const last = panRef.current.last;
                        if (!last) {
                          panRef.current.last = canvasPos;
                          return;
                        }

                        const dx = canvasPos.x - last.x;
                        const dy = canvasPos.y - last.y;
                        panRef.current.last = canvasPos;

                        setCamera(zoomLevel, {
                          x: offset.x + dx,
                          y: offset.y + dy,
                        });

                        return;
                      }

                      const draft = draftStrokeRef.current;
                      if (!draft) return;
                      if (!imagePos) return;

                      const lastPoint = draft.points[draft.points.length - 1];
                      const dx = imagePos.x - lastPoint.x;
                      const dy = imagePos.y - lastPoint.y;
                      const distSq = dx * dx + dy * dy;
                      if (distSq < 1.5 * 1.5) return;

                      draft.points.push(imagePos);
                    },
                    onPointerUp: () => {
                      const draggedSpotId = draggingSpotSourceIdRef.current;
                      draggingSpotSourceIdRef.current = null;
                      setIsDraggingSpotSource(false);
                      panRef.current.isPanning = false;
                      panRef.current.last = null;

                      if (draggedSpotId) {
                        const nextEdits = getImageEditorEdits();
                        editsPush({
                          label: "Spot Sample",
                          state: createEditorSerializableState({
                            edits: nextEdits,
                            zoomLevel: zoomPanStateRef.current.zoomLevel,
                            offset: zoomPanStateRef.current.offset,
                          }),
                        });

                        lastCommittedEditsRef.current = nextEdits;
                        onEditsChange?.(nextEdits);
                        return;
                      }

                      const draft = draftStrokeRef.current;

                      draftStrokeRef.current = null;

                      if (!draft) return;
                      if (draft.points.length === 0) return;

                      const id =
                        typeof crypto !== "undefined" && "randomUUID" in crypto
                          ? crypto.randomUUID()
                          : `${Date.now()}-${Math.random()}`;

                      if (healingMode === "spot") {
                        const center = draft.points[draft.points.length - 1];
                        const radius = healingBrush.size / 2;
                        const imageWidth = imageRef.current?.width ?? 0;
                        const imageHeight = imageRef.current?.height ?? 0;
                        const source = {
                          x: Math.max(
                            0,
                            Math.min(imageWidth, center.x + radius * 2),
                          ),
                          y: Math.max(0, Math.min(imageHeight, center.y)),
                        };

                        addHealingOp({
                          id,
                          type: "spot",
                          mode: "spot",
                          center,
                          radius,
                          feather: healingBrush.feather,
                          opacity: 255,
                          source,
                        });
                        setSelectedSpotId(id);
                        return;
                      }

                      addHealingOp({
                        id,
                        type: "stroke",
                        mode: healingMode,
                        points: draft.points,
                        radius: healingBrush.size / 2,
                        feather: healingBrush.feather,
                        opacity: 255,
                        source:
                          healingMode === "clone"
                            ? (cloneSource ?? undefined)
                            : undefined,
                      });
                    },
                    onPointerCancel: () => {
                      draggingSpotSourceIdRef.current = null;
                      setIsDraggingSpotSource(false);
                      panRef.current.isPanning = false;
                      panRef.current.last = null;
                      draftStrokeRef.current = null;
                      setHealingCursor(null);
                    },

                    onPointerLeave: () => {
                      draggingSpotSourceIdRef.current = null;
                      setIsDraggingSpotSource(false);
                      setIsHoveringSpotSource(false);
                      setHealingCursor(null);
                    },
                  }
                : listeners
            }
            cursor={
              healingModeEnabled
                ? healingMode === "spot" &&
                  selectedSpotPin &&
                  (isHoveringSpotSource || isDraggingSpotSource)
                  ? isDraggingSpotSource
                    ? "grabbing"
                    : "pointer"
                  : "none"
                : undefined
            }
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
                const sw = Math.min(
                  size,
                  Math.max(1, canvasRef.current.width - sx),
                );
                const sh = Math.min(
                  size,
                  Math.max(1, canvasRef.current.height - sy),
                );

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
                setExportError("Cannot pick colors from this image (CORS)");
              }
            }}
            isPickingWhiteBalance={isPickingWhiteBalance}
            onPickPointColor={(event) => {
              if (!isPickingPointColor) {
                return;
              }

              if (!canvasRef.current) return;

              // Cancel pick mode after a click attempt.
              setIsPickingPointColor(false);

              const ctx = canvasRef.current.getContext("2d", {
                willReadFrequently: true,
              });
              if (!ctx) return;

              try {
                const rect = canvasRef.current.getBoundingClientRect();
                const x = Math.round(event.clientX - rect.left);
                const y = Math.round(event.clientY - rect.top);

                const radius = POINT_COLOR_PICKER_RADIUS;
                const size = radius * 2 + 1;

                const sx = Math.max(0, x - radius);
                const sy = Math.max(0, y - radius);
                const sw = Math.min(
                  size,
                  Math.max(1, canvasRef.current.width - sx),
                );
                const sh = Math.min(
                  size,
                  Math.max(1, canvasRef.current.height - sy),
                );

                const imageData = ctx.getImageData(sx, sy, sw, sh);
                const avg = sampleAverageRgb(
                  imageData.data,
                  sw,
                  sh,
                  radius,
                  radius,
                  radius,
                );

                const hsl = rgbToHsl(avg.r / 255, avg.g / 255, avg.b / 255);

                useColorStore.getState().setPointColor({
                  hue: hsl.h,
                });
              } catch {
                setExportError("Cannot pick colors from this image (CORS)");
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
                className="rounded-full border border-border bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.65)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.25)]"
                style={{
                  width: Math.max(
                    1,
                    healingBrush.size * drawZoomLevelForCursor,
                  ),
                  height: Math.max(
                    1,
                    healingBrush.size * drawZoomLevelForCursor,
                  ),
                  transform: "translate(-50%, -50%)",
                }}
              />
            </div>
          ) : null}

          {healingModeEnabled && healingMode === "spot" ? (
            <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-full">
              {spotPins.map((pin) => (
                <div
                  key={pin.id}
                  className={
                    pin.id === selectedSpotId
                      ? "absolute rounded-full bg-background shadow-[0_0_0_2px_rgba(0,0,0,0.75)] dark:shadow-[0_0_0_2px_rgba(255,255,255,0.25)]"
                      : "absolute rounded-full bg-background/70 shadow-[0_0_0_2px_rgba(0,0,0,0.55)] dark:shadow-[0_0_0_2px_rgba(255,255,255,0.2)]"
                  }
                  style={{
                    left: pin.centerCanvas.x,
                    top: pin.centerCanvas.y,
                    width: 10,
                    height: 10,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              ))}

              {selectedSpotPin ? (
                <>
                  <svg
                    className="absolute left-0 top-0 h-full w-full"
                    aria-hidden="true"
                  >
                    <line
                      x1={selectedSpotPin.centerCanvas.x}
                      y1={selectedSpotPin.centerCanvas.y}
                      x2={selectedSpotPin.sourceCanvas.x}
                      y2={selectedSpotPin.sourceCanvas.y}
                      stroke="currentColor"
                      strokeWidth={3}
                      className="text-foreground/70"
                    />
                    <line
                      x1={selectedSpotPin.centerCanvas.x}
                      y1={selectedSpotPin.centerCanvas.y}
                      x2={selectedSpotPin.sourceCanvas.x}
                      y2={selectedSpotPin.sourceCanvas.y}
                      stroke="currentColor"
                      strokeWidth={1.5}
                      className="text-background/90"
                    />
                  </svg>
                  <div
                    className="absolute rounded-full bg-background shadow-[0_0_0_2px_rgba(0,0,0,0.75)] dark:shadow-[0_0_0_2px_rgba(255,255,255,0.25)]"
                    style={{
                      left: selectedSpotPin.sourceCanvas.x,
                      top: selectedSpotPin.sourceCanvas.y,
                      width: 10,
                      height: 10,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                </>
              ) : null}
            </div>
          ) : null}

          <CropToolOverlay
            cropMode={cropMode}
            imageRef={imageRef}
            cropBounds={cropBounds}
          />
        </div>
      </div>
    </>
  );

  const controlsPanel = (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="w-full bg-muted py-1 px-2 flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
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
                      liveCameraRef.current = {
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
                      liveCameraRef.current = {
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
            <details
              className="rounded-md border bg-card"
              open={isHealingPanelOpen}
              onToggle={(event) => {
                setIsHealingPanelOpen(
                  (event.target as HTMLDetailsElement).open,
                );
              }}
            >
              <summary className="cursor-pointer select-none list-none px-3 py-2 text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span>Healing</span>
                </span>
                <span className="text-xs text-muted-foreground">▾</span>
              </summary>
              <HealingToolPanel
                enabled={healingModeEnabled}
                isImageLoaded={isImageLoaded}
              />
            </details>
          ) : null}

          <details
            className="rounded-md border bg-card"
            open={isBasicPanelOpen}
            onToggle={(event) => {
              setIsBasicPanelOpen((event.target as HTMLDetailsElement).open);
            }}
          >
            <summary className="cursor-pointer select-none list-none px-3 py-2 text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>Basic</span>
              </span>
              <span className="text-xs text-muted-foreground">▾</span>
            </summary>

            <div className="px-3 pb-3">
              <div className="flex items-center justify-between py-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={!isImageLoaded}
                  >
                    Auto
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={!isImageLoaded}
                  >
                    B&W
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={!isImageLoaded}
                  >
                    HDR
                  </Button>
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-foreground">
                    Profile
                  </div>
                  <div className="text-xs text-muted-foreground">▾</div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">Profile:</div>
                  <input
                    type="text"
                    disabled
                    value=""
                    className="w-[140px] rounded-sm border bg-muted px-2 py-1 text-xs text-muted-foreground"
                    aria-label="Profile"
                  />
                </div>
              </div>
              {basicPanels.map((panel) => (
                <panel.Component
                  key={panel.id}
                  isImageLoaded={isImageLoaded}
                  Slider={LightSlider}
                  formatSigned={formatSigned}
                  formatSignedInt={formatSignedInt}
                  setIsPickingWhiteBalance={setIsPickingWhiteBalance}
                  setIsPickingPointColor={setIsPickingPointColor}
                />
              ))}
            </div>
          </details>

          <details
            className="rounded-md border bg-card"
            open={isPresetsPanelOpen}
            onToggle={(event) => {
              setIsPresetsPanelOpen((event.target as HTMLDetailsElement).open);
            }}
          >
            <summary className="cursor-pointer select-none list-none px-3 py-2 text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>Presets</span>
              </span>
              <span className="text-xs text-muted-foreground">▾</span>
            </summary>

            <div className="px-3 pb-3">
              {desktopPresetsPanels.map((panel) => (
                <panel.Component
                  key={panel.id}
                  isImageLoaded={isImageLoaded}
                  Slider={LightSlider}
                  formatSigned={formatSigned}
                  formatSignedInt={formatSignedInt}
                  setIsPickingWhiteBalance={setIsPickingWhiteBalance}
                  setIsPickingPointColor={setIsPickingPointColor}
                  panelVariant="accordion"
                />
              ))}
            </div>
          </details>

          <details
            className="rounded-md border bg-card"
            open={isTransformPanelOpen}
            onToggle={(event) => {
              setIsTransformPanelOpen(
                (event.target as HTMLDetailsElement).open,
              );
            }}
          >
            <summary className="cursor-pointer select-none list-none px-3 py-2 text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>Transform</span>
              </span>
              <span className="text-xs text-muted-foreground">▾</span>
            </summary>

            <div className="px-3 pb-3">
              <div className="border-t pt-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-foreground">
                    Straighten
                  </div>
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
                      {isAutoStraightening
                        ? "Straightening…"
                        : "Auto Straighten"}
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
                      className="w-[84px] rounded-sm border bg-background px-2 py-1 text-xs text-foreground"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-3 mt-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-foreground">
                    Perspective
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() =>
                      setPerspective({
                        vertical: 0,
                        horizontal: 0,
                        aspect: 0,
                      })
                    }
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
                      onValueChange={(value) =>
                        setPerspective({ vertical: value })
                      }
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
                      onValueChange={(value) =>
                        setPerspective({ horizontal: value })
                      }
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
                        {formatSignedInt(
                          geometryOptics.perspective.aspect ?? 0,
                        )}
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
                      onValueChange={(value) =>
                        setPerspective({ aspect: value })
                      }
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
                  <div className="text-xs font-medium text-foreground">
                    Guided Upright
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={guidedUprightEnabled}
                      onChange={(e) =>
                        setGuidedUprightEnabled(e.target.checked)
                      }
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

          <details
            className="rounded-md border bg-card"
            open={isLensCorrectionsPanelOpen}
            onToggle={(event) => {
              setIsLensCorrectionsPanelOpen(
                (event.target as HTMLDetailsElement).open,
              );
            }}
          >
            <summary className="cursor-pointer select-none list-none px-3 py-2 text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>Lens Corrections</span>
              </span>
              <span className="text-xs text-muted-foreground">▾</span>
            </summary>

            <div className="px-3 pb-3">
              <GeometryOpticsPanel
                isImageLoaded={isImageLoaded}
                section="lens"
              />
            </div>
          </details>

          <details
            className="rounded-md border bg-card"
            open={isOpticsPanelOpen}
            onToggle={(event) => {
              setIsOpticsPanelOpen((event.target as HTMLDetailsElement).open);
            }}
          >
            <summary className="cursor-pointer select-none list-none px-3 py-2 text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>Optics</span>
              </span>
              <span className="text-xs text-muted-foreground">▾</span>
            </summary>

            <div className="px-3 pb-3">
              <GeometryOpticsPanel
                isImageLoaded={isImageLoaded}
                section="optics"
              />
            </div>
          </details>

          {advancedPanels.map((panel) => (
            <panel.Component
              key={panel.id}
              isImageLoaded={isImageLoaded}
              Slider={LightSlider}
              formatSigned={formatSigned}
              formatSignedInt={formatSignedInt}
              setIsPickingWhiteBalance={setIsPickingWhiteBalance}
              setIsPickingPointColor={setIsPickingPointColor}
            />
          ))}
        </div>
        <div className="sticky bottom-0 mt-auto border-t bg-muted px-2 py-2">
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
                    liveCameraRef.current = {
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
    </>
  );

  const mobileToolbar = (
    <div className="flex items-center gap-2 border-b bg-muted px-3 py-2">
      <div className="flex flex-1 min-w-0 items-center gap-2 overflow-x-auto pb-1">
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-11 shrink-0"
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
                    liveCameraRef.current = {
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
            className="size-11 shrink-0"
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

        <ExportTool
          imageRef={imageRef}
          isImageLoaded={isImageLoaded}
          cropMode={cropMode}
          rotation={rotation}
          buttonSize="lg"
          buttonClassName="h-11 px-4 shrink-0"
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
    </div>
  );

  const mobileTrayPanel = (
    <div
      ref={mobileTrayRef}
      className="mobile-tray-panel relative flex flex-col gap-3 pb-3 pt-0"
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 rounded-none"
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(to bottom, hsl(var(--muted) / 0.55) 0px, hsl(var(--muted) / 0.92) var(--mobile-tray-overlap), hsl(var(--muted) / 0.98) 100%)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      />

      <div className="h-px w-full bg-border/20" aria-hidden="true" />

      {activeMobileBottomTab &&
      (activeMobileBottomTab !== "edit" || activeMobileEditTab) ? (
        <div
          ref={mobileTrayScrollRef}
          data-testid="mobile-tray-scroll"
          className="relative max-h-[clamp(160px,34svh,200px)] overflow-y-auto rounded-none border-x-0 border-b-0 border-t bg-card/90 px-3 pt-5 pb-3 backdrop-blur-sm"
        >
          {activeMobileBottomTab === "edit" && activeMobileEditTab === "basic"
            ? mobileBasicPanels.map((panel) => (
                <panel.Component
                  key={panel.id}
                  isImageLoaded={isImageLoaded}
                  Slider={LightSlider}
                  formatSigned={formatSigned}
                  formatSignedInt={formatSignedInt}
                  setIsPickingWhiteBalance={setIsPickingWhiteBalance}
                  setIsPickingPointColor={setIsPickingPointColor}
                />
              ))
            : null}

          {activeMobileBottomTab === "edit" && activeMobileEditTab === "color"
            ? mobileColorPanels.map((panel) => (
                <panel.Component
                  key={panel.id}
                  isImageLoaded={isImageLoaded}
                  Slider={LightSlider}
                  formatSigned={formatSigned}
                  formatSignedInt={formatSignedInt}
                  setIsPickingWhiteBalance={setIsPickingWhiteBalance}
                  setIsPickingPointColor={setIsPickingPointColor}
                  panelVariant="flat"
                />
              ))
            : null}

          {activeMobileBottomTab === "edit" && activeMobileEditTab === "tone"
            ? mobileToneCurvePanels.map((panel) => (
                <panel.Component
                  key={panel.id}
                  isImageLoaded={isImageLoaded}
                  Slider={LightSlider}
                  formatSigned={formatSigned}
                  formatSignedInt={formatSignedInt}
                  setIsPickingWhiteBalance={setIsPickingWhiteBalance}
                  setIsPickingPointColor={setIsPickingPointColor}
                  panelVariant="flat"
                />
              ))
            : null}

          {activeMobileBottomTab === "edit" && activeMobileEditTab === "details"
            ? mobileDetailsPanels.map((panel) => (
                <panel.Component
                  key={panel.id}
                  isImageLoaded={isImageLoaded}
                  Slider={LightSlider}
                  formatSigned={formatSigned}
                  formatSignedInt={formatSignedInt}
                  setIsPickingWhiteBalance={setIsPickingWhiteBalance}
                  setIsPickingPointColor={setIsPickingPointColor}
                  panelVariant="flat"
                />
              ))
            : null}

          {activeMobileBottomTab === "edit" &&
          activeMobileEditTab === "geometry" ? (
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-xs font-medium text-foreground">
                  Straighten
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label
                      className="text-xs"
                      htmlFor="mobile-transform-rotate"
                    >
                      Rotate
                    </label>
                    <span className="text-xs font-medium tabular-nums">
                      {(cropSettings.rotation ?? 0).toFixed(1)}°
                    </span>
                  </div>

                  <DebouncedRange
                    id="mobile-transform-rotate"
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

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      onClick={resetRotation}
                      disabled={!isImageLoaded}
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      onClick={handleAutoStraighten}
                      disabled={!isImageLoaded || isAutoStraightening}
                    >
                      {isAutoStraightening
                        ? "Straightening…"
                        : "Auto Straighten"}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <label
                      className="text-xs"
                      htmlFor="mobile-transform-rotate-input"
                    >
                      Angle
                    </label>
                    <input
                      id="mobile-transform-rotate-input"
                      type="number"
                      min={-45}
                      max={45}
                      step={0.1}
                      value={(cropSettings.rotation ?? 0).toFixed(1)}
                      onChange={(e) => setRotation(Number(e.target.value))}
                      disabled={!isImageLoaded}
                      className="w-[84px] rounded-sm border bg-background px-2 py-1 text-xs text-foreground"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-foreground">
                    Perspective
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs"
                    onClick={() =>
                      setPerspective({
                        vertical: 0,
                        horizontal: 0,
                        aspect: 0,
                      })
                    }
                    disabled={!isImageLoaded}
                  >
                    Reset
                  </Button>
                </div>

                <div className="mt-3 flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label
                        className="text-xs"
                        htmlFor="mobile-transform-vertical"
                      >
                        Vertical
                      </label>
                      <span className="text-xs font-medium tabular-nums">
                        {formatSignedInt(geometryOptics.perspective.vertical)}
                      </span>
                    </div>
                    <DebouncedRange
                      id="mobile-transform-vertical"
                      label="Vertical"
                      value={geometryOptics.perspective.vertical}
                      defaultValue={0}
                      min={-100}
                      max={100}
                      step={1}
                      onValueChange={(value) =>
                        setPerspective({ vertical: value })
                      }
                      className="w-full"
                      disabled={!isImageLoaded}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label
                        className="text-xs"
                        htmlFor="mobile-transform-horizontal"
                      >
                        Horizontal
                      </label>
                      <span className="text-xs font-medium tabular-nums">
                        {formatSignedInt(geometryOptics.perspective.horizontal)}
                      </span>
                    </div>
                    <DebouncedRange
                      id="mobile-transform-horizontal"
                      label="Horizontal"
                      value={geometryOptics.perspective.horizontal}
                      defaultValue={0}
                      min={-100}
                      max={100}
                      step={1}
                      onValueChange={(value) =>
                        setPerspective({ horizontal: value })
                      }
                      className="w-full"
                      disabled={!isImageLoaded}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label
                        className="text-xs"
                        htmlFor="mobile-transform-aspect"
                      >
                        Aspect
                      </label>
                      <span className="text-xs font-medium tabular-nums">
                        {formatSignedInt(
                          geometryOptics.perspective.aspect ?? 0,
                        )}
                      </span>
                    </div>
                    <DebouncedRange
                      id="mobile-transform-aspect"
                      label="Aspect"
                      value={geometryOptics.perspective.aspect ?? 0}
                      defaultValue={0}
                      min={-100}
                      max={100}
                      step={1}
                      onValueChange={(value) =>
                        setPerspective({ aspect: value })
                      }
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

              <div className="border-t pt-3">
                <div className="text-xs font-medium text-foreground">
                  Guided Upright
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={guidedUprightEnabled}
                      onChange={(e) =>
                        setGuidedUprightEnabled(e.target.checked)
                      }
                      disabled={!isImageLoaded}
                    />
                    Guided
                  </label>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs"
                    onClick={() => setGuidedUprightEnabled(false)}
                    disabled={!isImageLoaded || !guidedUprightEnabled}
                  >
                    Apply Guided
                  </Button>
                </div>
              </div>

              <div className="border-t pt-3">
                <GeometryOpticsPanel
                  isImageLoaded={isImageLoaded}
                  section="lens"
                />
              </div>

              <div className="border-t pt-3">
                <GeometryOpticsPanel
                  isImageLoaded={isImageLoaded}
                  section="optics"
                />
              </div>
            </div>
          ) : null}

          {activeMobileBottomTab === "presets"
            ? mobilePresetsPanels.map((panel) => (
                <panel.Component
                  key={panel.id}
                  isImageLoaded={isImageLoaded}
                  Slider={LightSlider}
                  formatSigned={formatSigned}
                  formatSignedInt={formatSignedInt}
                  setIsPickingWhiteBalance={setIsPickingWhiteBalance}
                  setIsPickingPointColor={setIsPickingPointColor}
                />
              ))
            : null}

          {activeMobileBottomTab === "history" ? (
            <>
              <div className="text-xs font-medium text-foreground">History</div>
              {historyList}
            </>
          ) : null}

          {activeMobileBottomTab === "healing" ? (
            <HealingToolPanel
              enabled={healingModeEnabled}
              isImageLoaded={isImageLoaded}
            />
          ) : null}

          {activeMobileBottomTab === "crop" ? (
            <div className="relative z-10">
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
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col">
        {activeMobileBottomTab === "edit" ? (
          <div className="flex items-center gap-2 overflow-x-auto px-3 py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {mobileEditTabRegistry.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                size="sm"
                variant={activeMobileEditTab === tab.id ? "default" : "outline"}
                className="h-9 px-4 text-xs shrink-0 shadow-none"
                onClick={() => handleMobileEditTabToggle(tab.id)}
                aria-pressed={activeMobileEditTab === tab.id}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        ) : null}

        {activeMobileBottomTab === "edit" ? (
          <div className="my-0.5 h-px w-full bg-border/20" aria-hidden="true" />
        ) : null}

        <div className="flex items-center gap-2 overflow-x-auto px-3 py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {mobileBottomTabRegistry.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              size="sm"
              variant={activeMobileBottomTab === tab.id ? "default" : "outline"}
              className="h-9 px-4 text-xs shrink-0 shadow-none"
              onClick={() => handleMobileBottomTabToggle(tab.id)}
              aria-pressed={activeMobileBottomTab === tab.id}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div
      data-testid="react-image-editor"
      className={`react-image-editor w-full h-full flex flex-col overflow-hidden ${localThemeClass}`}
    >
      <EditorThemeProvider resolvedTheme={resolvedTheme}>
        {isMobile ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="relative">{mobileToolbar}</div>
            <MobileEditorLayout
              canvasPanel={mobileCanvasPanel}
              trayPanel={mobileTrayPanel}
            />
          </div>
        ) : (
          <DesktopEditorLayout
            historyPanel={historyPanel}
            canvasPanel={canvasPanel}
            controlsPanel={controlsPanel}
            isHistoryPaneOpen={isHistoryPaneOpen}
            onCanvasResize={handleImagePanelResize}
          />
        )}
      </EditorThemeProvider>
    </div>
  );
}
