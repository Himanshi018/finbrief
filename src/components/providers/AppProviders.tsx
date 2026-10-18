"use client";

import type { ReactNode } from "react";
import { SavedArticlesProvider } from "@/context/SavedArticlesContext";
import { ToastProvider } from "@/context/ToastContext";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <SavedArticlesProvider>{children}</SavedArticlesProvider>
    </ToastProvider>
  );
}
