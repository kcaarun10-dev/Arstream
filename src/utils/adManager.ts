// Centralized Ad Management & Monetization Controller

export const AD_REDIRECT_URL = "https://www.profitableratecpmnetwork.com/c7yfnvwr?key=3c565d28d928905ef6317ce8c186511a";

type AdCloseCallback = () => void;

let globalShowAdHandler: ((onClose?: AdCloseCallback) => void) | null = null;

/**
 * Register global ad modal handler
 */
export function registerAdHandler(handler: (onClose?: AdCloseCallback) => void) {
  globalShowAdHandler = handler;
  return () => {
    if (globalShowAdHandler === handler) {
      globalShowAdHandler = null;
    }
  };
}

/**
 * Trigger the Sponsored Ad Modal from anywhere in the app (stream tap, server switch, page open)
 */
export function showSponsoredAd(onClose?: AdCloseCallback) {
  if (globalShowAdHandler) {
    globalShowAdHandler(onClose);
  } else if (onClose) {
    onClose();
  }
}

/**
 * Open the ad monetization link in a new tab/window safely with popup-blocker resilience
 */
export function openAdRedirect(): void {
  try {
    const newWindow = window.open(AD_REDIRECT_URL, "_blank", "noopener,noreferrer");
    if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
      // Fallback: create temporary invisible link element and dispatch synthetic click
      const link = document.createElement("a");
      link.href = AD_REDIRECT_URL;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 300);
    }
  } catch (error) {
    console.warn("Sponsored Ad redirect handler notice:", error);
  }
}
