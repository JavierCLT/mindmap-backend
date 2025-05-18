export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Your code here
  
  // Return response
  return res.status(200).json({ markdown: result });
}
