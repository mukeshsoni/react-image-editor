import { useRef } from "react";

import { createCanvas, ImageData, loadImage } from "@napi-rs/canvas";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { TonePanel } from "../components/TonePanel";
import { PhotoRenderer, processPixels } from "../engine/renderer";
import { useCanvasInput } from "../hooks/use-canvas-input";
import { SessionContext } from "../model/context";
import { createSession } from "../model/session";
import type { EditorSession } from "../model/session";
import type { Point } from "../model/types";

class ReviewPointerEvent extends MouseEvent {
  readonly pointerId: number;
  readonly pointerType: string;
  constructor(type: string, init: ConstructorParameters<typeof MouseEvent>[1] & { pointerId?: number; pointerType?: string } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? "mouse";
  }
}

const sessions: EditorSession[] = [];
function readySession(): EditorSession {
  const session = createSession();
  session.load({ width: 100, height: 100 }); sessions.push(session);
  return session;
}

function tonePanel(points: Point[]) {
  const session = readySession();
  session.edit("Curve fixture", (edits) => ({ ...edits, toneCurve: { ...edits.toneCurve, point: { ...edits.toneCurve.point, rgb: points } } }));
  render(<SessionContext.Provider value={session}><TonePanel /></SessionContext.Provider>);
  const graph = screen.getByRole("application", { name: "Tone curve editor" });
  vi.spyOn(graph, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 100, 100));
  Object.defineProperty(graph, "setPointerCapture", { value: vi.fn() });
  return { session, graph, points: () => session.store.getState().edits.toneCurve.point.rgb };
}

function clickGraph(graph: HTMLElement, x: number, y: number) {
  fireEvent.pointerDown(graph, { clientX: x * 100, clientY: (1 - y) * 100, button: 0 });
  fireEvent.pointerUp(graph, { button: 0 });
}

function renderedGray(session: EditorSession, value: number): number {
  return processPixels({ width: 1, height: 1, pixels: new Uint8ClampedArray([value, value, value, 255]) }, session.store.getState().edits).pixels[0];
}

