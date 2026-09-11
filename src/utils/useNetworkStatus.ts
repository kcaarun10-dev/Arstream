import { useState, useEffect } from "react";

export interface NetworkStatus {
  isOnline: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

/**
 * Custom hook to listen to browser online/offline events
 * and provide real-time connection telemetry.
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => {
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    const connection = (navigator as any)?.connection || (navigator as any)?.mozConnection || (navigator as any)?.webkitConnection;
    return {
      isOnline,
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt,
      saveData: connection?.saveData,
    };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateNetworkInfo = () => {
      const isOnline = navigator.onLine;
      const connection = (navigator as any)?.connection || (navigator as any)?.mozConnection || (navigator as any)?.webkitConnection;
      setStatus({
        isOnline,
        effectiveType: connection?.effectiveType,
        downlink: connection?.downlink,
        rtt: connection?.rtt,
        saveData: connection?.saveData,
      });
    };

    window.addEventListener("online", updateNetworkInfo);
    window.addEventListener("offline", updateNetworkInfo);

    const connection = (navigator as any)?.connection || (navigator as any)?.mozConnection || (navigator as any)?.webkitConnection;
    if (connection) {
      connection.addEventListener("change", updateNetworkInfo);
    }

    return () => {
      window.removeEventListener("online", updateNetworkInfo);
      window.removeEventListener("offline", updateNetworkInfo);
      if (connection) {
        connection.removeEventListener("change", updateNetworkInfo);
      }
    };
  }, []);

  return status;
}
