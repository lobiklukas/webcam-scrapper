/**
 * Shapes of what `GET /api/auth/get-session` returns over JSON.
 * Dates arrive as ISO strings, not `Date` objects.
 */
export interface AuthUser {
	id: string;
	email: string;
	name: string;
	emailVerified: boolean;
	image?: string | null;
}

export interface AuthSession {
	id: string;
	userId: string;
	expiresAt: string;
}
