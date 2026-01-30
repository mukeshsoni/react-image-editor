export type MobileTrayNudgeParams = {
  offsetY: number;
  zoomLevel: number;
  imageHeight: number;
  viewportHeight: number;
  trayHeight: number;
  topMargin?: number;
};

export type MobileTrayNudgeResult = {
  nextOffsetY: number;
  overlapPx: number;
  appliedShiftUp: number;
};

export function computeMobileTrayNudge({
  offsetY,
  zoomLevel,
  imageHeight,
  viewportHeight,
  trayHeight,
  topMargin = 20,
}: MobileTrayNudgeParams): MobileTrayNudgeResult {
  const trayTopY = viewportHeight - trayHeight;
  const renderedImageHeight = imageHeight * zoomLevel;

  const imageTop = offsetY;
  const imageBottom = imageTop + renderedImageHeight;

  const requiredShiftUp = Math.max(0, imageBottom - trayTopY);
  const availableShiftUp = Math.max(0, imageTop - topMargin);
  const appliedShiftUp = Math.min(requiredShiftUp, availableShiftUp);

  const nextOffsetY = imageTop - appliedShiftUp;
  const nextBottom = nextOffsetY + renderedImageHeight;
  const overlapPx = Math.max(0, nextBottom - trayTopY);

  return {
    nextOffsetY,
    overlapPx,
    appliedShiftUp,
  };
}
