const transliteration: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "i", к: "k", л: "l",
  м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "iu", я: "ia", ă: "a", â: "a", î: "i", ș: "s", ş: "s", ț: "t", ţ: "t",
};

export function transliterate(text: string): string {
  return [...text.toLowerCase()].map((c) => transliteration[c] ?? c).join("");
}

function words(text: string): string[] {
  return transliterate(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function toSlug(text: string, maxLength = 120): string {
  return words(text).join("-").slice(0, maxLength).replace(/-+$/, "");
}

export function toCode(text: string, maxLength = 50): string {
  const code = words(text).join("_").replace(/^[0-9_]+/, "").slice(0, maxLength).replace(/_+$/, "");
  return code;
}

export function toSkuPart(text: string): string {
  return words(text).join("-").toUpperCase();
}
