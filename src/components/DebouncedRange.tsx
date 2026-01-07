import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  id: string;
  label: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  debounceMs?: number;
  className?: string;
  "data-testid"?: string;
  onValueChange: (value: number) => void;
};

export function DebouncedRange({
  id,
  label,
  value,
  defaultValue,
  min,
  max,
  step,
  disabled = false,
  debounceMs = 150,
  className,
  "data-testid": dataTestId,
  onValueChange,
}: Props) {
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
      }, debounceMs);
    };
  }, [debounceMs, onValueChange]);

  const flushCommit = useMemo(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      onValueChange(draftValueRef.current);
    };
  }, [onValueChange]);

  return (
    <input
      id={id}
      data-testid={dataTestId}
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
      className={className}
    />
  );
}
