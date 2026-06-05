import multer from 'multer';
import { Request } from 'express';
import path from 'path';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const MAGIC_BYTES: Record<string, { offset: number; bytes: number[] }> = {
  'image/jpeg': { offset: 0, bytes: [0xff, 0xd8] },
  'image/png': { offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] },
  'image/gif': { offset: 0, bytes: [0x47, 0x49, 0x46] },
  'image/webp': { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
};

function verifyMagicBytes(buffer: Buffer, mimetype: string): boolean {
  const signature = MAGIC_BYTES[mimetype];
  if (!signature) return false;
  if (buffer.length < signature.offset + signature.bytes.length) return false;
  return signature.bytes.every(
    (byte, i) => buffer[signature.offset + i] === byte,
  );
}

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    cb(new Error(`不支持的文件扩展名: ${ext || '(无)'}`));
    return;
  }

  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    cb(new Error(`不支持的文件类型: ${file.mimetype}`));
    return;
  }

  cb(null, true);
};

export const uploadImages = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
});

export function validateFileBuffer(
  file: Express.Multer.File,
): { valid: boolean; error?: string } {
  if (!file.buffer || file.buffer.length === 0) {
    return { valid: false, error: '文件内容为空' };
  }

  if (!verifyMagicBytes(file.buffer, file.mimetype)) {
    return { valid: false, error: `文件内容与声明的类型 ${file.mimetype} 不匹配` };
  }

  return { valid: true };
}

export function generateSafeFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}${ext}`;
}
