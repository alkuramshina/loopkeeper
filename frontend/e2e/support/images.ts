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
