export const validateSchema= (schema) => {
    try {
        schema.parse(req.body);
        next();
    } catch (error) {
        return res.status(400).json({
            message: error.errors.map(err => err.message).join(', ')
        });
    }
}