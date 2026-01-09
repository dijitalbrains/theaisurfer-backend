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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SsoService } from './sso.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { SsoInitiateDto } from './dto/sso-initiate.dto';
import { SsoResponseDto, SsoSessionDto } from './dto/sso-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

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
  @ApiResponse({ status: 401, description: 'Invalid credentials or no project access' })
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
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<AuthResponseDto> {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  @Get('validate')
  @Public()
  @ApiOperation({
    summary: 'Validate access token',
    description: 'Verify if an access token is valid and check user/project access',
  })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
    schema: {
      example: {
        valid: true,
        user: {
          id: 'uuid',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        projectSlug: 'remixer',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  async validate(@Query('token') token: string) {
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
  async getCurrentUser(@CurrentUser() user: any) {
    return user;
  }

  @Get('sso')
  @Public()
  @ApiOperation({
    summary: 'Initiate SSO flow',
    description:
      'Child project initiates SSO authentication by providing project slug, API key, and return URL. Creates a session and returns session ID.',
  })
  @ApiResponse({
    status: 200,
    description: 'SSO session created successfully',
    schema: {
      example: {
        sessionId: 'a1b2c3d4e5f6...',
        message: 'SSO session created. Redirect user to /sso/session?id=...',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid API key or project not found' })
  @ApiResponse({ status: 400, description: 'Invalid return URL' })
  async initiateSso(@Query() ssoInitiateDto: SsoInitiateDto) {
    const { project, apiKey, returnUrl, state } = ssoInitiateDto;

    // Validate project credentials
    await this.ssoService.validateProjectCredentials(project, apiKey);

    // Validate return URL
    await this.ssoService.validateReturnUrl(project, returnUrl);

    // Generate SSO session
    const sessionId = await this.ssoService.generateSSOSession(
      project,
      returnUrl,
      state,
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
    const session = this.ssoService.getSSOSession(sessionId);

    if (!session) {
      throw new BadRequestException('Invalid or expired SSO session');
    }

    return session;
  }

  @Post('sso/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete SSO authentication',
    description:
      'User confirms SSO login. Generates tokens and returns redirect URL with tokens for child project.',
  })
  @ApiResponse({
    status: 200,
    description: 'SSO authentication completed, redirect URL generated',
    schema: {
      example: {
        redirectUrl:
          'https://remixer.theaisurfer.com/auth/callback?token=xxx&refresh=yyy&user=...',
        tokens: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          user: {
            id: 'uuid',
            email: 'user@example.com',
            firstName: 'John',
            lastName: 'Doe',
          },
          state: 'csrf_token',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'User not authenticated' })
  @ApiResponse({ status: 400, description: 'Invalid or expired SSO session' })
  async completeSso(
    @CurrentUser() user: any,
    @Body('sessionId') sessionId: string,
  ) {
    const result = await this.ssoService.completeSSOAuth(user, sessionId);
    return result;
  }
}

