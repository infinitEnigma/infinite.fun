import { Router, type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import busboy from 'busboy';

export const uploadRouter = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

// Ensure upload dir exists
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

uploadRouter.post('/', (req: Request, res: Response) => {
  const bb = busboy({ headers: req.headers, limits: { fileSize: MAX_FILE_SIZE, files: 1 } });
  let saved = false;

  bb.on('file', (_field, file, info) => {
    const { mimeType } = info;
    if (!ALLOWED_TYPES.has(mimeType)) {
      file.resume();
      res.status(400).json({ error: 'Invalid file type' });
      return;
    }

    const ext = mimeType.split('/')[1].replace('jpeg', 'jpg');
    const filename = `${crypto.randomUUID()}.${ext}`;
    const dest = path.join(UPLOAD_DIR, filename);
    const stream = fs.createWriteStream(dest);

    file.pipe(stream);
    file.on('limit', () => {
      stream.destroy();
      fs.unlinkSync(dest);
      res.status(413).json({ error: 'File too large (max 2 MB)' });
    });

    stream.on('close', () => {
      if (!saved && !res.headersSent) {
        saved = true;
        const baseUrl = process.env.IMAGES_BASE_URL ?? '/images';
        res.json({ url: `${baseUrl}/${filename}` });
      }
    });
  });

  bb.on('error', (err: Error) => {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  });

  req.pipe(bb);
});
