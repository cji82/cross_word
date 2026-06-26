(function () {
  const key = String.fromCharCode(
    99, 119, 50, 48, 50, 54, 58, 104, 97, 110, 103, 117, 108, 45, 120, 119, 111, 114, 100
  );

  function decodePayload(payload) {
    const raw = atob(payload);
    const keyBytes = new TextEncoder().encode(key);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) {
      bytes[i] = raw.charCodeAt(i) ^ keyBytes[i % keyBytes.length];
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  if (typeof __CW === 'undefined') {
    throw new Error('category payload missing');
  }

  const CATEGORIES = decodePayload(__CW);
  window.CATEGORIES = CATEGORIES;
})();
