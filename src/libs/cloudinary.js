import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
    cloud_name: "dftu2fjzj",
    api_key: "946929268796721",
    api_secret: "mQ0AiZEdxcmd7RLyhOB2KclWHQA",
    secured: true,
});

// Función para subir certificados PDF
export async function uploadCertificado(filePath) {
    try {
        console.log('Subiendo archivo a Cloudinary:', filePath);
        
        const result = await cloudinary.uploader.upload(filePath, {
            folder: "certificados",
            resource_type: "raw", // Importante para PDFs
            allowed_formats: ["pdf"], // Solo permitir PDFs
            public_id_prefix: "cert_", // Prefijo para identificar certificados
            use_filename: true,
            unique_filename: true,
        });
        
        console.log('Archivo subido exitosamente a Cloudinary:', result.public_id);
        return result;
        
    } catch (error) {
        console.error('Error en uploadCertificado:', error);
        throw new Error('Error al subir archivo a Cloudinary: ' + error.message);
    }
}