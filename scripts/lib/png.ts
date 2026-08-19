/**
 * 외부 라이브러리 없는 최소 PNG 인코더.
 *
 * 아이콘 생성과 배경 생성이 같은 인코더를 쓴다. 두 벌로 두면 한쪽만 고쳐져
 * 같은 도트가 파일마다 다르게 나오는 일이 생긴다.
 */
import { deflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (buffer: Buffer): number => {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Buffer): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
};

/** RGBA 픽셀 배열을 PNG로 인코딩한다. */
export const encodePng = (width: number, height: number, rgba: Uint8Array): Buffer => {
  // 각 줄 앞에 필터 바이트(0 = 필터 없음)를 넣는다.
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width * 4; x += 1) {
      raw[rowStart + 1 + x] = rgba[y * width * 4 + x]!;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 비트 깊이
  ihdr[9] = 6; // 색 유형 6 = RGBA
  ihdr[10] = 0; // 압축
  ihdr[11] = 0; // 필터
  ihdr[12] = 0; // 인터레이스 없음

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG 서명
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

/** `#rrggbb`를 RGB 세 값으로 나눈다. */
export const hexToRgb = (hex: string): [number, number, number] => {
  const value = parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
};

/**
 * 정수 배율 nearest-neighbor 확대.
 *
 * 원본 픽셀 하나를 `scale`×`scale` 칸으로 그대로 복제한다. 보간이 없으므로
 * 도트 경계가 그대로 남는다 (계획서 4.6).
 */
export const upscaleNearest = (
  width: number,
  height: number,
  rgba: Uint8Array,
  scale: number,
): { width: number; height: number; rgba: Uint8Array } => {
  if (!Number.isInteger(scale) || scale < 1) {
    throw new Error(`정수 배율만 허용합니다: ${scale}`);
  }
  const outWidth = width * scale;
  const outHeight = height * scale;
  const out = new Uint8Array(outWidth * outHeight * 4);

  for (let y = 0; y < outHeight; y += 1) {
    const sourceY = Math.floor(y / scale);
    for (let x = 0; x < outWidth; x += 1) {
      const sourceX = Math.floor(x / scale);
      const from = (sourceY * width + sourceX) * 4;
      const to = (y * outWidth + x) * 4;
      out[to] = rgba[from]!;
      out[to + 1] = rgba[from + 1]!;
      out[to + 2] = rgba[from + 2]!;
      out[to + 3] = rgba[from + 3]!;
    }
  }

  return { width: outWidth, height: outHeight, rgba: out };
};
