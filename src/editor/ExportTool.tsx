import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  canvasToBlob,
  renderCommittedImageToOffscreenCanvas,
  triggerDownload,
  type ExportFormat,
} from "@/export-download";
import { useColorStore } from "@/store/colorStore";
import { useLightStore } from "@/store/lightStore";
import { useToneCurveStore } from "@/store/toneCurveStore";
import { useWhiteBalanceStore } from "@/store/whiteBalanceStore";

type Props = {
  imageRef: RefObject<HTMLImageElement | null>;
  isImageLoaded: boolean;
  cropMode: boolean;
  rotation: number;

  exportFormat: ExportFormat;
  setExportFormat: (format: ExportFormat) => void;
  jpegQuality: number;
  setJpegQuality: (quality: number) => void;

  isDownloading: boolean;
  setIsDownloading: (next: boolean) => void;
  exportError: string | null;
  setExportError: (next: string | null) => void;
};

export function ExportTool({
  imageRef,
  isImageLoaded,
  cropMode,
  rotation,
  exportFormat,
  setExportFormat,
  jpegQuality,
  setJpegQuality,
  isDownloading,
  setIsDownloading,
  exportError,
  setExportError,
}: Props) {
  const whiteBalance = useWhiteBalanceStore((state) => state.whiteBalance);
  const lightAdjustments = useLightStore((state) => state.lightAdjustments);
  const colorAdjustments = useColorStore((state) => state.colorAdjustments);
  const toneCurve = useToneCurveStore((state) => state.toneCurve);

  async function handleDownload() {
    if (!imageRef.current) return;
    if (!isImageLoaded) return;

    setExportError(null);
    setIsDownloading(true);

    try {
      if (cropMode) {
        setExportError("Apply crop to download");
        return;
      }

      const mimeType = exportFormat === "png" ? "image/png" : "image/jpeg";
      const extension = exportFormat === "png" ? "png" : "jpg";
      const background = exportFormat === "png" ? "transparent" : "white";

      const offscreen = renderCommittedImageToOffscreenCanvas(
        imageRef.current,
        rotation,
        background,
        whiteBalance,
        lightAdjustments,
        toneCurve,
        colorAdjustments,
      );
      if (!offscreen) {
        setExportError("Failed to export image");
        return;
      }

      const quality = exportFormat === "jpeg" ? jpegQuality / 100 : undefined;
      const blob = await canvasToBlob(offscreen, mimeType, quality);
      if (!blob) {
        setExportError("Failed to export image");
        return;
      }

      triggerDownload(blob, `edited-image.${extension}`);
    } catch {
      setExportError("Failed to export image");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <>
      <Button
        onClick={handleDownload}
        variant="default"
        size="sm"
        disabled={!isImageLoaded || isDownloading || cropMode}
        title={
          !isImageLoaded
            ? "Load an image to download"
            : cropMode
              ? "Apply crop to download"
              : undefined
        }
      >
        {isDownloading ? "Downloading…" : "Download"}
      </Button>

      <Select
        value={exportFormat}
        onValueChange={(value) => setExportFormat(value as ExportFormat)}
      >
        <SelectTrigger
          size="sm"
          className="w-[110px]"
          data-testid="export-format"
        >
          <SelectValue placeholder="Format" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="png">PNG</SelectItem>
          <SelectItem value="jpeg">JPEG</SelectItem>
        </SelectContent>
      </Select>

      {exportFormat === "jpeg" ? (
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700" htmlFor="jpeg-quality">
            Quality
          </label>
          <input
            id="jpeg-quality"
            data-testid="jpeg-quality"
            type="range"
            min={10}
            max={100}
            step={1}
            value={jpegQuality}
            onChange={(e) => setJpegQuality(Number(e.target.value))}
          />
          <span className="text-xs tabular-nums text-gray-700 w-[40px] text-right">
            {jpegQuality}
          </span>
        </div>
      ) : null}

      {cropMode ? (
        <div className="text-xs text-gray-700">Apply crop to download</div>
      ) : null}

      {exportError ? (
        <div className="text-xs text-red-600">{exportError}</div>
      ) : null}
    </>
  );
}
