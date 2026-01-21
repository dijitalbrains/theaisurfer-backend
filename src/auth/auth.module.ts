import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SsoService } from './sso.service';
import { PkceService } from './pkce.service';
import { AuditService } from './audit.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { SsoSession } from './entities/sso-session.entity';
import { AuthorizationCode } from './entities/authorization-code.entity';
import { SsoAuditLog } from './entities/sso-audit-log.entity';
import { UsersModule } from '../users/users.module';
import { ProjectsModule } from '../projects/projects.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import type { StringValue } from 'ms';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RefreshToken,
      SsoSession,
      AuthorizationCode,
      SsoAuditLog,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiresIn =
          configService.get<StringValue>('JWT_ACCESS_EXPIRATION') ?? '15m';
        return {
          secret: configService.get<string>('JWT_SECRET'),
          signOptions: { expiresIn },
        };
      },
    }),
    ScheduleModule.forRoot(),
    UsersModule,
    ProjectsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, SsoService, PkceService, AuditService, JwtStrategy],
  exports: [AuthService, SsoService],
})
export class AuthModule {}
