import express from 'express';
import {
    handleDeleteAgentById,
    handleGetAgents,
    handleGetAgentsById,
    handlePostAgents,
    handleUpdateAgentsData
} from '../controllers/AgentController';
import { requireAdmin } from '../middlewares/AuthMiddleware';

const router = express.Router();

router.delete('/api/agents/:agentId', requireAdmin, handleDeleteAgentById);
router.get('/agents', handleGetAgents);
router.get('/api/agents/:id', handleGetAgentsById);
router.post('/agents', requireAdmin, handlePostAgents);
router.put('/api/agents/:id', requireAdmin, handleUpdateAgentsData);

export default router;