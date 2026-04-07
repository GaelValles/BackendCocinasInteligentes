import dotenv from 'dotenv';

dotenv.config();

const DROPBOX_TOKEN = process.env.DROPBOX_ACCESS_TOKEN;
const DROPBOX_ROOT_PATH = process.env.DROPBOX_ROOT_PATH || '/kuche-files';
const DEBUG_DROPBOX = String(process.env.DEBUG_DROPBOX || 'false').toLowerCase() === 'true';

const API_BASE = 'https://api.dropboxapi.com/2';
const CONTENT_BASE = 'https://content.dropboxapi.com/2';

const safeParseDropboxBody = (text) => {
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
};

const assertDropboxConfigured = () => {
    if (!DROPBOX_TOKEN) {
        throw new Error('Dropbox no configurado: falta DROPBOX_ACCESS_TOKEN');
    }
};

const buildDropboxPath = (folder, fileName) => {
    const safeFolder = String(folder || 'general').replace(/^\/+|\/+$/g, '');
    const safeRoot = DROPBOX_ROOT_PATH.startsWith('/') ? DROPBOX_ROOT_PATH : `/${DROPBOX_ROOT_PATH}`;
    const safeFileName = String(fileName || 'archivo.bin').replace(/[\\/]/g, '_');
    return `${safeRoot}/${safeFolder}/${Date.now()}-${safeFileName}`;
};

const dropboxApi = async (path, body) => {
    const response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${DROPBOX_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body || {})
    });

    const text = await response.text();
    const json = safeParseDropboxBody(text);

    if (!response.ok) {
        const error = new Error(`Dropbox API error (${response.status})`);
        error.details = json;
        throw error;
    }

    return json;
};

const toDirectDownloadUrl = (sharedUrl) => {
    if (!sharedUrl) return '';
    // Keep compatibility with Dropbox default share URL and turn into direct-ish download URL.
    return sharedUrl
        .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
        .replace('?dl=0', '');
};

const ensureSharedLink = async (dropboxPath) => {
    try {
        const created = await dropboxApi('/sharing/create_shared_link_with_settings', {
            path: dropboxPath
        });
        return created.url;
    } catch (error) {
        const tag = error?.details?.error?.['.tag'];
        if (tag !== 'shared_link_already_exists') {
            throw error;
        }

        const links = await dropboxApi('/sharing/list_shared_links', {
            path: dropboxPath,
            direct_only: true
        });

        return links?.links?.[0]?.url || '';
    }
};

/**
 * Upload file to Dropbox.
 */
export async function uploadFileToDropbox(fileBuffer, fileName, folder = 'general') {
    assertDropboxConfigured();

    const requestedDropboxPath = buildDropboxPath(folder, fileName);
    const response = await fetch(`${CONTENT_BASE}/files/upload`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${DROPBOX_TOKEN}`,
            'Content-Type': 'application/octet-stream',
            'Dropbox-API-Arg': JSON.stringify({
                path: requestedDropboxPath,
                mode: 'add',
                autorename: true,
                mute: false,
                strict_conflict: false
            })
        },
        body: fileBuffer
    });

    const text = await response.text();
    const json = safeParseDropboxBody(text);

    if (!response.ok) {
        const error = new Error(`Dropbox upload error (${response.status})`);
        error.details = json;
        throw error;
    }

    const uploadedDropboxPath = json?.path_display || json?.path_lower;
    if (!uploadedDropboxPath) {
        const error = new Error('Dropbox upload sin path de confirmacion');
        error.details = json;
        throw error;
    }

    // Confirmar que el archivo exista realmente en Dropbox antes de devolver key/url.
    await dropboxApi('/files/get_metadata', { path: uploadedDropboxPath });

    if (DEBUG_DROPBOX && requestedDropboxPath !== uploadedDropboxPath) {
        console.info('[DROPBOX][autorename]', {
            requestedDropboxPath,
            uploadedDropboxPath
        });
    }

    const sharedUrl = await ensureSharedLink(uploadedDropboxPath);
    if (!sharedUrl) {
        throw new Error('Dropbox no devolvio shared link para el archivo subido');
    }

    return {
        provider: 'dropbox',
        key: `dropbox:${uploadedDropboxPath}`,
        dropboxPath: uploadedDropboxPath,
        url: toDirectDownloadUrl(sharedUrl) || sharedUrl
    };
}

/**
 * Delete Dropbox file by prefixed key (dropbox:/path/to/file)
 */
export async function deleteFileFromDropbox(prefixedKey) {
    assertDropboxConfigured();

    const rawPath = String(prefixedKey || '').replace(/^dropbox:/, '');
    if (!rawPath || !rawPath.startsWith('/')) {
        throw new Error('Key de Dropbox inválida');
    }

    await dropboxApi('/files/delete_v2', { path: rawPath });
    return true;
}
