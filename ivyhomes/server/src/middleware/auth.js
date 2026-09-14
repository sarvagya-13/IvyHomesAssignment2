import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { ApiError } from '../core/ApiError.js';
import { User } from '../models/User.js';

export const issueSessionToken = (user) => jwt.sign(
  { sub: user._id.toString(), email: user.email },
  config.jwt.secret,
  { expiresIn: config.jwt.expiresIn },
);

/**
 * Accepts the session token from either the Authorization header or the
 * httpOnly cookie, so a page refresh restores the session without the SPA
 * having to keep the token anywhere a script can reach.
 */
export const requireAuth = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.session;
    if (!token) throw ApiError.unauthorised('Sign in to continue');

    let claims;
    try {
      claims = jwt.verify(token, config.jwt.secret);
    } catch {
      throw ApiError.unauthorised('Your session has expired. Please sign in again.');
    }

    const user = await User.findById(claims.sub);
    if (!user) throw ApiError.unauthorised('That account no longer exists');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
