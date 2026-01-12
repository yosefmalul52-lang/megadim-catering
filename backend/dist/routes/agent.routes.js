"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const agent_controller_1 = require("../controllers/agent.controller");
const router = (0, express_1.Router)();
const agentController = new agent_controller_1.AgentController();
router.post('/', agentController.handleAgentMessage);
exports.default = router;
//# sourceMappingURL=agent.routes.js.map