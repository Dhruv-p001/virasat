/**
 * Version of the consent wording shown before recording (i18n keys `consent.*`, docs/consent.md).
 * Recorded with every consent. Any change to what the wording promises needs a new version, so
 * each stored consent points at the exact text the person agreed to.
 */
export const CONSENT_WORDING_VERSION = "2026-11-v1";

/** Longest single recording: enough for one recipe told slowly. Recording stops here. */
export const MAX_RECORDING_SECONDS = 10 * 60;

// Upload limits enforced by begin_capture() and the storage buckets (migration capture_and_recipes).
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
export const MAX_SCAN_BYTES = 20 * 1024 * 1024;
