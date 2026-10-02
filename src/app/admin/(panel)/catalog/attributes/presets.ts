import type { Schemas } from "@/lib/api/types";

export type Preset = { key: string; request: Schemas["CreateAttributeRequest"] };

const option = (code: string, ro: string, ru: string, sortOrder: number, swatch?: string[]) => ({
  code,
  label: { ro, ru },
  sortOrder,
  swatch: swatch ?? null,
});

const colors: [string, string, string, string][] = [
  ["negru", "Negru", "Черный", "#111111"],
  ["alb", "Alb", "Белый", "#FFFFFF"],
  ["gri", "Gri", "Серый", "#9CA3AF"],
  ["rosu", "Roșu", "Красный", "#DC2626"],
  ["albastru", "Albastru", "Синий", "#2563EB"],
  ["verde", "Verde", "Зеленый", "#16A34A"],
  ["galben", "Galben", "Желтый", "#FACC15"],
  ["portocaliu", "Portocaliu", "Оранжевый", "#F97316"],
  ["violet", "Violet", "Фиолетовый", "#984AFE"],
  ["roz", "Roz", "Розовый", "#EC4899"],
  ["maro", "Maro", "Коричневый", "#92400E"],
  ["bej", "Bej", "Бежевый", "#E7D7B8"],
];

export const presets: Preset[] = [
  {
    key: "color",
    request: {
      code: "color",
      name: { ro: "Culoare", ru: "Цвет" },
      dataType: "Option",
      unit: null,
      isFilterable: true,
      showAsSwatches: true,
      options: colors.map(([code, ro, ru, hex], i) => option(code, ro, ru, i, [hex])),
    },
  },
  {
    key: "connection",
    request: {
      code: "connection",
      name: { ro: "Conectare", ru: "Подключение" },
      dataType: "MultiOption",
      unit: null,
      isFilterable: true,
      showAsSwatches: false,
      options: [
        option("wired", "Cu fir", "Проводное", 0),
        option("bluetooth", "Bluetooth", "Bluetooth", 1),
        option("wireless_2_4ghz", "Wireless 2.4 GHz", "Беспроводное 2.4 ГГц", 2),
      ],
    },
  },
  {
    key: "compatibility",
    request: {
      code: "compatibility",
      name: { ro: "Compatibil cu", ru: "Совместимость" },
      dataType: "MultiOption",
      unit: null,
      isFilterable: true,
      showAsSwatches: false,
      options: [
        option("windows", "Windows", "Windows", 0),
        option("macos", "macOS", "macOS", 1),
        option("linux", "Linux", "Linux", 2),
        option("ios", "iOS", "iOS", 3),
        option("android", "Android", "Android", 4),
      ],
    },
  },
  {
    key: "rgb",
    request: {
      code: "rgb",
      name: { ro: "Iluminare RGB", ru: "RGB-подсветка" },
      dataType: "Boolean",
      unit: null,
      isFilterable: true,
      showAsSwatches: false,
      options: null,
    },
  },
  {
    key: "weight",
    request: {
      code: "weight",
      name: { ro: "Greutate", ru: "Вес" },
      dataType: "Number",
      unit: "g",
      isFilterable: true,
      showAsSwatches: false,
      options: null,
    },
  },
];
