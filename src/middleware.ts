import { defineMiddleware } from 'astro:middleware';
import { verifyToken, getTokenFromCookies } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  
  // Normalize pathname (remove trailing slash except for root)
  const normalizedPath = pathname.length > 1 && pathname.endsWith('/') 
    ? pathname.slice(0, -1) 
    : pathname;

  // Skip middleware for static assets
  if (normalizedPath.startsWith('/_astro') || 
      normalizedPath.startsWith('/favicon') || 
      normalizedPath.match(/\.(css|js|svg|png|jpg|ico|webmanifest)$/)) {
    return next();
  }

  const token = getTokenFromCookies(context.request.headers.get('cookie'));
  let user = null;

  if (token) {
    user = await verifyToken(token);
    if (user) {
      context.locals.user = user;
    }
  }

  // Define public routes
  const isHome = normalizedPath === '/';
  const isAuthRoute = normalizedPath === '/login' || normalizedPath === '/register';
  const isAuthApi = normalizedPath.startsWith('/api/auth/');

  const isPublic = isHome || isAuthRoute || isAuthApi;

  // If not a public route and user not authenticated, redirect to login
  if (!isPublic && !user) {
    return context.redirect('/login');
  }

  // If user is already logged in and tries to access login/register, redirect to home
  if (user && isAuthRoute) {
    return context.redirect('/');
  }

  return next();
});
