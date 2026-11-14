/** Default per-request ceiling; a hung request must fail instead of spinning forever. */
export const API_REQUEST_TIMEOUT_MS = 30_000
/** Ceiling for file uploads, which legitimately take longer on slow links. */
export const API_UPLOAD_TIMEOUT_MS = 120_000
