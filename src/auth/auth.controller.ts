import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  BadRequestException,
  UnauthorizedException,
  Req,
  Ip,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { SsoService } from './sso.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { SsoInitiateDto } from './dto/sso-initiate.dto';
import { SsoSessionDto } from './dto/sso-response.dto';
import { TokenValidationResponseDto } from './dto/token-validation-response.dto';
import {
  AuthorizeCompleteDto,
  TokenExchangeDto,
  AuthorizationCodeResponseDto,
  TokenResponseDto,
} from './dto/pkce.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '../users/entities/user.entity';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly ssoService: SsoService,
  ) {}

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login user',
    description:
      'Login with email and password. Optionally specify project for access validation.',
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or no project access',
  })
  @ApiResponse({ status: 400, description: 'Invalid redirect URL' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Tokens successfully refreshed',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  @Get('validate')
  @Public()
  @ApiOperation({
    summary: 'Validate access token',
    description:
      'Verify if an access token is valid and check user/project access',
  })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
    type: TokenValidationResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  validate(@Query('token') token: string): Promise<TokenValidationResponseDto> {
    return this.authService.validateToken(token);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user information' })
  @ApiResponse({
    status: 200,
    description: 'Current user information',
    schema: {
      example: {
        id: 'uuid',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        projectSlug: 'remixer',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getCurrentUser(
    @CurrentUser() user: { id: string; email: string; projectSlug?: string },
  ) {
    return user;
  }

  @Get('sso')
  @Public()
  @ApiOperation({
    summary: 'Initiate SSO flow (OAuth 2.1 with PKCE)',
    description:
      'Child project initiates SSO authentication by providing project slug, API key, return URL, PKCE challenge, and state. Creates a session and returns session ID.',
  })
  @ApiResponse({
    status: 200,
    description: 'SSO session created successfully',
    schema: {
      example: {
        sessionId: 'a1b2c3d4e5f6...',
        message: 'SSO session created successfully',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid API key or project not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid return URL or PKCE parameters',
  })
  async initiateSso(
    @Query() ssoInitiateDto: SsoInitiateDto,
    @Ip() ipAddress: string,
    @Req() req: Request,
  ) {
    const {
      project,
      apiKey,
      returnUrl,
      state,
      codeChallenge,
      codeChallengeMethod,
    } = ssoInitiateDto;
    const userAgent = req.get('user-agent');

    await this.ssoService.validateProjectCredentials(
      project,
      apiKey,
      ipAddress,
      userAgent,
    );

    await this.ssoService.validateReturnUrl(
      project,
      returnUrl,
      undefined,
      ipAddress,
      userAgent,
    );

    const sessionId = await this.ssoService.generateSSOSession(
      project,
      returnUrl,
      state,
      codeChallenge,
      codeChallengeMethod,
      ipAddress,
      userAgent,
    );

    return {
      sessionId,
      message: 'SSO session created successfully',
    };
  }

  @Get('sso/session')
  @Public()
  @ApiOperation({
    summary: 'Get SSO session data',
    description:
      'Retrieve SSO session information using session ID. Used by frontend to display project details.',
  })
  @ApiResponse({
    status: 200,
    description: 'SSO session data',
    type: SsoSessionDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired session' })
  async getSsoSession(@Query('id') sessionId: string) {
    if (!sessionId) {
      throw new BadRequestException('Session ID is required');
    }

    const session = await this.ssoService.getSSOSession(sessionId);

    if (!session) {
      throw new BadRequestException('Invalid or expired SSO session');
    }

    return session;
  }

  @Post('sso/authorize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authorize SSO session and generate authorization code',
    description:
      'User confirms SSO login. Generates single-use authorization code (60s TTL) with PKCE challenge stored.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authorization code generated',
    type: AuthorizationCodeResponseDto,
  })
  @ApiResponse({ status: 401, description: 'User not authenticated' })
  @ApiResponse({ status: 400, description: 'Invalid or expired SSO session' })
  async authorizeSso(
    @CurrentUser() user: User,
    @Body() authorizeDto: AuthorizeCompleteDto,
    @Ip() ipAddress: string,
    @Req() req: Request,
  ): Promise<AuthorizationCodeResponseDto> {
    const { sessionId } = authorizeDto;
    const userAgent = req.get('user-agent');

    if (!sessionId) {
      throw new BadRequestException('Session ID is required');
    }

    if (!user || !user.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    const result = await this.ssoService.authorizeSession(
      user,
      sessionId,
      ipAddress,
      userAgent,
    );

    return result;
  }

  @Post('sso/quick-login')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async quickLogin(
    @CurrentUser() user: User,
    @Body() body: { projectSlug: string },
  ): Promise<{ loginUrl: string }> {
    const { projectSlug } = body;

    const token = await this.ssoService.generateQuickLoginToken(
      user,
      projectSlug,
    );
    return { loginUrl: token.loginUrl };
  }

  @Post('sso/validate-quick-login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async validateQuickLogin(
    @Body() body: { token: string; projectSlug: string; apiKey: string },
    @Ip() ipAddress: string,
    @Req() req: Request,
  ): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  }> {
    const { token, projectSlug, apiKey } = body;
    const userAgent = req.get('user-agent');

    await this.ssoService.validateProjectCredentials(
      projectSlug,
      apiKey,
      ipAddress,
      userAgent,
    );

    const session = await this.ssoService.getQuickLoginSession(token);

    if (!session) {
      throw new UnauthorizedException('Invalid or expired quick login token');
    }

    return session.user;
  }

  @Post('sso/token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange authorization code for tokens (backend-to-backend)',
    description:
      'Child backend exchanges authorization code + PKCE verifier for access and refresh tokens. Code is single-use and expires in 60 seconds.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens issued successfully',
    type: TokenResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid code, verifier, or code already used/expired',
  })
  async exchangeToken(
    @Body() tokenExchangeDto: TokenExchangeDto,
    @Ip() ipAddress: string,
    @Req() req: Request,
  ): Promise<TokenResponseDto> {
    const { code, codeVerifier, projectSlug, apiKey, redirectUri } =
      tokenExchangeDto;
    const userAgent = req.get('user-agent');

    await this.ssoService.validateProjectCredentials(
      projectSlug,
      apiKey,
      ipAddress,
      userAgent,
    );

    const tokens = await this.ssoService.exchangeCodeForTokens(
      code,
      codeVerifier,
      projectSlug,
      redirectUri,
      ipAddress,
      userAgent,
    );

    return tokens;
  }
}
