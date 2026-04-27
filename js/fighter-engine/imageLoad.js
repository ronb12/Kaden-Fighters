/**
 * Loads an image with onerror safe handling; never throws.
 * @param {string} url
 * @param {{ signalAbort?: (() => void) | null }} [opts]
 * @returns {Promise<HTMLImageElement | null>}
 */
export function loadImageSafe(url, opts) {
  if (!url || typeof url !== 'string' || !String(url).trim()) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const img = new Image();
    if (img.decoding) {
      img.decoding = 'async';
    }
    const done = () => {
      try {
        if (opts && opts.signalAbort) opts.signalAbort();
      } catch (_) {
        /* ignore */
      }
    };
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        done();
        resolve(img);
      } else {
        done();
        resolve(null);
      }
    };
    img.onerror = () => {
      done();
      resolve(null);
    };
    try {
      img.crossOrigin = 'anonymous';
    } catch (_) {
      /* ignore */
    }
    try {
      img.src = url;
    } catch {
      done();
      resolve(null);
    }
  });
}
