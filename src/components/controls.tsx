import { forwardRef, useContext, useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "../lib/utils";
import { EditorThemeContext } from "../model/context";

type ActionProps = ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; quiet?: boolean };

export const Action = forwardRef<HTMLButtonElement, ActionProps>(function Action({ primary, quiet, className, type = "button", ...props }, ref) {
  return <button ref={ref} type={type} data-slot="button" {...props} className={cn(
    "rie-action inline-flex shrink-0 items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium",
    primary ? "border-transparent bg-rie-accent text-rie-on-accent" : quiet ? "border-transparent bg-transparent hover:bg-rie-soft" : "border-rie-border bg-rie-panel hover:bg-rie-soft",
    className,
  )} />;
});

type ChoiceProps = {
  label: string; value: string; options: readonly (readonly [string, string])[];
  onChange: (value: string) => void; disabled?: boolean; className?: string; testId?: string;
  triggerRef?: Ref<HTMLButtonElement>;
};

export function Choice({ label, value, options, onChange, disabled, className, testId, triggerRef }: ChoiceProps) {
  const theme = useContext(EditorThemeContext);
  return <Select.Root value={value} onValueChange={onChange} disabled={disabled}>
    <Select.Trigger ref={triggerRef} aria-label={label} data-testid={testId}
      className={cn("rie-action inline-flex items-center justify-between gap-3 rounded-md border border-rie-border bg-rie-panel px-3 text-xs", className)}>
      <Select.Value /><Select.Icon><ChevronDown aria-hidden="true" className="size-3.5" /></Select.Icon>
    </Select.Trigger>
    <Select.Portal><Select.Content position="popper" sideOffset={4} collisionPadding={8}
      className={cn("rie-overlay z-50 max-h-72 overflow-hidden rounded-md border border-rie-border bg-rie-panel p-1 text-rie-foreground shadow-md", theme === "dark" && "dark")}>
      <Select.ScrollUpButton className="text-center text-xs">↑</Select.ScrollUpButton>
      <Select.Viewport>
        {options.map(([id, name]) => <Select.Item key={id} value={id}
          className="relative cursor-default rounded-sm py-2 pr-7 pl-3 text-xs outline-none select-none data-highlighted:bg-rie-soft">
          <Select.ItemText>{name}</Select.ItemText>
          <Select.ItemIndicator className="absolute top-2 right-1"><Check aria-hidden="true" className="size-3.5" /></Select.ItemIndicator>
        </Select.Item>)}
      </Select.Viewport>
      <Select.ScrollDownButton className="text-center text-xs">↓</Select.ScrollDownButton>
    </Select.Content></Select.Portal>
  </Select.Root>;
}

export type SliderProps = {
  id: string; label: string; value: number; onCommit: (value: number) => void;
  defaultValue?: number; min?: number; max?: number; step?: number; format?: (value: number) => string; disabled?: boolean;
};

export function Slider({ id, label, value, onCommit, defaultValue = 0, min = -100, max = 100, step = 1, format, disabled }: SliderProps) {
  const [draft, setDraft] = useState(value);
  const pending = useRef<{ value: number; dirty: boolean; timeout?: ReturnType<typeof setTimeout> }>({ value, dirty: false });

  useEffect(() => {
    clearTimeout(pending.current.timeout);
    pending.current.value = value; pending.current.dirty = false; setDraft(value);
  }, [value]);
  useEffect(() => {
    const work = pending.current;
    return () => clearTimeout(work.timeout);
  }, []);

  function commit() {
    const work = pending.current;
    if (!work.dirty) return;
    clearTimeout(work.timeout); work.dirty = false; onCommit(work.value);
  }
  function input(next: number) {
    setDraft(next);
    pending.current.value = next; pending.current.dirty = true;
    clearTimeout(pending.current.timeout); pending.current.timeout = setTimeout(commit, 150);
  }

  return <div className="rie-slider space-y-1">
    <div className="flex items-center justify-between gap-3 text-xs">
      <label htmlFor={id}>{label}</label>
      <output htmlFor={id} className="text-rie-muted tabular-nums">{format ? format(draft) : Number(draft.toFixed(2))}</output>
    </div>
    <input id={id} type="range" aria-label={label} min={min} max={max} step={step} value={draft} disabled={disabled} className="w-full"
      onChange={(event) => input(Number(event.target.value))} onKeyUp={commit} onPointerUp={commit} onBlur={commit}
      onDoubleClick={() => { input(defaultValue); commit(); }} />
  </div>;
}

export function Group({ name, testId, disabled, reset, children }: { name: string; testId?: string; disabled?: boolean; reset?: () => void; children: ReactNode }) {
  return <fieldset disabled={disabled} data-testid={testId} className="min-w-0 space-y-4 border-0 p-0">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-balance text-xs font-semibold">{name}</h3>
      {reset ? <Action quiet onClick={reset} className="px-2 text-rie-muted">Reset</Action> : null}
    </div>
    {children}
  </fieldset>;
}

export function Disclosure({ name, children, initiallyOpen = false }: { name: string; children: ReactNode; initiallyOpen?: boolean }) {
  const storageKey = `react-image-editor:accordion:${name.toLowerCase().replace(/ /g, "-")}`;
  const [open, setOpen] = useState(() => {
    try { const value = localStorage.getItem(storageKey); return value === null ? initiallyOpen : value === "true"; }
    catch { return initiallyOpen; }
  });
  return <details open={open} className="border-b border-rie-border" onToggle={(event) => {
    const next = event.currentTarget.open; setOpen(next);
    try { localStorage.setItem(storageKey, String(next)); } catch { /* Storage is optional for panel preferences. */ }
  }}>
    <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium select-none">
      {name}<ChevronDown aria-hidden="true" className={cn("size-4 text-rie-muted", open && "rotate-180")} />
    </summary>
    <div className="space-y-6 px-4 pt-1 pb-5">{children}</div>
  </details>;
}
