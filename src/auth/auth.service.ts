import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RecordStatus, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthUser, JwtPayload } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(username: string, password: string): Promise<Tokens & { user: AuthUser }> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || user.status !== RecordStatus.ACTIVE) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không đúng');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không đúng');
    }
    const tokens = await this.issueTokens(user);
    return {
      ...tokens,
      user: { id: user.id, username: user.username, role: user.role },
    };
  }

  async refresh(refreshToken: string): Promise<Tokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || user.status !== RecordStatus.ACTIVE) {
      throw new UnauthorizedException('Tài khoản không khả dụng');
    }
    return this.issueTokens(user);
  }

  async me(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const { passwordHash: _removed, ...safe } = user;
    return safe;
  }

  private async issueTokens(user: User): Promise<Tokens> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_TTL') ?? '30d',
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
