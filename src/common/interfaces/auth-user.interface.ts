import { Role } from '@prisma/client';

/** Payload đã giải mã từ access token, gắn vào request.user. */
export interface AuthUser {
  id: string;
  username: string;
  role: Role;
}

/** Nội dung ký trong JWT. */
export interface JwtPayload {
  sub: string;
  username: string;
  role: Role;
}
