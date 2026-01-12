"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentController = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const agent_service_1 = require("../services/agent.service");
class AgentController {
    handleAgentMessage = (0, errorHandler_1.asyncHandler)(async (req, res) => {
        try {
            const { sessionId, message } = req.body || {};
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
            const response = (0, agent_service_1.handleMessage)({
                sessionId: sessionId || undefined,
                message: typeof message === 'string' ? message : String(message || '')
            });
            res.status(200).json({
                success: true,
                data: response,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
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
exports.AgentController = AgentController;
//# sourceMappingURL=agent.controller.js.map