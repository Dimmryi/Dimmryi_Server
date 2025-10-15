import mongoose from 'mongoose';

const agentSchema = new mongoose.Schema({
    image: { type: [String], required: true },
    name: { type: String, required: true },
    jobTitle: { type: String, required: true },
    email: { type: String, required: true },
    saleVolume: { type: String, required: false },
    totalDeal: { type: String, required: false },
    rating: { type: String, required: false },
    license: { type: String, required: false },
    phone: { type: String, required: false },
    date: { type: String, required: false },
});

const AgentModel = mongoose.model('Agents', agentSchema);
export default AgentModel;