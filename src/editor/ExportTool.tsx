import type { RefObject } from "react";

import { DebouncedRange } from "@/components/DebouncedRange";
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
import { createOffscreenCropCanvas } from "@/editor/exportCrop";
import { useColorStore } from "@/store/colorStore";
import { useGeometryOpticsStore } from "@/store/geometryOpticsStore";
import { useLightStore } from "@/store/lightStore";
import { useSharpeningStore } from "@/store/sharpeningStore";
import { useToneCurveStore } from "@/store/toneCurveStore";
import { useCropStore } from "@/store/cropStore";
import { useHealingStore } from "@/store/healingStore";
import { getEffectiveAdjustments } from "@/lib/presets";
import { usePresetStore } from "@/store/presetStore";
import { useWhiteBalanceStore } from "@/store/whiteBalanceStore";

type Props = {
  imageRef: RefObject<HTMLImageElement | null>;
  isImageLoaded: boolean;
  cropMode: boolean;
  rotation: number;

  buttonSize?: "sm" | "default" | "lg" | "icon";
  buttonClassName?: string;

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
  buttonSize,
  buttonClassName,
  exportFormat,
  setExportFormat,
  jpegQuality,
  setJpegQuality,
  isDownloading,
  setIsDownloading,
  exportError,
  setExportError,
}: Props) {
  const cropCommitted = useCropStore((state) => state.cropCommitted);
  const cropCommit = useCropStore((state) => state.cropCommit);
  const whiteBalance = useWhiteBalanceStore((state) => state.whiteBalance);
  const lightAdjustments = useLightStore((state) => state.lightAdjustments);
  const colorAdjustments = useColorStore((state) => state.colorAdjustments);
  const toneCurve = useToneCurveStore((state) => state.toneCurve);
  const preset = usePresetStore((state) => state.preset);
  const sharpening = useSharpeningStore((state) => state.sharpening);
  const geometryOptics = useGeometryOpticsStore((state) => state.settings);
  const healingOps = useHealingStore((state) => state.healingOps);

  const effectiveAdjustments = getEffectiveAdjustments({
    manual: {
      whiteBalance,
      light: lightAdjustments,
      color: colorAdjustments,
    },
    preset,
  });

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

      const baseImage = imageRef.current;

      const cropCanvas =
        cropCommitted && cropCommit
          ? createOffscreenCropCanvas({
              image: baseImage,
              commit: cropCommit,
              background,
            })
          : null;

        const offscreen = renderCommittedImageToOffscreenCanvas(
          cropCanvas ?? baseImage,
          cropCanvas ? 0 : rotation,
          background,
          effectiveAdjustments.whiteBalance,
          effectiveAdjustments.light,
          toneCurve,
          effectiveAdjustments.color,
          sharpening,
          geometryOptics,
          healingOps,
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
        size={buttonSize ?? "sm"}
        className={buttonClassName}
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
        data-testid="export-format"
        value={exportFormat}
        onValueChange={(value) => setExportFormat(value as ExportFormat)}
      >
        <SelectTrigger size="sm" className="w-[110px]">
          <SelectValue placeholder="Format" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="png">PNG</SelectItem>
          <SelectItem value="jpeg">JPEG</SelectItem>
        </SelectContent>
      </Select>

      {exportFormat === "jpeg" ? (
        <div className="flex items-center gap-2">
          <label className="text-xs text-foreground" htmlFor="jpeg-quality">
            Quality
          </label>
          <DebouncedRange
            id="jpeg-quality"
            label="Quality"
            value={jpegQuality}
            defaultValue={92}
            min={10}
            max={100}
            step={1}
            onValueChange={setJpegQuality}
            data-testid="jpeg-quality"
          />
          <span className="text-xs tabular-nums text-foreground w-[40px] text-right">
            {jpegQuality}
          </span>
        </div>
      ) : null}

      {cropMode ? (
        <div className="text-xs text-muted-foreground">Apply crop to download</div>
      ) : null}

      {exportError ? (
        <div className="text-xs text-red-600">{exportError}</div>
      ) : null}
    </>
  );
}
