import {
  Fragment,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Muted } from "@/components/ui/typography";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
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

type Bounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

// The rectangle we calculate on mouse movement should not go outside the bounds of the image
function clampRect(rect: Rect, bounds: Bounds): Rect {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX - rect.width, rect.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY - rect.height, rect.y)),
    width: Math.max(0, Math.min(bounds.maxX - bounds.minX, rect.width)),
    height: Math.max(0, Math.min(bounds.maxY - bounds.minY, rect.height)),
  };
}
type CropperProps = {
  cropBounds: Bounds;
  onChange?: (cropRect: Rect) => void;
};
export function Cropper({ cropBounds, onChange }: CropperProps) {
  const [cropRect, setCropRect] = useState<Rect>({
    x: cropBounds.minX,
    y: cropBounds.minY,
    width: cropBounds.maxX - cropBounds.minX,
    height: cropBounds.maxY - cropBounds.minY,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragType, setDragType] = useState<"move" | "resize" | null>(null);
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // We check where in the box is the user clicked down on
  // If it's on a handle, we set the active handle and start resizing
  // If it's on the box, we start moving
  const handleMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      // clientX and clientY for the event will give us coordinates with respect to the whole viewport
      // We need coordinates within our box
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      setIsDragging(true);
      setDragStart({ x, y });

      // Check if clicking on a handle
      const handles = [
        "top-left",
        "top",
        "top-right",
        "left",
        "right",
        "bottom-left",
        "bottom",
        "bottom-right",
      ];
      for (const handle of handles) {
        const handleRect = getHandleRect(handle, cropRect);
        if (isPointInRect({ x, y }, handleRect)) {
          setDragType("resize");
          setActiveHandle(handle);
          return;
        }
      }

      // Check if clicking inside crop area
      if (isPointInRect({ x, y }, cropRect)) {
        setDragType("move");
        setActiveHandle(null);
      }
    },
    [cropRect],
  );
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
    setDragType(null);
    setActiveHandle(null);
  }, []);
  useEffect(() => {
    onChange?.(cropRect);
  }, [cropRect, onChange]);

  const handleMouseMove = useMemo(
    () => (event: MouseEvent<HTMLDivElement>) => {
      // If not dragging or no drag start, return
      if (!isDragging || !dragStart) {
        return;
      }

      // Find coordinates of mouse relative to the crop area
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Find how much it has moved from the last mouse position
      const deltaX = x - dragStart.x;
      const deltaY = y - dragStart.y;
      const imageWidth = cropBounds.maxX - cropBounds.minX;
      const imageHeight = cropBounds.maxY - cropBounds.minY;

      if (dragType == "move") {
        const newX = Math.max(
          // This is clamp the min x on the left side we allow x to go.
          cropBounds.minX,
          Math.min(
            // This is the max we allow x to go on the right side. Beyond that the right side of crop rectangle
            // will go outside the image right edge
            imageWidth - cropRect.width + cropBounds.minX,
            cropRect.x + deltaX,
          ),
        );
        const newY = Math.max(
          // This is the min y on the top side we allow y to go.
          cropBounds.minY,
          Math.min(
            // This is the max we allow y to go. Beyond that the bottom side of crop rectangle
            // will go outside the image bottom edge
            imageHeight - cropRect.height + cropBounds.minY,
            cropRect.y + deltaY,
          ),
        );

        setCropRect((prev) => ({
          ...prev,
          x: newX,
          y: newY,
        }));
        setDragStart({ x, y });
      } else if (dragType == "resize" && activeHandle) {
        const newRect = getResizedRect(
          cropRect,
          activeHandle,
          { x, y },
          dragStart,
        );
        const boundedRect = clampRect(newRect, cropBounds);

        setCropRect(boundedRect);
        // The AI generated code didn't reset the dragstart which led to
        // we finding a delta always with respect to the start point and the delta grew exponentially with each
        // mouse movement
        setDragStart({ x, y });
      }
    },
    [isDragging, dragStart, activeHandle, cropRect, dragType, cropBounds],
  );

  return (
    <div
      className="absolute inset-0"
      style={{ cursor: getCursor(dragType, activeHandle) }}
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseUp}
    >
      {/* Semi-transparent overlay */}
      <div className="absolute bg-black bg-opacity-50" />

      {/* Clear crop region */}
      <div
        className="absolute border-2 border-gray-600"
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

type Point = {
  x: number;
  y: number;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const HANDLE_SIZE = 10;

// Helper functions
function DragHandle({
  position,
  cropRect,
}: {
  position: string;
  cropRect: Rect;
}) {
  const handleRect = getHandleRect(position, cropRect);
  return (
    <div
      className="absolute bg-white border border-gray-800"
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

function getHandleRect(position: string, cropRect: Rect): Rect {
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

function isPointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function getResizedRect(
  rect: Rect,
  handle: string,
  currentPoint: Point,
  startPoint: Point,
): Rect {
  const deltaX = currentPoint.x - startPoint.x;
  const deltaY = currentPoint.y - startPoint.y;

  switch (handle) {
    case "top-left":
      return {
        x: rect.x + deltaX,
        y: rect.y + deltaY,
        width: rect.width - deltaX,
        height: rect.height - deltaY,
      };
    case "top":
      return {
        ...rect,
        y: rect.y + deltaY,
        height: rect.height - deltaY,
      };
    case "top-right":
      return {
        ...rect,
        y: rect.y + deltaY,
        width: rect.width + deltaX,
        height: rect.height - deltaY,
      };
    case "left":
      return {
        ...rect,
        x: rect.x + deltaX,
        width: rect.width - deltaX,
      };
    case "right":
      return {
        ...rect,
        width: rect.width + deltaX,
      };
    case "bottom-left":
      return {
        ...rect,
        x: rect.x + deltaX,
        width: rect.width - deltaX,
        height: rect.height + deltaY,
      };
    case "bottom":
      return {
        ...rect,
        height: rect.height + deltaY,
      };
    case "bottom-right":
      return {
        ...rect,
        width: rect.width + deltaX,
        height: rect.height + deltaY,
      };
    default:
      return rect;
  }
}

export function CropSettings() {
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
      label: "Horizontal crops",
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
      label: "Vertical crops",
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
    console.log({ value });
    switch (value) {
      case "custom":
        // Handle custom aspect ratio input
        break;
      case "1x1":
      case "4x5":
      case "8.5x11":
      case "5x7":
      case "2x3":
        // TODO: Handle horizontal crops
        break;
      case "4x3":
      case "16x9":
      case "16x10":
        // TODO: Handle vertical crops
        break;
      default:
        // Handle predefined aspect ratios
        break;
    }
  }
  const [aspectRatioLocked, setAspectRatioLocked] = useState(false);
  function handleAspectRatioLockClick() {
    setAspectRatioLocked((lock) => !lock);
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
        <Select onValueChange={handleAspectRatioOptionChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select a fruit" />
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
        >
          {aspectRatioLocked ? <LockOpen1Icon /> : <LockClosedIcon />}
        </Button>
      </div>
    </div>
  );
}
