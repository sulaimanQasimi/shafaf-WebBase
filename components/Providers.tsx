"use client";

import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { playNotificationSound } from "@/lib/sound";

function ToastListener() {
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement && node.classList.contains("react-hot-toast")) {
              playNotificationSound();
            }
          });
        }
      });
    });

    const timer = setTimeout(() => {
      const toastContainer = document.querySelector("[data-react-hot-toast]") || document.body;
      observer.observe(toastContainer, {
        childList: true,
        subtree: true,
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToastListener />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#363636",
            color: "#fff",
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: "#10b981",
              secondary: "#fff",
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: "#ef4444",
              secondary: "#fff",
            },
          },
        }}
      />
    </>
  );
}
