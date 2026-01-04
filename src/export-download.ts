export type ExportFormat = "png" | "jpeg";

type ExportBackground = "transparent" | "white";

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

type DrawableImage = HTMLImageElement | HTMLCanvasElement;

export function drawImageWithRotation(
  ctx: CanvasRenderingContext2D,
  image: DrawableImage,
  zoomLevel: number,
  offset: { x: number; y: number },
  rotationDegrees: number,
) {
  const imageWidth = image.width;
  const imageHeight = image.height;

  const radians = degreesToRadians(rotationDegrees);
  if (radians !== 0) {
    const renderedWidth = imageWidth * zoomLevel;
    const renderedHeight = imageHeight * zoomLevel;

    const centerX = offset.x + renderedWidth / 2;
    const centerY = offset.y + renderedHeight / 2;

    ctx.translate(centerX, centerY);
    ctx.rotate(radians);
    ctx.translate(-centerX, -centerY);
  }

  ctx.drawImage(
    image,
    offset.x,
    offset.y,
    imageWidth * zoomLevel,
    imageHeight * zoomLevel,
  );
}

function getRotatedBoundingBoxSize(
  width: number,
  height: number,
  rotationDegrees: number,
) {
  if (rotationDegrees === 0) {
    return { width, height };
  }

  const radians = degreesToRadians(rotationDegrees);
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));

  return {
    width: Math.max(1, Math.ceil(width * cos + height * sin)),
    height: Math.max(1, Math.ceil(width * sin + height * cos)),
  };
}

export function renderCommittedImageToOffscreenCanvas(
  image: HTMLImageElement,
  rotationDegrees: number,
  background: ExportBackground,
): HTMLCanvasElement | null {
  const outputSize = getRotatedBoundingBoxSize(
    image.width,
    image.height,
    rotationDegrees,
  );

  const offscreen = document.createElement("canvas");
  offscreen.width = outputSize.width;
  offscreen.height = outputSize.height;

  const ctx = offscreen.getContext("2d");
  if (!ctx) return null;

  if (background === "white") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
  } else {
    ctx.clearRect(0, 0, offscreen.width, offscreen.height);
  }

  const centeredOffset = {
    x: (offscreen.width - image.width) / 2,
    y: (offscreen.height - image.height) / 2,
  };

  ctx.save();
  drawImageWithRotation(ctx, image, 1, centeredOffset, rotationDegrees);
  ctx.restore();

  return offscreen;
}
