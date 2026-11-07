import type { IconName } from "../components/Icon";

const CATEGORY_ICON: Record<string, IconName> = {
  "Dompet & Tas": "bag",
  "Dokumen & Kartu": "card",
  Elektronik: "laptop",
  Kunci: "key",
  Kacamata: "glasses",
  "Pakaian & Aksesoris": "shirt",
};

export function categoryIcon(category: string): IconName {
  return CATEGORY_ICON[category] ?? "box";
}
