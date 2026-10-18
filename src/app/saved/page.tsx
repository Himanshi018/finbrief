import type { Metadata } from "next";
import { SavedArticlesView } from "@/components/saved/SavedArticlesView";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants/categories";

export const metadata: Metadata = {
  title: "Saved",
  description: `Your locally saved finance stories on ${APP_NAME}. ${APP_TAGLINE}`,
};

export default function SavedPage() {
  return <SavedArticlesView />;
}
