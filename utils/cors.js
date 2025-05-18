// utils/cors.js
export function corsMiddleware(req, res) {
  // Define allowed origins
  const allowedOrigins = [
    'https://javierclt.github.io',
    'http://localhost:5173',
    'http://localhost:3000',
    'https://mindmap-frontend-rho.vercel.app', // Add your Vercel frontend URL
  ];
  
  // Get the origin from the request headers
  const origin = req.headers.origin;
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Check if the origin is in our allowed list
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // For local development and testing, you might want to allow any origin
    // In production, you should restrict this
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS,PATCH,DELETE,POST,PUT'
  );
  
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
}
