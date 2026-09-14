import { z } from 'zod';
import { asyncHandler, ApiError } from '../core/ApiError.js';
import { upstreamAuthService } from '../services/UpstreamAuthService.js';
import { User } from '../models/User.js';
import { issueSessionToken } from '../middleware/auth.js';
import { config } from '../config/env.js';

const credentials = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

const cookieOptions = {
  httpOnly: true,
  sameSite: config.isProd ? 'none' : 'lax',
  secure: config.isProd,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

export class AuthController {
  login = asyncHandler(async (req, res) => {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest('Check the sign-in form', parsed.error.flatten().fieldErrors);

    const { email, password } = parsed.data;
    const verified = await upstreamAuthService.verifyCredentials(email, password);
    const user = await User.recordLogin(verified.email);
    const token = issueSessionToken(user);

    res.cookie('session', token, cookieOptions);
    res.json({ token, user: user.toPublic() });
  });

  me = asyncHandler(async (req, res) => {
    res.json({ user: req.user.toPublic() });
  });

  logout = asyncHandler(async (_req, res) => {
    res.clearCookie('session', { ...cookieOptions, maxAge: undefined });
    res.status(204).end();
  });
}

export const authController = new AuthController();
