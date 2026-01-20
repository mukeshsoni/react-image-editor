import {
  Fragment,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Muted } from "@/components/ui/typography";
import { Separator } from "@/components/ui/separator";
import { DebouncedRange } from "@/components/DebouncedRange";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LockOpen1Icon, LockClosedIcon } from "@radix-ui/react-icons";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectGroup,
  SelectSeparator,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { handles, type Handle } from "./crop-handles";
import {
  useCropStore,
  type CropRect,
  type Bounds,
  type Point,
} from "./store/cropStore";

type CropperProps = {
  cropBounds: Bounds;
  onChange?: (cropRect: CropRect) => void;
};
export function Cropper({ cropBounds, onChange }: CropperProps) {
  const { cropRect, initializeCropRect, moveCropRect, resizeCropRect } =
    useCropStore();
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragType, setDragType] = useState<"move" | "resize" | null>(null);
  const [activeHandle, setActiveHandle] = useState<Handle | null>(null);

  // Initialize cropRect when component mounts or bounds change
  useEffect(() => {
    initializeCropRect(cropBounds);
  }, [cropBounds, initializeCropRect]);

  // We check where in the box is the user clicked down on
  // If it's on a handle, we set the active handle and start resizing
  // If it's on the box, we start moving
  const [activePointerId, setActivePointerId] = useState<number | null>(null);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;

      const rect = event.currentTarget.getBoundingClientRect();
      // clientX and clientY for the event will give us coordinates with respect to the whole viewport
      // We need coordinates within our box
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      setIsDragging(true);
      setDragStart({ x, y });

      const hitPoint = { x, y };

      for (const handle of handles) {
        const handleRect = getHandleRect(handle, cropRect);
        if (isPointInRect(hitPoint, handleRect)) {
          setDragType("resize");
          setActiveHandle(handle);
          setActivePointerId(event.pointerId);
          event.currentTarget.setPointerCapture(event.pointerId);
          event.preventDefault();
          return;
        }
      }

      // Check if clicking inside crop area
      if (isPointInRect(hitPoint, cropRect)) {
        setDragType("move");
        setActiveHandle(null);
        setActivePointerId(event.pointerId);
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      }
    },
    [cropRect],
  );

  const handlePointerUp = useCallback(
    (event?: PointerEvent<HTMLDivElement>) => {
      setIsDragging(false);
      setDragStart(null);
      setDragType(null);
      setActiveHandle(null);
      if (event && activePointerId != null) {
        try {
          event.currentTarget.releasePointerCapture(activePointerId);
        } catch {
          // Ignore if pointer capture is not held.
        }
      }
      setActivePointerId(null);
    },
    [activePointerId],
  );
  useEffect(() => {
    onChange?.(cropRect);
  }, [cropRect, onChange]);

  const handlePointerMove = useMemo(
    () => (event: PointerEvent<HTMLDivElement>) => {
      // If not dragging or no drag start, return
      if (!isDragging || !dragStart) {
        return;
      }

      if (activePointerId != null && event.pointerId !== activePointerId) {
        return;
      }

      // Find coordinates of mouse relative to the crop area
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      if (dragType == "move") {
        moveCropRect({ x, y }, dragStart);
      } else if (dragType == "resize" && activeHandle) {
        resizeCropRect({ x, y }, dragStart, activeHandle);
        // The AI generated code didn't reset the dragstart which led to
        // we finding a delta always with respect to the start point and the delta grew exponentially with each
        // mouse movement
      }
      setDragStart({ x, y });
    },
    [
      isDragging,
      dragStart,
      activePointerId,
      activeHandle,
      dragType,
      moveCropRect,
      resizeCropRect,
    ],
  );

  return (
    <div
      className="absolute inset-0"
      style={{ cursor: getCursor(dragType, activeHandle) }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerUp}
    >
      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Clear crop region */}
      <div
        data-testid="crop-region"
        className="absolute border-2 border-primary/80"
        style={{
          left: cropRect.x,
          top: cropRect.y,
          width: cropRect.width,
          height: cropRect.height,
          // cursor: dragType === "move" ? "move" : "default",
        }}
      />

      {/* Handles */}
      <DragHandle position="top-left" cropRect={cropRect} />
      <DragHandle position="top" cropRect={cropRect} />
      <DragHandle position="top-right" cropRect={cropRect} />
      <DragHandle position="left" cropRect={cropRect} />
      <DragHandle position="right" cropRect={cropRect} />
      <DragHandle position="bottom-left" cropRect={cropRect} />
      <DragHandle position="bottom" cropRect={cropRect} />
      <DragHandle position="bottom-right" cropRect={cropRect} />
    </div>
  );
}

