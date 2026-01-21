import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class PkceService {
  validateCodeChallenge(
    codeVerifier: string,
    codeChallenge: string,
    method: string = 'S256',
  ): boolean {
    if (method !== 'S256') {
      throw new Error('Only S256 code challenge method is supported');
    }

    if (
      !codeVerifier ||
      codeVerifier.length < 43 ||
      codeVerifier.length > 128
    ) {
      return false;
    }

    if (!this.isBase64Url(codeVerifier)) {
      return false;
    }

    const computedChallenge = this.generateCodeChallenge(codeVerifier);

    return crypto.timingSafeEqual(
      Buffer.from(computedChallenge),
      Buffer.from(codeChallenge),
    );
  }

  generateCodeChallenge(codeVerifier: string): string {
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  }

  generateAuthorizationCode(): string {
    return `auth_${crypto.randomBytes(48).toString('base64url')}`;
  }

  private isBase64Url(str: string): boolean {
    return /^[A-Za-z0-9_-]+$/.test(str);
  }
}
