import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";

/**
 * Limiters for the endpoints that can be called without a session.
 *
 * The global limiter allows 300 requests per 15 minutes, which is generous
 * for an app but useless against someone guessing a password one attempt at
 * a time. These limiters are per client address and much tighter.
 *
 * The sign-in limiter only counts failed attempts. A clinic that shares one
 * address behind a router would otherwise lock its own staff out, while a
 * run of failures is the only pattern worth throttling.
 */

const message = (error: string) => ({ error });

export const signInLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: message("Too many failed sign-in attempts. Wait a few minutes and try again."),
});

/** Asking for a reset mail should not be usable to flood an inbox. */
export const resetRequestLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: message("Too many reset requests. Wait a few minutes and try again."),
});

/** Confirming a reset proves knowledge of the token. Limit it anyway. */
export const resetConfirmLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: message("Too many attempts. Wait a few minutes and try again."),
});

/** Accepting an invitation is public and creates an account. */
export const invitationAcceptLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: message("Too many attempts. Wait a few minutes and try again."),
});
