import { Router, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { uploadImages, validateFileBuffer, generateSafeFilename } from '../middleware/upload';
import { asyncHandler } from '../middleware/errorHandler';
import { distributedRateLimit } from '../middleware/security.middleware';
import { AuthRequest } from '../types';
import { logger } from '../utils/logger';
import axios from 'axios';
import FormData from 'form-data';

const router = Router();

const uploadRateLimit = distributedRateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: req => `rate:upload:${req.ip}`,
  message: '上传过于频繁，请稍后再试',
});

const BOLTP_API_URL = process.env.BOLTP_API_URL || 'https://www.boltp.com/api/v2/upload';
const BOLTP_STORAGE_ID = parseInt(process.env.BOLTP_STORAGE_ID || '2', 10);
const BOLTP_API_TOKEN = process.env.BOLTP_API_TOKEN || '';

router.post(
  '/images',
  authenticate,
  authorize('merchant'),
  uploadRateLimit,
  uploadImages.array('images', 5),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请选择至少一张图片',
      });
    }

    const urls: string[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        const bufferValidation = validateFileBuffer(file);
        if (!bufferValidation.valid) {
          errors.push(`${file.originalname}: ${bufferValidation.error}`);
          logger.warn(`File buffer validation failed for ${file.originalname}: ${bufferValidation.error}`);
          continue;
        }

        const safeFilename = generateSafeFilename(file.originalname);

        const formData = new FormData();
        formData.append('file', file.buffer, {
          filename: safeFilename,
          contentType: file.mimetype,
        });
        formData.append('storage_id', BOLTP_STORAGE_ID.toString());
        formData.append('is_public_permanent', 'true');

        const response = await axios.post(BOLTP_API_URL, formData, {
          headers: {
            Accept: 'application/json',
            ...(BOLTP_API_TOKEN ? { Authorization: `Bearer ${BOLTP_API_TOKEN}` } : {}),
            ...formData.getHeaders(),
          },
          timeout: 30000,
        });

        if (response.data?.status === 'success' && response.data?.data?.public_url) {
          urls.push(response.data.data.public_url);
        } else {
          errors.push(`${file.originalname}: ${response.data?.message || '上传失败'}`);
          logger.warn(
            `BoltP upload failed for ${file.originalname}: ${JSON.stringify(response.data)}`,
          );
        }
      } catch (error: any) {
        const errMsg = error?.response?.data?.message || error.message || '上传失败';
        errors.push(`${file.originalname}: ${errMsg}`);
        logger.error(`BoltP upload error for ${file.originalname}: ${errMsg}`);
      }
    }

    if (urls.length === 0) {
      return res.status(500).json({
        success: false,
        message: `图片上传失败: ${errors.join('; ')}`,
      });
    }

    logger.info(`${urls.length} images uploaded to BoltP by user ${req.user?.userId}`);

    return res.status(201).json({
      success: true,
      data: { urls },
      message:
        errors.length > 0 ? `${urls.length}张图片上传成功，${errors.length}张失败` : '图片上传成功',
    });
  }),
);

export default router;
