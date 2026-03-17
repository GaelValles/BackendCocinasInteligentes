import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

// Configurar DigitalOcean Spaces (compatible con S3)
const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com');

export const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
    // Esta configuración permite escalar fácilmente a AWS S3 cambiando solo las credenciales
    signatureVersion: 'v4',
    s3ForcePathStyle: false
});

export const BUCKET_NAME = process.env.DO_SPACES_BUCKET || 'kuche-files';

/**
 * Subir archivo a DigitalOcean Spaces
 * @param {Buffer} fileBuffer - Buffer del archivo
 * @param {string} fileName - Nombre del archivo
 * @param {string} mimeType - Tipo MIME del archivo
 * @param {string} folder - Carpeta de destino (ej: 'tareas', 'proyectos', 'renders')
 * @returns {Promise<Object>} Objeto con url y key del archivo subido
 */
export async function uploadFile(fileBuffer, fileName, mimeType, folder = 'general') {
    try {
        // Generar un nombre único para el archivo
        const timestamp = Date.now();
        const uniqueFileName = `${folder}/${timestamp}-${fileName}`;

        const params = {
            Bucket: BUCKET_NAME,
            Key: uniqueFileName,
            Body: fileBuffer,
            ACL: 'public-read', // Hacer el archivo público
            ContentType: mimeType,
            Metadata: {
                uploadedAt: new Date().toISOString()
            }
        };

        console.log('Subiendo archivo a DigitalOcean Spaces:', uniqueFileName);
        
        const result = await s3.upload(params).promise();
        
        console.log('Archivo subido exitosamente:', result.Key);
        
        return {
            url: result.Location,
            key: result.Key,
            bucket: result.Bucket
        };
        
    } catch (error) {
        console.error('Error al subir archivo a DigitalOcean Spaces:', error);
        throw new Error('Error al subir archivo: ' + error.message);
    }
}

/**
 * Eliminar archivo de DigitalOcean Spaces
 * @param {string} fileKey - Key del archivo a eliminar
 * @returns {Promise<boolean>} true si se eliminó correctamente
 */
export async function deleteFile(fileKey) {
    try {
        const params = {
            Bucket: BUCKET_NAME,
            Key: fileKey
        };

        console.log('Eliminando archivo de DigitalOcean Spaces:', fileKey);
        
        await s3.deleteObject(params).promise();
        
        console.log('Archivo eliminado exitosamente:', fileKey);
        
        return true;
        
    } catch (error) {
        console.error('Error al eliminar archivo:', error);
        throw new Error('Error al eliminar archivo: ' + error.message);
    }
}

/**
 * Obtener URL firmada temporal para acceso privado
 * @param {string} fileKey - Key del archivo
 * @param {number} expiresIn - Tiempo de expiración en segundos (default: 1 hora)
 * @returns {Promise<string>} URL firmada
 */
export async function getSignedUrl(fileKey, expiresIn = 3600) {
    try {
        const params = {
            Bucket: BUCKET_NAME,
            Key: fileKey,
            Expires: expiresIn
        };

        const url = await s3.getSignedUrlPromise('getObject', params);
        
        return url;
        
    } catch (error) {
        console.error('Error al generar URL firmada:', error);
        throw new Error('Error al generar URL firmada: ' + error.message);
    }
}

/**
 * Validar tipo de archivo permitido
 * @param {string} mimeType - Tipo MIME del archivo
 * @param {Array<string>} allowedTypes - Tipos permitidos
 * @returns {boolean} true si el tipo es válido
 */
export function validateFileType(mimeType, allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']) {
    return allowedTypes.includes(mimeType);
}

/**
 * Validar tamaño de archivo
 * @param {number} fileSize - Tamaño del archivo en bytes
 * @param {number} maxSize - Tamaño máximo permitido en MB (default: 10MB)
 * @returns {boolean} true si el tamaño es válido
 */
export function validateFileSize(fileSize, maxSize = 10) {
    const maxSizeBytes = maxSize * 1024 * 1024;
    return fileSize <= maxSizeBytes;
}
