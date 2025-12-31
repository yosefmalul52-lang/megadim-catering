import { Request, Response } from 'express';
import { asyncHandler, createValidationError } from '../middleware/errorHandler';
import { handleMessage } from '../services/agent.service';

export class AgentController {
  // Handle agent message
  handleAgentMessage = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { sessionId, message } = req.body || {};

      // Handle empty message case with friendly response
      if (!message || (typeof message === 'string' && !message.trim())) {
        return res.status(200).json({
          success: true,
          data: {
            reply: "לא קיבלתי הודעה 🤔 נסה לכתוב שוב.",
            session: null
          },
          timestamp: new Date().toISOString()
        });
      }

      // Safe call to handleMessage - it handles missing sessionId internally
      const response = handleMessage({ 
        sessionId: sessionId || undefined, 
        message: typeof message === 'string' ? message : String(message || '')
      });

      res.status(200).json({
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      // Catch any unexpected errors and return friendly message
      console.error('Error in agent controller:', error);
      res.status(200).json({
        success: true,
        data: {
          reply: "סליחה, הייתה בעיה טכנית. נסה שוב בעוד רגע.",
          session: null
        },
        timestamp: new Date().toISOString()
      });
    }
  });
}

