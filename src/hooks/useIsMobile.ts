import { useEffect, useState } from "react";

const MOBILE_MEDIA_QUERY = "(max-width: 768px)";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.(MOBILE_MEDIA_QUERY)?.matches ?? false;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia?.(MOBILE_MEDIA_QUERY);
    if (!media) return;

    const onChange = () => {
      setIsMobile(media.matches);
    };

    onChange();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }

    // Safari fallback
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  return isMobile;
}