async function grayPhoto(): Promise<PhotoRenderer> {
  const canvas = createCanvas(100, 100), pixels = new Uint8ClampedArray(100 * 100 * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([128, 128, 128, 255], i);
  canvas.getContext("2d").putImageData(new ImageData(pixels, 100, 100), 0, 0);
  const image = await loadImage(canvas.toBuffer("image/png"));
  // Only construction needs a drawing surface; the hook itself mounts a real DOM canvas.
  const createElement = vi.spyOn(document, "createElement").mockImplementationOnce(() => createCanvas(1, 1) as unknown as HTMLCanvasElement);
  try { return new PhotoRenderer(image as unknown as HTMLImageElement); }
  finally { createElement.mockRestore(); }
}

function InputCanvas({ photo }: { photo: PhotoRenderer }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useCanvasInput(photo, canvas);
  return <div><canvas ref={canvas} aria-label="Input canvas" onPointerDown={input.onPointerDown} onPointerUp={input.onPointerUp} /></div>;
}

function mountInput(session: EditorSession, photo: PhotoRenderer) {
  render(<SessionContext.Provider value={session}><InputCanvas photo={photo} /></SessionContext.Provider>);
  const canvas = screen.getByLabelText("Input canvas");
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(new DOMRect(30, 40, 300, 300));
  Object.defineProperty(canvas, "setPointerCapture", { value: vi.fn() });
  return canvas;
}

function clickCanvas(canvas: HTMLElement, x: number, y: number) {
  fireEvent.pointerDown(canvas, { clientX: 30 + x, clientY: 40 + y, button: 0 });
  fireEvent.pointerUp(canvas, { clientX: 30 + x, clientY: 40 + y, button: 0 });
}

beforeEach(() => vi.stubGlobal("PointerEvent", ReviewPointerEvent));
afterEach(() => {
  cleanup();
  for (const session of sessions) session.cancel();
  sessions.length = 0;
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe("review: distinct and effective curve points", () => {
  test.each([0.5, 0.5005])("a pointer insertion at existing x=%s selects a usable point", (x) => {
    const { session, graph, points } = tonePanel([{ x: 0, y: 0 }, { x: 0.5, y: 0.2 }, { x: 1, y: 1 }]);
    clickGraph(graph, x, 0.8);
    expect(points()).toEqual([{ x: 0, y: 0 }, { x: 0.5, y: 0.2 }, { x: 1, y: 1 }]);
    expect(screen.getByRole("combobox", { name: "Selected curve point" }).textContent).toBe("Point 2");
    const before = renderedGray(session, 128);
    fireEvent.keyDown(graph, { key: "ArrowUp", shiftKey: true });
    expect(points()[1].y).toBe(0.25);
    expect(renderedGray(session, 128)).toBeGreaterThan(before + 10);
  });

  test("a distinct pointer insertion remains selected and affects the rendered curve", () => {
    const { session, graph, points } = tonePanel([{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]);
    clickGraph(graph, 0.75, 0.9);
    expect(points().map((point) => point.x)).toEqual([0, 0.5, 0.75, 1]);
    expect(screen.getByRole("combobox", { name: "Selected curve point" }).textContent).toBe("Point 3");
    expect(renderedGray(session, 191)).toBeGreaterThan(220);
    fireEvent.keyDown(graph, { key: "Delete" });
    expect(points()).toHaveLength(3);
    expect(renderedGray(session, 191)).toBe(191);
  });

  test("keyboard-activated Add point uses a distinct interval and selects the effective point", () => {
    const { session, graph, points } = tonePanel([{ x: 0, y: 0 }, { x: 0.25, y: 0.25 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]);
    const add = screen.getByRole("button", { name: "Add point" });
    add.focus();
    fireEvent.click(add, { detail: 0 }); // Native button activation by keyboard dispatches a zero-detail click.
    expect(points().map((point) => point.x)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(screen.getByRole("combobox", { name: "Selected curve point" }).textContent).toBe("Point 4");
    graph.focus(); fireEvent.keyDown(graph, { key: "ArrowUp", shiftKey: true });
    expect(renderedGray(session, 191)).toBeGreaterThan(200);
    fireEvent.click(add, { detail: 0 });
    expect(points().map((point) => point.x)).toEqual([0, 0.125, 0.25, 0.5, 0.75, 1]);
    expect(screen.getByRole("combobox", { name: "Selected curve point" }).textContent).toBe("Point 2");
  });
});

describe("review: canvas input sampling", () => {
  test("point color converts canvas to frame coordinates and white balance still samples the original", async () => {
    const session = readySession(), photo = await grayPhoto();
    session.edit("White balance", (edits) => ({ ...edits, whiteBalance: { ...edits.whiteBalance, temperatureKelvin: 2000 } }));
    session.sample("color");
    session.store.setState({ camera: { scale: 2, origin: { x: 10, y: 20 } }, viewport: { width: 300, height: 300, coveredHeight: 0 } });
    const sampler = vi.spyOn(photo, "samplePointColor"), canvas = mountInput(session, photo);
    clickCanvas(canvas, 110, 120);
    expect(sampler.mock.calls[0][0]).toEqual({ x: 50, y: 50 });
    expect(sampler.mock.calls[0][2]).toBe(false);
    expect(session.store.getState().edits.color.pointColor.hue).toBeCloseTo(213.5294117647 / 360, 9);
    expect(session.store.getState().sampler).toBeNull();
    act(() => session.sample("balance"));
    clickCanvas(canvas, 110, 120);
    expect(session.store.getState().edits.whiteBalance).toEqual({ temperatureKelvin: 6500, tint: 0, preset: "custom" });
    expect(sampler).toHaveBeenCalledTimes(1);
  });

  test("new healing gestures use the opposite source at the right edge", async () => {
    const session = readySession(), photo = await grayPhoto();
    session.chooseTool("repair");
    session.edit("Brush size", (edits) => ({ ...edits, healing: { ...edits.healing, brush: { ...edits.healing.brush, size: 20 } } }));
    session.store.setState({ camera: { scale: 1, origin: { x: 0, y: 0 } }, viewport: { width: 300, height: 300, coveredHeight: 0 } });
    clickCanvas(mountInput(session, photo), 96, 50);
    const operations = session.store.getState().edits.healing.ops;
    expect(operations).toHaveLength(1);
    expect(operations[0].source).toEqual({ x: 76, y: 50 });
  });
});
