import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';

export const MEDIA_UPLOAD_TEMP_PATH = join(tmpdir(), 'loopkeeper-uploads');

type Callback = (
  error: Error | null,
  info?: { path: string; size: number },
) => void;

// Multer storage engine that streams an upload to a private temporary file
// instead of buffering it in memory. Multer calls _removeFile when the upload
// is aborted (for example when the byte limit is exceeded); the handler removes
// the file after processing.
export class TemporaryFileStorage {
  _handleFile(
    _request: unknown,
    file: { stream: Readable },
    callback: Callback,
  ) {
    mkdir(MEDIA_UPLOAD_TEMP_PATH, { recursive: true }).then(() => {
      const path = join(MEDIA_UPLOAD_TEMP_PATH, randomUUID());
      const output = createWriteStream(path, { flags: 'wx', mode: 0o600 });
      output.on('error', (error) => callback(error));
      output.on('finish', () =>
        callback(null, { path, size: output.bytesWritten }),
      );
      file.stream.pipe(output);
    }, callback);
  }

  _removeFile(
    _request: unknown,
    file: { path?: string },
    callback: (error: Error | null) => void,
  ) {
    if (!file.path) return callback(null);
    rm(file.path, { force: true }).then(() => callback(null), callback);
  }
}
