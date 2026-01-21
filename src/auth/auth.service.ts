import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { ProjectsService } from '../projects/projects.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { User } from '../users/entities/user.entity';
import { JwtPayload } from './types/jwt-payload.interface';
import type { StringValue } from 'ms';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly projectsService: ProjectsService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const user = await this.usersService.create(registerDto);

    const tokens = await this.generateTokens(user, null);

    return tokens;
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password, projectSlug, redirectUrl } = loginDto;

    const user = await this.usersService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (projectSlug && redirectUrl) {
      const isValidRedirect = await this.projectsService.validateRedirectUrl(
        projectSlug,
        redirectUrl,
      );

      if (!isValidRedirect) {
        throw new BadRequestException('Invalid redirect URL');
      }
    }

    const tokens = await this.generateTokens(user, projectSlug || null);

    return tokens;
  }

  async refreshTokens(refreshToken: string): Promise<AuthResponseDto> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const storedToken = await this.refreshTokenRepository.findOne({
        where: { id: payload.tokenId },
      });

      if (!storedToken || storedToken.isRevoked) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (new Date() > storedToken.expiresAt) {
        throw new UnauthorizedException('Refresh token expired');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      await this.revokeRefreshToken(storedToken.id);

      const tokens = await this.generateTokens(
        user,
        payload.projectSlug ?? null,
      );

      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateToken(token: string): Promise<{
    valid: boolean;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
    projectSlug?: string | null;
  }> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        projectSlug: payload.projectSlug ?? undefined,
      };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private async generateTokens(
    user: User,
    projectSlug: string | null,
  ): Promise<AuthResponseDto> {
    const accessTokenPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      projectSlug,
      type: 'access',
    };

    const accessToken = this.jwtService.sign(accessTokenPayload);

    const refreshTokenData = await this.generateRefreshToken(
      user.id,
      projectSlug,
    );

    const expiresIn = this.parseExpirationTime(
      this.configService.get<StringValue>('JWT_ACCESS_EXPIRATION') ?? '15m',
    );

    return {
      accessToken,
      refreshToken: refreshTokenData.token,
      expiresIn,
      tokenType: 'bearer',
    };
  }

  private async generateRefreshToken(
    userId: string,
    projectSlug: string | null,
  ): Promise<{ token: string; tokenId: string }> {
    const expirationStr =
      this.configService.get<StringValue>('JWT_REFRESH_EXPIRATION') ?? '7d';
    const expiresAt = this.calculateExpirationDate(expirationStr);

    const refreshTokenEntity = this.refreshTokenRepository.create({
      userId,
      expiresAt,
      token: '', // Will be updated with hashed token
    });

    const savedToken =
      await this.refreshTokenRepository.save(refreshTokenEntity);

    const refreshTokenPayload: JwtPayload = {
      sub: userId,
      tokenId: savedToken.id,
      projectSlug,
      type: 'refresh',
    };

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: expirationStr,
    });

    const hashedToken = await bcrypt.hash(refreshToken, 10);
    savedToken.token = hashedToken;
    await this.refreshTokenRepository.save(savedToken);

    return { token: refreshToken, tokenId: savedToken.id };
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    const token = await this.refreshTokenRepository.findOne({
      where: { id: tokenId },
    });

    if (token) {
      token.isRevoked = true;
      await this.refreshTokenRepository.save(token);
    }
  }

  private parseExpirationTime(expiration: string): number {
    const unit = expiration.slice(-1);
    const value = parseInt(expiration.slice(0, -1));

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 900; // Default 15 minutes
    }
  }

  private calculateExpirationDate(expiration: string): Date {
    const seconds = this.parseExpirationTime(expiration);
    const date = new Date();
    date.setSeconds(date.getSeconds() + seconds);
    return date;
  }
}