const HANDLE_SIZE = 10;

// Helper functions
function DragHandle({
  position,
  cropRect,
}: {
  position: string;
  cropRect: CropRect;
}) {
  const handleRect = getHandleRect(position, cropRect);
  return (
    <div
      data-testid={`crop-handle-${position}`}
      aria-hidden="true"
      className="absolute bg-background border border-border"
      style={{
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        left: handleRect.x,
        top: handleRect.y,
        cursor: getHandleCursor(position),
      }}
    />
  );
}

function getHandleRect(position: string, cropRect: CropRect): CropRect {
  const { x, y, width, height } = cropRect;
  switch (position) {
    case "top-left":
      return {
        x: x - HANDLE_SIZE / 2,
        y: y - HANDLE_SIZE / 2,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
      };
    case "top":
      return {
        x: x + width / 2 - HANDLE_SIZE / 2,
        y: y - HANDLE_SIZE / 2,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
      };
    case "top-right":
      return {
        x: x + width - HANDLE_SIZE / 2,
        y: y - HANDLE_SIZE / 2,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
      };
    case "left":
      return {
        x: x - HANDLE_SIZE / 2,
        y: y + height / 2 - HANDLE_SIZE / 2,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
      };
    case "right":
      return {
        x: x + width - HANDLE_SIZE / 2,
        y: y + height / 2 - HANDLE_SIZE / 2,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
      };
    case "bottom-left":
      return {
        x: x - HANDLE_SIZE / 2,
        y: y + height - HANDLE_SIZE / 2,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
      };
    case "bottom":
      return {
        x: x + width / 2 - HANDLE_SIZE / 2,
        y: y + height - HANDLE_SIZE / 2,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
      };
    case "bottom-right":
      return {
        x: x + width - HANDLE_SIZE / 2,
        y: y + height - HANDLE_SIZE / 2,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
      };
    default:
      return { x: 0, y: 0, width: 0, height: 0 };
  }
}

function getCursor(dragType: string | null, handle: string | null): string {
  if (dragType === "move") return "move";
  if (handle) return getHandleCursor(handle);
  return "default";
}

function getHandleCursor(position: string): string {
  switch (position) {
    case "top-left":
    case "bottom-right":
      return "nw-resize";
    case "top-right":
    case "bottom-left":
      return "ne-resize";
    case "top":
    case "bottom":
      return "ns-resize";
    case "left":
    case "right":
      return "ew-resize";
    default:
      return "default";
  }
}

