/**
 * Utility to generate "App URLs".
 * 
 * Logic:
 * - Localhost: uses "/app/${path}" to simulate a subdomain.
 * - Production: uses "https://app.motoja.top/${path}" (or configured domain).
 */

export const getAppUrl = (path: string = ''): string => {
    // Ensure path doesn't start with slash for cleaner concatenation
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;

    // Check if we are in development (localhost)
    const isLocal = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');

    if (isLocal) {
        // Local: http://localhost:3000/app/passageiro
        return `${window.location.origin}/app/${cleanPath}`;
    } else {
        // Production: https://app.motoja.top/passageiro
        // You can also use an env var here: import.meta.env.VITE_APP_DOMAIN
        const appDomain = 'app.motoja.top';
        return `https://${appDomain}/${cleanPath}`;
    }
};

/**
 * Checks if the current window is running inside the "App Context".
 * 
 * Logic:
 * - Localhost: Checks if path starts with "/app".
 * - Production: Checks if hostname is "app.motoja.top".
 */
export const isAppContext = (): boolean => {
    const isLocal = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');

    if (isLocal) {
        return window.location.pathname.startsWith('/app');
    } else {
        return window.location.hostname.startsWith('app.');
    }
};
