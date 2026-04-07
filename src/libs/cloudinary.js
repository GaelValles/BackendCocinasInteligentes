import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

const assertCloudinaryConfigured = () => {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        throw new Error('Cloudinary no configurado: faltan CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY o CLOUDINARY_API_SECRET');
    }
};

const sanitizeFileName = (fileName = '') => String(fileName || 'archivo.bin').replace(/[^a-zA-Z0-9._-]/g, '_');

const uploadBufferAsRaw = async (buffer, options) => new Promise((resolve, reject) => {
    const uploader = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error) {
            reject(error);
            return;
        }
        resolve(result);
    });

    uploader.end(buffer);
});

export async function uploadFileToCloudinary(fileBuffer, fileName, mimeType, folder = 'general') {
    assertCloudinaryConfigured();

    const safeName = sanitizeFileName(fileName);
    const uploadResult = await uploadBufferAsRaw(fileBuffer, {
        folder: `kuche/${String(folder || 'general').replace(/^\/|\/$/g, '')}`,
        resource_type: 'raw',
        use_filename: true,
        unique_filename: true,
        filename_override: safeName,
        invalidate: true
    });

    return {
        provider: 'cloudinary',
        key: `cloudinary:${uploadResult.public_id}`,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        mimeType: mimeType || null
    };
}

export async function deleteFileFromCloudinary(prefixedKey) {
    assertCloudinaryConfigured();

    const publicId = String(prefixedKey || '').replace(/^cloudinary:/, '').trim();
    if (!publicId) {
        throw new Error('Key de Cloudinary inválida');
    }

    const rawResult = await cloudinary.uploader.destroy(publicId, { resource_type: 'raw', invalidate: true });
    if (rawResult.result === 'ok' || rawResult.result === 'not found') {
        return true;
    }

    const imageResult = await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
    if (imageResult.result === 'ok' || imageResult.result === 'not found') {
        return true;
    }

    throw new Error(`No se pudo eliminar archivo en Cloudinary (${rawResult.result || imageResult.result || 'unknown'})`);
}