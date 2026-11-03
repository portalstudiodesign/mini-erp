const CUI_KEY = [7, 5, 3, 2, 1, 7, 5, 3, 2];

/** Normalizează un CUI ("ro 14399840" -> "RO14399840") fără să-l valideze. */
export function normalizeCui(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

/**
 * Validează cifra de control a unui CUI/CIF românesc (cu sau fără prefixul RO).
 * Algoritm ANAF: cifrele fără ultima, completate la stânga cu zero până la 9,
 * se înmulțesc cu cheia 753217532; (suma * 10) % 11, iar 10 devine 0.
 */
export function isValidCui(input: string): boolean {
  const digits = normalizeCui(input).replace(/^RO/, "");
  if (!/^\d{2,10}$/.test(digits)) return false;

  const control = Number(digits.at(-1));
  const body = digits.slice(0, -1).padStart(9, "0");
  const sum = [...body].reduce((acc, d, i) => acc + Number(d) * CUI_KEY[i]!, 0);
  const expected = ((sum * 10) % 11) % 10;
  return expected === control;
}
