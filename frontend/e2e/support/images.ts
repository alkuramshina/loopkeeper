import sharp from 'sharp';

/** A solid PNG of the given size; enough for the media pipeline's checks. */
export async function png(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: '#39726a' },
  })
    .png()
    .toBuffer();
}

export async function pngFile(width: number, height: number) {
  return {
    name: `${width}x${height}.png`,
    mimeType: 'image/png',
    buffer: await png(width, height),
  };
}

type Format = 'png' | 'jpeg' | 'webp';

export async function imageFile(width: number, height: number, format: Format) {
  const image = sharp({
    create: { width, height, channels: 3, background: '#436b9c' },
  });
  return {
    name: `${width}x${height}.${format === 'jpeg' ? 'jpg' : format}`,
    mimeType: `image/${format}`,
    buffer: await image.toFormat(format).toBuffer(),
  };
}

/** A file with a PNG signature padded to `bytes`; the size check runs before decoding. */
export function oversizedPng(bytes: number) {
  const buffer = Buffer.alloc(bytes);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  return { name: 'huge.png', mimeType: 'image/png', buffer };
}

/** Plain text pretending to be a PNG. */
export function fakePng() {
  return {
    name: 'fake.png',
    mimeType: 'image/png',
    buffer: Buffer.from('this is not an image'),
  };
}

export function svgFile() {
  return {
    name: 'map.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1500"/>',
    ),
  };
}
