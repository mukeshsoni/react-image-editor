import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { Cropper } from "../Cropper";
import type { Bounds } from "../store/cropStore";

// Mock the crop store
const mockInitializeCropRect = vi.fn();
const mockMoveCropRect = vi.fn();
const mockResizeCropRect = vi.fn();

vi.mock("../store/cropStore", () => ({
  useCropStore: () => ({
    cropRect: { x: 100, y: 100, width: 200, height: 150 },
    initializeCropRect: mockInitializeCropRect,
    moveCropRect: mockMoveCropRect,
    resizeCropRect: mockResizeCropRect,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("Cropper", () => {
  const mockCropBounds: Bounds = {
    minX: 0,
    minY: 0,
    maxX: 800,
    maxY: 600,
  };

  test("renders crop area with correct dimensions and position", () => {
    const { getByTestId } = render(<Cropper cropBounds={mockCropBounds} />);

    // Find the crop region div by test ID
    const cropRegion = getByTestId("crop-region");
    expect(cropRegion).toBeTruthy();

    // Check if the style attribute contains the expected values
    const style = cropRegion.getAttribute("style") || "";
    expect(style).toContain("left: 100px");
    expect(style).toContain("top: 100px");
    expect(style).toContain("width: 200px");
    expect(style).toContain("height: 150px");
  });

  test("renders all 8 resize handles", () => {
    const { container } = render(<Cropper cropBounds={mockCropBounds} />);

    // Check for all 8 handles by their test IDs
    const handlePositions = [
      "top-left",
      "top",
      "top-right",
      "left",
      "right",
      "bottom-left",
      "bottom",
      "bottom-right",
    ];

    handlePositions.forEach((position) => {
      const handles = container.querySelectorAll(
        `[data-testid="crop-handle-${position}"]`,
      );
      expect(handles.length).toBe(1);
    });
  });

  test("calls onChange callback when cropRect changes via prop", () => {
    const mockOnChange = vi.fn();

    render(<Cropper cropBounds={mockCropBounds} onChange={mockOnChange} />);

    // Should call onChange with the initial cropRect values
    expect(mockOnChange).toHaveBeenCalledWith({
      x: 100,
      y: 100,
      width: 200,
      height: 150,
    });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  test("initializes crop rect on mount", () => {
    render(<Cropper cropBounds={mockCropBounds} />);

    expect(mockInitializeCropRect).toHaveBeenCalledWith(mockCropBounds);
    expect(mockInitializeCropRect).toHaveBeenCalledTimes(1);
  });

  test("handles mouse down on crop region for moving", () => {
    const { getByTestId } = render(<Cropper cropBounds={mockCropBounds} />);

    const cropRegion = getByTestId("crop-region");

    fireEvent.mouseDown(cropRegion, {
      clientX: 150,
      clientY: 125,
      target: cropRegion,
      currentTarget: cropRegion,
    });

    // Should not call resize or move functions immediately on mouse down
    expect(mockMoveCropRect).not.toHaveBeenCalled();
    expect(mockResizeCropRect).not.toHaveBeenCalled();
  });

  test("handles mouse down on resize handle", () => {
    const { getByTestId } = render(<Cropper cropBounds={mockCropBounds} />);

    const handle = getByTestId("crop-handle-bottom-right");

    fireEvent.mouseDown(handle, {
      clientX: 300,
      clientY: 250,
      target: handle,
      currentTarget: handle,
    });

    // Should not call resize function immediately on mouse down
    expect(mockResizeCropRect).not.toHaveBeenCalled();
  });

  test("handles mouse move after mouse down on crop region", () => {
    const { container } = render(<Cropper cropBounds={mockCropBounds} />);

    const cropperContainer = container.firstChild as HTMLElement;

    // Simulate mouse down on crop region
    fireEvent.mouseDown(cropperContainer, {
      clientX: 150,
      clientY: 125,
    });

    // Simulate mouse move
    fireEvent.mouseMove(cropperContainer, {
      clientX: 160,
      clientY: 135,
    });

    expect(mockMoveCropRect).toHaveBeenCalledWith(
      { x: 160, y: 135 },
      { x: 150, y: 125 },
    );
  });

  test("handles mouse move after mouse down on resize handle", () => {
    const { container } = render(<Cropper cropBounds={mockCropBounds} />);

    const cropperContainer = container.firstChild as HTMLElement;

    // Simulate mouse down on bottom-right handle area (coordinates where handle would be)
    fireEvent.mouseDown(cropperContainer, {
      clientX: 300,
      clientY: 250,
    });

    // Simulate mouse move
    fireEvent.mouseMove(cropperContainer, {
      clientX: 310,
      clientY: 260,
    });

    // Should call resizeCropRect if it detected a handle
    expect(mockResizeCropRect).toHaveBeenCalled();
  });

  test("handles mouse up to stop dragging", () => {
    const { container } = render(<Cropper cropBounds={mockCropBounds} />);

    const cropperContainer = container.firstChild as HTMLElement;

    // Start dragging
    fireEvent.mouseDown(cropperContainer, {
      clientX: 150,
      clientY: 125,
    });

    fireEvent.mouseMove(cropperContainer, {
      clientX: 160,
      clientY: 135,
    });

    // Stop dragging
    fireEvent.mouseUp(cropperContainer);

    // Move again - should not trigger move since dragging stopped
    fireEvent.mouseMove(cropperContainer, {
      clientX: 170,
      clientY: 145,
    });

    // Should only have been called once during the first move
    expect(mockMoveCropRect).toHaveBeenCalledTimes(1);
  });

  test("handles mouse leave to stop dragging", () => {
    const { container } = render(<Cropper cropBounds={mockCropBounds} />);

    const cropperContainer = container.firstChild as HTMLElement;

    // Start dragging
    fireEvent.mouseDown(cropperContainer, {
      clientX: 150,
      clientY: 125,
    });

    fireEvent.mouseMove(cropperContainer, {
      clientX: 160,
      clientY: 135,
    });

    // Mouse leaves the container
    fireEvent.mouseLeave(cropperContainer);

    // Move again - should not trigger move since dragging stopped
    fireEvent.mouseMove(cropperContainer, {
      clientX: 170,
      clientY: 145,
    });

    // Should only have been called once during the first move
    expect(mockMoveCropRect).toHaveBeenCalledTimes(1);
  });

  test("does not call onChange when no onChange prop provided", () => {
    // Should not throw error when onChange is not provided
    expect(() => {
      render(<Cropper cropBounds={mockCropBounds} />);
    }).not.toThrow();
  });

  test("handles empty or minimal crop bounds", () => {
    const minimalBounds: Bounds = {
      minX: 0,
      minY: 0,
      maxX: 10,
      maxY: 10,
    };

    render(<Cropper cropBounds={minimalBounds} />);

    expect(mockInitializeCropRect).toHaveBeenCalledWith(minimalBounds);
  });

  test("handles crop bounds with negative coordinates", () => {
    const negativeBounds: Bounds = {
      minX: -100,
      minY: -50,
      maxX: 200,
      maxY: 150,
    };

    render(<Cropper cropBounds={negativeBounds} />);

    expect(mockInitializeCropRect).toHaveBeenCalledWith(negativeBounds);
  });

  test("handle cursors are set correctly", () => {
    const { getByTestId } = render(<Cropper cropBounds={mockCropBounds} />);

    // Test a few different handle cursors
    const topLeftHandle = getByTestId("crop-handle-top-left");
    const topLeftStyle = topLeftHandle.getAttribute("style") || "";
    expect(topLeftStyle).toContain("cursor: nw-resize");

    const topHandle = getByTestId("crop-handle-top");
    const topStyle = topHandle.getAttribute("style") || "";
    expect(topStyle).toContain("cursor: ns-resize");

    const rightHandle = getByTestId("crop-handle-right");
    const rightStyle = rightHandle.getAttribute("style") || "";
    expect(rightStyle).toContain("cursor: ew-resize");
  });
});
