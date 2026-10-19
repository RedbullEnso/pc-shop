export function createChecker() {
  let pass = 0;
  const failed = [];
  return {
    ok(cond, label, detail) {
      if (cond) pass++; else { failed.push(label); console.log(`  FAIL  ${label}${detail !== undefined ? `  -> ${JSON.stringify(detail)}` : ''}`); }
    },
    done() {
      console.log(`${pass} bestanden, ${failed.length} fehlgeschlagen`);
      process.exitCode = failed.length ? 1 : 0;
    },
  };
}

// Breite/Höhe aus einem JPEG lesen (SOF-Marker), ohne Bibliothek
export function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}
