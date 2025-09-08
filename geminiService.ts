import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI with your API key
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: Date;
}

class GeminiService {
  private model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  private chatSessions: Map<string, ChatSession> = new Map();

  // Generate a response from Gemini
  async generateResponse(message: string, sessionId: string = 'default'): Promise<string> {
    try {
      if (!API_KEY) {
        throw new Error('Gemini API key not found. Please set VITE_GEMINI_API_KEY in your environment variables.');
      }

      // Get or create chat session
      let session = this.chatSessions.get(sessionId);
      if (!session) {
        session = {
          id: sessionId,
          messages: [],
          createdAt: new Date(),
        };
        this.chatSessions.set(sessionId, session);
      }

      // Build context from previous messages for better conversation flow
      const contextMessages = session.messages.slice(-10); // Last 10 messages for context
      const conversationHistory = contextMessages
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');

      const prompt = conversationHistory 
        ? `Previous conversation:\n${conversationHistory}\n\nUser: ${message}\n\nAssistant:`
        : `User: ${message}\n\nAssistant:`;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const responseText = response.text();

      // Add messages to session
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: message,
        timestamp: new Date(),
      };

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
      };

      session.messages.push(userMessage, assistantMessage);

      return responseText;
    } catch (error: any) {
      console.error('Error generating response:', error);
      
      if (error.message?.includes('API key')) {
        return 'Sorry, the AI service is not properly configured. Please contact your administrator.';
      } else if (error.message?.includes('quota') || error.message?.includes('limit')) {
        return 'Sorry, the AI service has reached its usage limit. Please try again later.';
      } else {
        return 'Sorry, I encountered an error while processing your request. Please try again.';
      }
    }
  }

  // Get chat session history
  getChatSession(sessionId: string = 'default'): ChatSession | null {
    return this.chatSessions.get(sessionId) || null;
  }

  // Clear chat session
  clearChatSession(sessionId: string = 'default'): void {
    this.chatSessions.delete(sessionId);
  }

  // Get all sessions
  getAllSessions(): ChatSession[] {
    return Array.from(this.chatSessions.values());
  }
}

export const geminiService = new GeminiService();