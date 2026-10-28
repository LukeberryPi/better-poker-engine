/** PHH variant codes, as pokerkit's `HandHistory.game_types` names its games. */
export const variantCodes = [
  "FT",
  "NT",
  "NS",
  "PO",
  "FO/8",
  "F7S",
  "F7S/8",
  "FR",
  "N2L1D",
  "F2L3D",
  "FB",
] as const;

export type VariantCode = (typeof variantCodes)[number];
