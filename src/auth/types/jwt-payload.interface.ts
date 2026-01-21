export interface JwtPayload {
  sub: string;
  email?: string;
  tokenId?: string;
  projectSlug?: string | null;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface UserPayload {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  projectSlug?: string | null;
}
