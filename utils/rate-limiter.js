// utils/rate-limiter.js
import { LRUCache } from 'lru-cache';

// Create a cache with a max of 100 items that expire after 15 minutes
const rateLimit = new LRUCache({
  max: 100,
  ttl: 15 * 60 * 1000, // 15 minutes
});

export async function rateLimiter(req) {
  // Get IP address from request
  const ip = req.headers['x-forwarded-for'] || 
             req.connection.remoteAddress || 
             'unknown';
  
  // Get current count for this IP
  const currentCount = rateLimit.get(ip) || 0;
  
  // Max requests per 15 minutes
  const MAX_REQUESTS = 30;
  
  // Check if rate limit is exceeded
  if (currentCount >= MAX_REQUESTS) {
    return { limited: true, current: currentCount, max: MAX_REQUESTS };
  }
  
  // Increment the count
  rateLimit.set(ip, currentCount + 1);
  
  return { limited: false, current: currentCount + 1, max: MAX_REQUESTS };
}
