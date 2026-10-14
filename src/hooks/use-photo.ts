import { useEffect, useState } from "react";

import { PhotoRenderer } from "../engine/renderer";
import type { EditorSession } from "../model/session";

export function usePhoto(url: string, session: EditorSession): PhotoRenderer | null {
  const [photo, setPhoto] = useState<PhotoRenderer | null>(null);
  useEffect(() => {
    let current = true;
    session.beginLoad(); setPhoto(null);
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (!current) return;
      try {
        const renderer = new PhotoRenderer(image);
        setPhoto(renderer);
        session.load({ width: image.naturalWidth, height: image.naturalHeight });
      } catch {
        session.fail("Could not read this image. Use a local file or a CORS-enabled image URL.");
      }
    };
    image.onerror = () => { if (current) session.fail("Could not load image. Check the URL or choose another file."); };
    if (url) image.src = url; else session.fail("Choose an image to begin editing.");
    return () => { current = false; image.onload = null; image.onerror = null; };
  }, [url, session]);
  return photo;
}
