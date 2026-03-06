/**
 * generate-icons.ts
 *
 * Generates minimal valid PNG icons for PWA manifest.
 * Creates solid purple (#7c3aed) squares at 192x192 and 512x512.
 * Uses only Node.js built-in modules (no external dependencies).
 */

import { writeFileSync } from "fs";
import { mkdirSync } from "fs";
import { deflateSync } from "zlib";

const BRAND_COLOR = { r: 0x7c, g: 0x3a, b: 0xed };

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBuffer, data]);
  const crcValue = Buffer.alloc(4);
  crcValue.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([length, typeBuffer, data, crcValue]);
}

function generatePng(size: number): Buffer {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk: width, height, bit depth (8), color type (2 = RGB)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0); // width
  ihdrData.writeUInt32BE(size, 4); // height
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: RGB
  ihdrData[10] = 0; // compression method
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace method
  const ihdr = createChunk("IHDR", ihdrData);

  // IDAT chunk: raw image data
  // Each row: filter byte (0 = None) + RGB pixels
  const rowSize = 1 + size * 3;
  const rawData = Buffer.alloc(rowSize * size);

  // Draw a simple "L" letter on the purple background
  const letterSize = Math.floor(size * 0.5);
  const offsetX = Math.floor((size - letterSize) / 2);
  const offsetY = Math.floor((size - letterSize) / 2);
  const strokeWidth = Math.max(Math.floor(size * 0.1), 2);

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // filter byte: None

    for (let x = 0; x < size; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;

      // Check if this pixel is part of the "L" letter
      const inVerticalBar =
        x >= offsetX &&
        x < offsetX + strokeWidth &&
        y >= offsetY &&
        y < offsetY + letterSize;
      const inHorizontalBar =
        x >= offsetX &&
        x < offsetX + letterSize &&
        y >= offsetY + letterSize - strokeWidth &&
        y < offsetY + letterSize;

      if (inVerticalBar || inHorizontalBar) {
        // White letter
        rawData[pixelOffset] = 0xff;
        rawData[pixelOffset + 1] = 0xff;
        rawData[pixelOffset + 2] = 0xff;
      } else {
        // Brand purple background
        rawData[pixelOffset] = BRAND_COLOR.r;
        rawData[pixelOffset + 1] = BRAND_COLOR.g;
        rawData[pixelOffset + 2] = BRAND_COLOR.b;
      }
    }
  }

  const compressed = deflateSync(rawData);
  const idat = createChunk("IDAT", compressed);

  // IEND chunk
  const iend = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

async function main() {
  const outDir = new URL("../public/icons", import.meta.url).pathname;

  try {
    mkdirSync(outDir, { recursive: true });
  } catch {
    // directory already exists
  }

  const sizes = [192, 512] as const;

  for (const size of sizes) {
    const png = generatePng(size);
    const filePath = `${outDir}/icon-${size}.png`;
    writeFileSync(filePath, png);
    console.log(`Generated ${filePath} (${png.length} bytes)`);
  }

  console.log("Done. PWA icons generated successfully.");
}

main().catch(console.error);
