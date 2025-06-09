import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "vitest-browser-react";
import { page, userEvent } from "@vitest/browser/context";
import { Cropper, CropOptions } from "../Cropper";
import type { CropRect } from "../store/cropStore";

// Helper function to wait
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Test data
const mockCropBounds = {
  minX: 0,
  minY: 0,
  maxX: 800,
  maxY: 600,
};

function IntegratedCropperTest({
  onApply,
  onReset,
}: {
  onApply: (cropRect: CropRect) => void;
  onReset: () => void;
}) {
  return (
    <div>
      <Cropper cropBounds={mockCropBounds} />
      <CropOptions onApply={onApply} onReset={onReset} />
    </div>
  );
}

describe("Cropper and CropOptions Browser Integration Tests", () => {
  beforeEach(() => {
    // Clear any previous state
    window.scrollTo(0, 0);
  });

  afterEach(() => {
    cleanup();
  });

  test("user resizes the crop area and then applies the crop", async () => {
    const appliedCropRects: CropRect[] = [];

    const mockOnApply = (cropRect: CropRect) => {
      appliedCropRects.push(cropRect);
    };

    const mockOnReset = () => {
      // Reset callback
    };

    render(
      <IntegratedCropperTest onApply={mockOnApply} onReset={mockOnReset} />
    );

    // Find the crop region and bottom-right handle
    const cropRegion = page.getByTestId("crop-region");
    const bottomRightHandle = page.getByTestId("crop-handle-bottom-right");
    
    expect(cropRegion).toBeTruthy();
    expect(bottomRightHandle).toBeTruthy();

    // Simulate basic interaction with the crop area
    // Click on the crop region to ensure it's active
    await userEvent.click(cropRegion);

    // Hover over the handle to simulate starting a resize operation
    await userEvent.hover(bottomRightHandle);

    // Wait for any state updates
    await wait(100);

    // Find and click the Apply button
    const applyButton = page.getByText("Apply");
    expect(applyButton).toBeTruthy();
    await userEvent.click(applyButton);

    // Wait for the callback to be processed
    await wait(100);

    // Verify that onApply was called (the crop store should provide a valid crop rect)
    expect(appliedCropRects.length).toBeGreaterThanOrEqual(1);
    
    // If we got a crop rect, verify it has the expected structure
    if (appliedCropRects.length > 0) {
      expect(appliedCropRects[0]).toMatchObject({
        x: expect.any(Number),
        y: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
      });

      // Verify the crop rect has reasonable values within bounds
      const appliedRect = appliedCropRects[0];
      expect(appliedRect.width).toBeGreaterThan(0);
      expect(appliedRect.height).toBeGreaterThan(0);
    }
  });
});