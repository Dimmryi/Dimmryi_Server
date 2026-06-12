import express from 'express';
import {
    handleDeleteAgentById,
    handleGetAgents,
    handleGetAgentsById,
    handleGetAgentListings,
    handleGetMyAgent,
    handleHideMyAgent,
    handlePostAgents,
    handlePostMyAgent,
    handleUpdateMyAgent,
    handleUpdateAgentsData
} from '../controllers/AgentController';
import { requireAdmin, requireAuth, requirePremiumOrAdmin } from '../middlewares/AuthMiddleware';

const router = express.Router();

router.delete('/api/agents/:agentId', requireAdmin, handleDeleteAgentById);
router.get('/agents', handleGetAgents);
router.get('/api/agents/:agentId/listings', handleGetAgentListings);
router.get('/api/agents/:id', handleGetAgentsById);
router.post('/agents', requireAdmin, handlePostAgents);
router.put('/api/agents/:id', requireAdmin, handleUpdateAgentsData);
router.get('/api/my-agent', requireAuth, handleGetMyAgent);
router.post('/api/my-agent', requirePremiumOrAdmin, handlePostMyAgent);
router.put('/api/my-agent', requirePremiumOrAdmin, handleUpdateMyAgent);
router.delete('/api/my-agent', requirePremiumOrAdmin, handleHideMyAgent);

export default router;