function isPointInRect(point: Point, rect: CropRect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function CropOptions({
  onReset,
  onApply,
}: {
  onReset: () => void;
  onApply: (cropRect: CropRect) => void | Promise<void>;
}) {
  const {
    cropRect,
    cropSettings,
    updateCropSettings,
    resetCropSettings,
    setRotation,
    resetRotation,
    setConstrainCrop,
  } = useCropStore();
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");

  const aspectRatioOptions = [
    {
      label: "1",
      items: [
        {
          label: "Original",
          value: "original",
        },
        {
          label: "Custom",
          value: "custom",
        },
      ],
    },
    {
      label: "Vertical crops",
      items: [
        {
          label: "1x1",
          value: "1x1",
        },
        {
          label: "4x5/8x10",
          value: "4x5",
        },
        {
          label: "8.5x11",
          value: "8.5x11",
        },
        {
          label: "5x7",
          value: "5x7",
        },
        {
          label: "2x3/4x6",
          value: "2x3",
        },
      ],
    },
    {
      label: "Horizontal crops",
      items: [
        {
          label: "4x3",
          value: "4x3",
        },
        {
          label: "16x9",
          value: "16x9",
        },
        {
          label: "16x10",
          value: "16x10",
        },
      ],
    },
  ];
  function handleAspectRatioOptionChange(value: string) {
    switch (value) {
      case "original":
        updateCropSettings({
          aspectRatio: "original",
          customAspectRatio: undefined,
        });
        break;
      case "custom":
        setShowCustomDialog(true);
        break;
      case "1x1":
      case "4x5":
      case "8.5x11":
      case "5x7":
      case "2x3":
      case "4x3":
      case "16x9":
      case "16x10": {
        updateCropSettings({ aspectRatio: value });
        break;
      }
      default:
        // Handle predefined aspect ratios
        if (value.toLowerCase().startsWith("custom")) {
          setShowCustomDialog(true);
        }
        break;
    }
  }
  function handleAspectRatioLockClick() {
    updateCropSettings({ aspectRatioLocked: !cropSettings.aspectRatioLocked });
  }
  function handleResetClick() {
    onReset();
    resetCropSettings();
  }
  function handleApplyClick() {
    onApply(cropRect);
  }

  function handleCustomAspectRatioSubmit() {
    const width = parseFloat(customWidth);
    const height = parseFloat(customHeight);

    if (width > 0 && height > 0) {
      const customRatio = `${width}x${height}`;
      updateCropSettings({
        aspectRatio: "custom",
        customAspectRatio: customRatio,
      });
      setShowCustomDialog(false);
      setCustomWidth("");
      setCustomHeight("");
    }
  }

  function handleCustomDialogCancel() {
    setShowCustomDialog(false);
    setCustomWidth("");
    setCustomHeight("");
  }

  // Get display value for the select
  function getAspectRatioDisplayValue() {
    if (
      cropSettings.aspectRatio === "custom" &&
      cropSettings.customAspectRatio
    ) {
      return `Custom (${cropSettings.customAspectRatio})`;
    }

    if (cropSettings.aspectRatio === "original") {
      return "Original";
    }

    return cropSettings.aspectRatio;
  }

  return (
    <div>
      <div className="flex justify-between">
        <Muted>Tool:</Muted>
        <Muted>Crop and straighten</Muted>
      </div>
      <Separator className="my-2" />

      <div className="flex items-center gap-2">
        <label className="text-xs">Aspect Ratio</label>
        <Select
          onValueChange={handleAspectRatioOptionChange}
          value={cropSettings.aspectRatio}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select aspect ratio">
              {getAspectRatioDisplayValue()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {aspectRatioOptions.map((group, index) => {
              if (index < aspectRatioOptions.length - 1) {
                return (
                  <Fragment key={group.label}>
                    <SelectGroup>
                      {group.items.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectSeparator />
                  </Fragment>
                );
              } else {
                return (
                  <SelectGroup key={group.label}>
                    {group.items.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              }
            })}
          </SelectContent>
        </Select>
        <Button
          size="icon"
          variant="secondary"
          className="size-8"
          style={{ cursor: "pointer" }}
          onClick={handleAspectRatioLockClick}
          aria-label={
            cropSettings.aspectRatioLocked
              ? "Unlock aspect ratio"
              : "Lock aspect ratio"
          }
        >
          {cropSettings.aspectRatioLocked ? (
            <LockClosedIcon />
          ) : (
            <LockOpen1Icon />
          )}
        </Button>
      </div>
      <Separator className="my-2" />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs">Rotation</label>
          <span className="text-xs font-medium">{cropSettings.rotation ?? 0}°</span>
        </div>
        <div className="flex items-center gap-2">
          <DebouncedRange
            id="crop-rotation"
            label="Rotation"
            value={cropSettings.rotation ?? 0}
            defaultValue={0}
            min={-45}
            max={45}
            step={1}
            onValueChange={setRotation}
            className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
          />
        </div>
        <div className="flex justify-between">
          <Button
            onClick={resetRotation}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            Reset Rotation
          </Button>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={cropSettings.constrainCrop}
              onChange={(e) => setConstrainCrop(e.target.checked)}
            />
            Constrain Crop
          </label>
        </div>
      </div>

      <Separator className="my-2" />

      <div className="flex flex-row-reverse mt-2 gap-1">
        <Button onClick={handleApplyClick}>Apply</Button>
        <Button onClick={handleResetClick} variant="outline">
          Reset
        </Button>
      </div>

      <Dialog open={showCustomDialog} onOpenChange={setShowCustomDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Custom Aspect Ratio</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label
                  htmlFor="width"
                  className="block text-sm font-medium mb-1"
                >
                  Width
                </label>
                <Input
                  id="width"
                  type="number"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                  placeholder="e.g., 16"
                  min="0.1"
                  step="0.1"
                />
              </div>
              <div className="mt-6 text-xl font-medium">×</div>
              <div className="flex-1">
                <label
                  htmlFor="height"
                  className="block text-sm font-medium mb-1"
                >
                  Height
                </label>
                <Input
                  id="height"
                  type="number"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                  placeholder="e.g., 9"
                  min="0.1"
                  step="0.1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCustomDialogCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleCustomAspectRatioSubmit}
              disabled={
                !customWidth ||
                !customHeight ||
                parseFloat(customWidth) <= 0 ||
                parseFloat(customHeight) <= 0
              }
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
