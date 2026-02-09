import jwt from 'jsonwebtoken';
import { TOKEN_SECRET } from '../config.js';

export const authRequired =(req, res, next) => {
    const token = req.cookies.token;
    
    console.log("Token:", token);

    if(!token)
        return res.status(401).json({message: 'No token provided'});

    jwt.verify(token, TOKEN_SECRET, (err, admin) => {
        if(err) return res.status(403).json({message: 'Invalid token'});
        console.log(admin);
        req.admin = admin;

        next();
    })
    
}