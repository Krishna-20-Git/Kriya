declare global {
  namespace Express {
    interface Request {
      /** Set by authMiddleware after the access token is verified. */
      auth?: { userId: string };
    }
  }
}

export {};
