import type { UserDoc } from '../models/User';
import type { SessionDoc } from '../models/Session';
import type { UserRole } from '../models/User';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
      auth?: {
        user: UserDoc;
        session: SessionDoc;
        role: UserRole;
        userId: string;
      };
    }
  }
}

export {};
