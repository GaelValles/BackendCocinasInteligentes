export default function responseWrapper(req, res, next) {
    const originalJson = res.json.bind(res);

    res.json = (payload) => {
        try {
            // If controller already returned envelope (has boolean success), pass through
            if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'success')) {
                return originalJson(payload);
            }

            const status = res.statusCode || 200;

            // For errors (HTTP >= 400) ensure success: false
            if (status >= 400) {
                // payload might be { message: '', error: ... } or any structure
                const out = { success: false };
                if (payload && typeof payload === 'object') {
                    if (payload.message) out.message = payload.message;
                    if (payload.error) out.error = payload.error;
                    // include other props under data if present
                    const rest = Object.assign({}, payload);
                    delete rest.message;
                    delete rest.error;
                    if (Object.keys(rest).length) out.data = rest;
                } else {
                    out.message = String(payload);
                }
                return originalJson(out);
            }

            // Successful responses -> wrap as { success: true, data: payload }
            return originalJson({ success: true, data: payload });
        } catch (e) {
            // Fallback: ensure we never crash the response
            return originalJson({ success: false, message: 'Error envolviendo la respuesta', error: e.message });
        }
    };

    next();
}
