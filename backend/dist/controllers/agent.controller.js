"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentController = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const agent_service_1 = require("../services/agent.service");
class AgentController {
    constructor() {
        // Handle agent message
        this.handleAgentMessage = (0, errorHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
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
        }));
    }
}
exports.AgentController = AgentController;
