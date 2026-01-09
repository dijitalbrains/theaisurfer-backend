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

    // Generate tokens without project context
    const tokens = await this.generateTokens(user, null);

    return tokens;
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password, projectSlug, redirectUrl } = loginDto;

    // Validate user credentials
    const user = await this.usersService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // If project is specified, validate redirect URL
    if (projectSlug && redirectUrl) {
      const isValidRedirect = await this.projectsService.validateRedirectUrl(
        projectSlug,
        redirectUrl,
      );

      if (!isValidRedirect) {
        throw new BadRequestException('Invalid redirect URL');
      }
    }

    // Generate tokens with project context
    const tokens = await this.generateTokens(user, projectSlug || null);

    return tokens;
  }

  async refreshTokens(refreshToken: string): Promise<AuthResponseDto> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Check if token exists in database and is not revoked
      const storedToken = await this.refreshTokenRepository.findOne({
        where: { id: payload.tokenId },
      });

      if (!storedToken || storedToken.isRevoked) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Check if token is expired
      if (new Date() > storedToken.expiresAt) {
        throw new UnauthorizedException('Refresh token expired');
      }

      // Get user
      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Revoke old refresh token
      await this.revokeRefreshToken(storedToken.id);

      // Generate new tokens
      const tokens = await this.generateTokens(user, payload.projectSlug);

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateToken(token: string): Promise<any> {
    try {
      const payload = this.jwtService.verify(token);
      
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
        projectSlug: payload.projectSlug,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private async generateTokens(
    user: User,
    projectSlug: string | null,
  ): Promise<AuthResponseDto> {
    // Generate access token
    const accessTokenPayload = {
      sub: user.id,
      email: user.email,
      projectSlug,
      type: 'access',
    };

    const accessToken = this.jwtService.sign(accessTokenPayload);

    // Generate refresh token
    const refreshTokenData = await this.generateRefreshToken(
      user.id,
      projectSlug,
    );

    // Get expiration time in seconds
    const expiresIn = this.parseExpirationTime(
      this.configService.get('JWT_ACCESS_EXPIRATION') || '15m',
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
    // Calculate expiration date
    const expirationStr = this.configService.get('JWT_REFRESH_EXPIRATION');
    const expiresAt = this.calculateExpirationDate(expirationStr);

    // Create refresh token record
    const refreshTokenEntity = this.refreshTokenRepository.create({
      userId,
      expiresAt,
      token: '', // Will be updated with hashed token
    });

    const savedToken = await this.refreshTokenRepository.save(refreshTokenEntity);

    // Generate JWT with token ID
    const refreshTokenPayload = {
      sub: userId,
      tokenId: savedToken.id,
      projectSlug,
      type: 'refresh',
    };

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: expirationStr,
    });

    // Hash and store the token
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

