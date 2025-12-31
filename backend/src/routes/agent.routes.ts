import { Router } from 'express';
import { AgentController } from '../controllers/agent.controller';

const router = Router();
const agentController = new AgentController();

// Public route
router.post('/', agentController.handleAgentMessage);

export default router;

