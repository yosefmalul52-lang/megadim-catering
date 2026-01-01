import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';

/**
 * HTTP Interceptor to automatically attach JWT token to all HTTP requests
 * 
 * This interceptor:
 * 1. Checks if a token exists in localStorage (key: 'auth_token' - same as AuthService uses)
 * 2. If token exists, clones the request and adds Authorization header: "Bearer <token>"
 * 3. Passes the request to next.handle()
 * 
 * @param req - The outgoing HTTP request
 * @param next - The next handler in the chain
 * @returns Observable<HttpEvent<any>>
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  // Debug: Log that interceptor is running
  console.log('🔑 Auth Interceptor: Intercepting request', {
    url: req.url,
    method: req.method
  });

  // Get token from localStorage (same key used in AuthService: 'auth_token')
  const token = localStorage.getItem('auth_token');

  // Debug: Log token status
  if (token) {
    console.log('🔑 Auth Interceptor attaching token:', {
      hasToken: true,
      tokenLength: token.length,
      tokenPreview: token.substring(0, 20) + '...',
      url: req.url
    });
  } else {
    console.log('🔑 Auth Interceptor: No token found in localStorage', {
      localStorageKeys: Object.keys(localStorage),
      url: req.url
    });
  }

  // If token exists, clone the request and add the authorization header
  if (token) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    
    console.log('🔑 Auth Interceptor: Request cloned with Authorization header', {
      url: req.url,
      hasAuthHeader: true
    });
    
    return next(cloned);
  }

  // If no token, proceed with the original request
  // This is fine for public endpoints (login, register, menu items, etc.)
  console.log('🔑 Auth Interceptor: Proceeding without token (public endpoint)', {
    url: req.url
  });
  
  return next(req);
};

