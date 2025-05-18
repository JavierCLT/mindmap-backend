// api/index.js
import { corsMiddleware } from '../utils/cors.js';

export default async function handler(req, res) {
  // Apply CORS headers
  corsMiddleware(req, res);
  
  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Health check response
  return res.status(200).json({ 
    status: "ok", 
    message: "Mindmap Backend API is running",
    environment: process.env.VERCEL_ENV || 'development'
  });
}
