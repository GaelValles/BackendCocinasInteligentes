export const validateSchema = (schema) => (req, res, next) => {
    try {
        // Keep normalized/coerced values produced by Zod transforms.
        req.body = schema.parse(req.body);
        next();
    } catch (error) {
        const details = Array.isArray(error?.errors)
            ? error.errors.map((err) => ({
                path: Array.isArray(err.path) ? err.path.join('.') : '',
                message: err.message
            }))
            : [];

        return res.status(400).json({
            success: false,
            message: error.errors?.map(err => err.message).join(', ') || error.message,
            errors: details
        });
    }
};