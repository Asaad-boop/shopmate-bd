import { useEffect } from "react";

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} — ShopMate BD`;
    return () => {
      document.title = "ShopMate BD";
    };
  }, [title]);
}
