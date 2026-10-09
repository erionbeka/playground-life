/**
 * Canonical, grant-safe positioning copy.
 *
 * PLAYGROUND is an original guided-play developmental platform. It uses
 * augmentative and alternative communication (AAC) principles so a child can
 * take part without relying on speech, but it must never be described as an
 * AAC system itself, nor as a diagnostic or therapeutic instrument.
 */
export const AAC_POSITIONING = {
  label: "AAC-enabled",
  short: "AAC-supported",
  full: "PLAYGROUND is AAC-enabled and AAC-supported: a child can request, choose, comment and take part through symbols, pictures, recorded or generated speech, gestures, touch, a switch, or a dwell pointer.",
  boundary:
    "PLAYGROUND supports communication within play. It is not a substitute for a full AAC system, a speech-language assessment, or therapy, and communication support should be individualised with a clinician.",
  responseModesLine:
    "Answer any way that works — tap, point, spoken word, choose a symbol, use a switch, or dwell.",
} as const;
