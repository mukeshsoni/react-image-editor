import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";

import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useThemeMode } from "@/hooks/useThemeMode";
import type { ThemeMode } from "@/lib/theme";

import { ReactImageEditor } from "./ReactImageEditor";
import "./App.css";

const tempImageSource =
  "https://fastly.picsum.photos/id/882/1200/800.jpg?hmac=i4kum7mc7UBbYR4ihbpgXdiQkQ_A_sMiewo3uHJRe4w";

function App() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageSource, setImageSource] = useState<string | null>(tempImageSource);

  const { mode, setMode, resolvedTheme } = useThemeMode({
    defaultMode: "system",
    persist: true,
  });

  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeButtonRef = useRef<HTMLButtonElement | null>(null);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  useEffect(() => {
    if (!themeMenuOpen) return;

    // Move focus into the menu when it opens.
    const firstItem = themeMenuRef.current?.querySelector<HTMLElement>(
      '[role="menuitemradio"]',
    );
    firstItem?.focus();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (themeMenuRef.current?.contains(target)) return;
      if (themeButtonRef.current?.contains(target)) return;

      setThemeMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown, true);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setThemeMenuOpen(false);
        themeButtonRef.current?.focus();
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

      const items = Array.from(
        themeMenuRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitemradio"]',
        ) ?? [],
      );
      if (items.length === 0) return;

      const active = document.activeElement;
      const currentIndex = items.findIndex((item) => item === active);

      const delta = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        currentIndex === -1
          ? 0
          : (currentIndex + delta + items.length) % items.length;
      const next = items[nextIndex];
      if (!next) return;

      event.preventDefault();
      next.focus();
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [themeMenuOpen]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setImageFile(event.target.files ? event.target.files[0] : null);
    setThemeMenuOpen(false);
  }

  useEffect(() => {
    if (imageFile) {
      setImageSource(URL.createObjectURL(imageFile));
    }
  }, [imageFile]);

  const themeLabel = useMemo(() => {
    if (mode === "light") return "Light";
    if (mode === "dark") return "Dark";
    return "System";
  }, [mode]);

  return (
      <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-background px-2 py-2">
        <label htmlFor="image-upload" className="sr-only">
          Upload image
        </label>
        <Input
          id="image-upload"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="max-w-[320px]"
        />

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Button
              ref={themeButtonRef}
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Theme: ${themeLabel}`}
              aria-haspopup="menu"
              aria-expanded={themeMenuOpen}
              onClick={() => setThemeMenuOpen((open) => !open)}
            >
              {mode === "light" ? (
                <Sun />
              ) : mode === "dark" ? (
                <Moon />
              ) : (
                <Monitor />
              )}
            </Button>

            {themeMenuOpen ? (
              <div
                ref={themeMenuRef}
                role="menu"
                aria-label="Theme"
                className="absolute right-0 z-20 mt-2 w-[160px] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
              >
                <ThemeMenuItem
                  current={mode}
                  value="light"
                  onSelect={(value) => {
                    setMode(value);
                    setThemeMenuOpen(false);
                  }}
                >
                  <Sun className="size-4" />
                  Light
                </ThemeMenuItem>
                <ThemeMenuItem
                  current={mode}
                  value="dark"
                  onSelect={(value) => {
                    setMode(value);
                    setThemeMenuOpen(false);
                  }}
                >
                  <Moon className="size-4" />
                  Dark
                </ThemeMenuItem>
                <ThemeMenuItem
                  current={mode}
                  value="system"
                  onSelect={(value) => {
                    setMode(value);
                    setThemeMenuOpen(false);
                  }}
                >
                  <Monitor className="size-4" />
                  System
                </ThemeMenuItem>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 min-h-0 overflow-hidden">
          {imageSource ? (
            <ReactImageEditor imageSrc={imageSource} themeMode={mode} themeScope="global" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ThemeMenuItem({
  current,
  value,
  onSelect,
  children,
}: {
  current: ThemeMode;
  value: ThemeMode;
  onSelect: (value: ThemeMode) => void;
  children: ReactNode;
}) {
  const selected = current === value;

  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      className={
        selected
          ? "flex w-full items-center gap-2 rounded-sm bg-accent px-2 py-1.5 text-left text-sm"
          : "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
      }
      onClick={() => {
        onSelect(value);
      }}
    >
      {children}
    </button>
  );
}

export default App;
