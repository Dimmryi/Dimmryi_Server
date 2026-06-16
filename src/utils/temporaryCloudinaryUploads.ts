import { v2 as cloudinary } from 'cloudinary';
import TemporaryCloudinaryUploadModel from '../models/TemporaryCloudinaryUploadModel';

const DEFAULT_CLEANUP_AGE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CLEANUP_BATCH_SIZE = 50;
const MAX_CLEANUP_ATTEMPTS = 3;

type ResourceType = 'image' | 'video';

const normalizeResourceType = (value: unknown): ResourceType => (value === 'video' ? 'video' : 'image');

export const getCloudinaryPublicIdFromUrl = (url: unknown) => {
    if (typeof url !== 'string') return '';

    const uploadIndex = url.indexOf('/upload/');
    if (uploadIndex === -1) return '';

    const afterUpload = url.slice(uploadIndex + '/upload/'.length).split('?')[0];
    const withoutTransforms = afterUpload.replace(/^(?:[^/]+\/)*v\d+\//, '');
    return withoutTransforms.replace(/\.[^/.]+$/, '');
};

const normalizeStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
    }

    return typeof value === 'string' && value.trim() !== '' ? [value] : [];
};

const getPublicIdsFromListing = (listing: any) => {
    const imageIds = normalizeStringArray(listing?.image)
        .map(getCloudinaryPublicIdFromUrl)
        .filter(Boolean)
        .map((publicId) => ({ publicId, resourceType: 'image' as ResourceType }));

    const videoIds = normalizeStringArray(listing?.video)
        .concat(normalizeStringArray(listing?.videoUrl))
        .map(getCloudinaryPublicIdFromUrl)
        .filter(Boolean)
        .map((publicId) => ({ publicId, resourceType: 'video' as ResourceType }));

    return [...imageIds, ...videoIds];
};

export const markTemporaryUploadsCommittedForListing = async (listing: any, userId?: string) => {
    const ownerId = userId || String(listing?.ownerId || '');
    if (!ownerId) return;

    const assets = getPublicIdsFromListing(listing);
    if (assets.length === 0) return;

    const now = new Date();
    await Promise.all(
        assets.map(({ publicId, resourceType }) =>
            TemporaryCloudinaryUploadModel.updateOne(
                { userId: ownerId, publicId, resourceType, status: 'pending' },
                {
                    $set: {
                        status: 'committed',
                        committedAt: now,
                        listingId: String(listing?._id || ''),
                        lastCleanupError: '',
                    },
                },
            ),
        ),
    );
};

export const cleanupTemporaryCloudinaryUploads = async () => {
    const ageMs = Math.max(60 * 60 * 1000, Number(process.env.TEMP_UPLOAD_CLEANUP_AGE_MS) || DEFAULT_CLEANUP_AGE_MS);
    const batchSize = Math.min(200, Math.max(1, Number(process.env.TEMP_UPLOAD_CLEANUP_BATCH_SIZE) || DEFAULT_CLEANUP_BATCH_SIZE));
    const cutoff = new Date(Date.now() - ageMs);

    const uploads = await TemporaryCloudinaryUploadModel.find({
        status: 'pending',
        createdAt: { $lte: cutoff },
        cleanupAttempts: { $lt: MAX_CLEANUP_ATTEMPTS },
    })
        .sort({ createdAt: 1 })
        .limit(batchSize);

    for (const upload of uploads) {
        try {
            const resourceType = normalizeResourceType(upload.get('resourceType'));
            const result = await cloudinary.uploader.destroy(upload.get('publicId'), { resource_type: resourceType });
            const cloudinaryResult = String(result?.result || '');

            if (cloudinaryResult === 'ok' || cloudinaryResult === 'not found') {
                await upload.updateOne({
                    $set: {
                        status: 'deleted',
                        deletedAt: new Date(),
                        lastCleanupError: '',
                    },
                    $inc: { cleanupAttempts: 1 },
                });
                continue;
            }

            const nextAttempts = Number(upload.get('cleanupAttempts') || 0) + 1;
            await upload.updateOne({
                $set: {
                    status: nextAttempts >= MAX_CLEANUP_ATTEMPTS ? 'cleanupFailed' : 'pending',
                    lastCleanupError: `Cloudinary result: ${cloudinaryResult || 'unknown'}`,
                },
                $inc: { cleanupAttempts: 1 },
            });
        } catch (error) {
            const nextAttempts = Number(upload.get('cleanupAttempts') || 0) + 1;
            await upload.updateOne({
                $set: {
                    status: nextAttempts >= MAX_CLEANUP_ATTEMPTS ? 'cleanupFailed' : 'pending',
                    lastCleanupError: error instanceof Error ? error.message : String(error),
                },
                $inc: { cleanupAttempts: 1 },
            });
        }
    }
};

export const startTemporaryUploadsCleanupJob = () => {
    const intervalMs = Math.max(60 * 60 * 1000, Number(process.env.TEMP_UPLOAD_CLEANUP_INTERVAL_MS) || DEFAULT_CLEANUP_INTERVAL_MS);

    const runCleanup = () => {
        cleanupTemporaryCloudinaryUploads().catch((error) => {
            console.error('Temporary Cloudinary upload cleanup failed:', error);
        });
    };

    const initialDelay = Math.min(5 * 60 * 1000, intervalMs);
    const initialTimer = setTimeout(runCleanup, initialDelay);
    const intervalTimer = setInterval(runCleanup, intervalMs);

    initialTimer.unref?.();
    intervalTimer.unref?.();

    return () => {
        clearTimeout(initialTimer);
        clearInterval(intervalTimer);
    };
};
