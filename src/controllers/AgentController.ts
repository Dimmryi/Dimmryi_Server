import mongoose from "mongoose";
import AgentModel from "../models/AgentModel";

export const handleDeleteAgentById =  async (req:any, res:any) => {
    try {
        const { agentId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(agentId)) {
            return res.status(400).json({ message: `Invalid ID format: ${agentId}` });
        }

        const objectId = new mongoose.Types.ObjectId(agentId);
        const deletedAgent = await AgentModel.deleteMany({ _id: objectId });

        if (deletedAgent.deletedCount === 0) {
            return res.status(404).json({ message: 'No Agent data found.' });
        }
        res.status(200).json({
            message: `Successfully deleted agent data.`,
            deletedCount: deletedAgent.deletedCount,
        });

    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetAgents = async (req:any, res:any) => {
    try {
        const agents = await AgentModel.find();
        res.json(agents);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetAgentsById = async (req:any, res:any) => {
    try {
        const agent = await AgentModel.find({ _id: req.params.id });
        if (!agent) {
            res.status(404).json({ message: `Agent's data not found` });
            return
        }
        res.json(agent);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handlePostAgents = async (req:any, res:any) => {
    try {
        const { image, ...rest } = req.body;
        const agent = new AgentModel({
            image: Array.isArray(image) ? image : [image], // Поддержка массива
            ...rest
        });
        await agent.save();
        res.json({ message: 'Agent added successful!' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleUpdateAgentsData = async (req:any, res:any) => {
    try {
        const { id } = req.params;
        const { name, rating, email, jobTitle, saleVolume, license, totalDeal, phone, image } = req.body;

        if (!name || !rating || !email || !jobTitle || !saleVolume || !license || !totalDeal || !phone || !image) {
            return res.status(400).json({ error: "Fill in all required data" });
        }

        const existingAgent = await AgentModel.findById(id);
        const currentUserId = req.session.user?.id;

        if (req.session.user?.role !== 'admin') {
            return res.status(403).json({ message: "Administrator access rights are required" });
        }

        const updatedAgent = await AgentModel.findByIdAndUpdate(
            id,
            { name, rating, email, jobTitle, saleVolume, license, totalDeal, phone, image, date: Date.now() },
            { new: true }
        );

        res.json(updatedAgent);
    } catch (error:any) {
        res.status(500).json({ error: error.message });
    }
};