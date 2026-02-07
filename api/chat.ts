import type { VercelRequest, VercelResponse } from '@vercel/node';

// API configuration
const API_CONFIG = {
  MINIMAX: {
    API_KEY: process.env.MINIMAX_API_KEY,
    API_URL: 'https://api.minimax.chat/v1/chat/completions',
    MODEL: 'm2-her'
  }
};

// Abstract chat service interface
interface ChatService {
  getResponse(messages: any[]): Promise<string>;
}

// MiniMax implementation
class MiniMaxService implements ChatService {
  async getResponse(messages: any[]): Promise<string> {
    try {
      if (!API_CONFIG.MINIMAX.API_KEY) {
        throw new Error('MINIMAX_API_KEY environment variable is not set');
      }
      
      const response = await fetch(API_CONFIG.MINIMAX.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.MINIMAX.API_KEY}`
        },
        body: JSON.stringify({
          model: API_CONFIG.MINIMAX.MODEL,
          messages: messages,
          temperature: 1.0,
          top_p: 0.95
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Check for API errors in base_resp
      if (data.base_resp && data.base_resp.status_code !== 0) {
        throw new Error(`API error: ${data.base_resp.status_msg} (code: ${data.base_resp.status_code})`);
      }
      
      // Handle different response structures
      if (data.reply) {
        return data.reply;
      } else if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content;
      } else {
        throw new Error('Invalid API response structure: no reply found');
      }
    } catch (error) {
      console.error('MiniMax API error:', error);
      throw error;
    }
  }
}

// Chat service factory
const getChatService = (service: string = 'MINIMAX'): ChatService => {
  switch (service) {
    case 'MINIMAX':
      return new MiniMaxService();
    default:
      return new MiniMaxService();
  }
};

// Export the handler for Vercel
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'POST') {
    try {
      const { messages, service } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
      }

      const chatService = getChatService(service);
      const response = await chatService.getResponse(messages);

      res.json({ response });
    } catch (error) {
      console.error('Chat API error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
