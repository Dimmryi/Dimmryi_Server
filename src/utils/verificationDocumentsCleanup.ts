import { v2 as cloudinary } from 'cloudinary';
import VerificationRequestModel from '../models/VerificationRequestModel';

type VerificationFile = {
    publicId?: string | null;
    resourceType?: string | null;
};

const normalizeResourceType = (value?: string | null) => {
    if (value === 'video' || value === 'raw') return value;
    return 'image';
};

const destroyVerificationFiles = async (files: VerificationFile[]) => {
    const filesWithPublicId = files.filter((file) => file.publicId);

    const results = await Promise.allSettled(
        filesWithPublicId.map((file) =>
            cloudinary.uploader.destroy(file.publicId as string, {
                resource_type: normalizeResourceType(file.resourceType),
                invalidate: true,
            })
        )
    );

    const rejected = results.filter((result) => result.status === 'rejected');
    if (rejected.length > 0) {
        throw new Error(`Failed to delete ${rejected.length} verification document(s) from Cloudinary.`);
    }
};

export const deleteVerificationDocumentsForListings = async (listingIds: string[]) => {
    const ids = listingIds.filter(Boolean);
    if (ids.length === 0) return { deletedRequests: 0, deletedFiles: 0 };

    const requests = await VerificationRequestModel.find({ listingId: { $in: ids } }).lean();
    const files = requests.flatMap((request) => request.files || []);

    await destroyVerificationFiles(files);
    const deletedRequests = await VerificationRequestModel.deleteMany({ listingId: { $in: ids } });

    return {
        deletedRequests: deletedRequests.deletedCount || 0,
        deletedFiles: files.filter((file) => file.publicId).length,
    };
};

export const deleteVerificationDocumentsForUser = async (userId: string) => {
    if (!userId) return { deletedRequests: 0, deletedFiles: 0 };

    const requests = await VerificationRequestModel.find({ userId }).lean();
    const files = requests.flatMap((request) => request.files || []);

    await destroyVerificationFiles(files);
    const deletedRequests = await VerificationRequestModel.deleteMany({ userId });

    return {
        deletedRequests: deletedRequests.deletedCount || 0,
        deletedFiles: files.filter((file) => file.publicId).length,
    };
};
