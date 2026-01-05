import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

import { validateToneCurvePoints } from "@/lib/tone-curve";

import type { CurvePoint } from "../store/cropStore";

type Props = {
  points: CurvePoint[];
  onChangePoints: (points: CurvePoint[]) => void;
  disabled: boolean;
};

const SIZE = 200;
const PADDING = 10;
const HIT_RADIUS = 10;
const DRAG_SENSITIVITY = 0.55;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toCanvas(point: CurvePoint): { x: number; y: number } {
  return {
    x: PADDING + point.x * (SIZE - PADDING * 2),
    y: PADDING + (1 - point.y) * (SIZE - PADDING * 2),
  };
}

function toPoint(canvas: { x: number; y: number }): CurvePoint {
  return {
    x: clamp((canvas.x - PADDING) / (SIZE - PADDING * 2), 0, 1),
    y: clamp(1 - (canvas.y - PADDING) / (SIZE - PADDING * 2), 0, 1),
  };
}

function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function findPointIndex(
  points: CurvePoint[],
  canvas: { x: number; y: number },
): number {
  for (let i = 0; i < points.length; i += 1) {
    const candidate = points[i];
    if (!candidate) continue;
    if (distance(toCanvas(candidate), canvas) <= HIT_RADIUS) {
      return i;
    }
  }
  return -1;
}

function clampPointX(points: CurvePoint[], index: number, x: number): number {
  const prev = points[index - 1];
  const next = points[index + 1];

  const min = prev ? prev.x + 1e-4 : 0;
  const max = next ? next.x - 1e-4 : 1;

  return clamp(x, min, max);
}

export function ToneCurveEditor({ points, onChangePoints, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const validatedPoints = useMemo(() => validateToneCurvePoints(points), [points]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Some tests mock CanvasRenderingContext2D partially.
    if (
      typeof ctx.clearRect !== "function" ||
      typeof ctx.fillRect !== "function" ||
      typeof ctx.beginPath !== "function" ||
      typeof ctx.moveTo !== "function" ||
      typeof ctx.lineTo !== "function" ||
      typeof ctx.stroke !== "function" ||
      typeof ctx.arc !== "function" ||
      typeof ctx.fill !== "function"
    ) {
      return;
    }

    ctx.clearRect(0, 0, SIZE, SIZE);

    // background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SIZE, SIZE);

    // grid
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const t = i / 4;
      const x = PADDING + t * (SIZE - PADDING * 2);
      const y = PADDING + t * (SIZE - PADDING * 2);

      ctx.beginPath();
      ctx.moveTo(x, PADDING);
      ctx.lineTo(x, SIZE - PADDING);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(PADDING, y);
      ctx.lineTo(SIZE - PADDING, y);
      ctx.stroke();
    }

    // identity
    ctx.strokeStyle = "#9ca3af";
    ctx.beginPath();
    ctx.moveTo(PADDING, SIZE - PADDING);
    ctx.lineTo(SIZE - PADDING, PADDING);
    ctx.stroke();

    // curve
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.beginPath();
    validatedPoints.forEach((point, idx) => {
      const c = toCanvas(point);
      if (idx === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.stroke();

    // points
    validatedPoints.forEach((point, idx) => {
      const c = toCanvas(point);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
      const isActive = activeIndex === idx;
      ctx.fillStyle = isActive ? "#111827" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }, [validatedPoints, activeIndex]);

  function getCanvasPoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();

    // Map from CSS pixels to canvas pixels (handles flex/stretch scaling).
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;

    const canvasPoint = getCanvasPoint(event);
    const hitIndex = findPointIndex(validatedPoints, canvasPoint);

    if (hitIndex >= 0) {
      setActiveIndex(hitIndex);
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    // add point
    const newPoint = toPoint(canvasPoint);
    const next = validateToneCurvePoints([...validatedPoints, newPoint]);

    // find inserted index
    const insertedIndex = next.findIndex(
      (p) =>
        Math.abs(p.x - newPoint.x) < 1e-3 && Math.abs(p.y - newPoint.y) < 1e-3,
    );

    onChangePoints(next);
    setActiveIndex(insertedIndex >= 0 ? insertedIndex : null);
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    if (!isDragging) return;
    if (activeIndex == null) return;

    // don’t move endpoints
    if (activeIndex === 0 || activeIndex === validatedPoints.length - 1) {
      return;
    }

    const canvasPoint = getCanvasPoint(event);
     const point = toPoint(canvasPoint);
 
     const current = validatedPoints[activeIndex];
     if (!current) return;

     const damped = {
       x: clamp(current.x + (point.x - current.x) * DRAG_SENSITIVITY, 0, 1),
       y: clamp(current.y + (point.y - current.y) * DRAG_SENSITIVITY, 0, 1),
     };

     const next = validatedPoints.map((p, idx) => {
       if (idx !== activeIndex) return p;
       return {
         x: clampPointX(validatedPoints, idx, damped.x),
         y: damped.y,
       };
     });

    onChangePoints(validateToneCurvePoints(next));
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;

    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    if (disabled) return;
    if (activeIndex == null) return;

    if (event.key !== "Backspace" && event.key !== "Delete") {
      return;
    }

    // can’t delete endpoints
    if (activeIndex === 0 || activeIndex === validatedPoints.length - 1) {
      return;
    }

    const next = validatedPoints.filter((_, idx) => idx !== activeIndex);
    onChangePoints(validateToneCurvePoints(next));
    setActiveIndex(null);
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <div className="text-xs text-gray-600">Curve</div>
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          tabIndex={disabled ? -1 : 0}
          className={`rounded-md border ${disabled ? "opacity-60" : ""}`}
          aria-label="Tone curve editor"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onKeyDown={handleKeyDown}
        />
        <div className="text-[10px] text-gray-500">
          Click to add point, drag to move, Del to remove
        </div>
      </div>
    </div>
  );
}
