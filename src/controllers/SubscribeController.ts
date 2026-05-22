import crypto from 'crypto';
import User from '../models/UserModel';

const PLAN_PRICES: Record<string, number> = {
    standard: 299,
    premium: 599,
};

const SUBSCRIPTION_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

function buildSignature(data: string): string {
    const privateKey = process.env.LIQPAY_PRIVATE_KEY || '';
    return crypto
        .createHash('sha1')
        .update(privateKey + data + privateKey)
        .digest('base64');
}

function isValidPlan(plan: string): plan is 'standard' | 'premium' {
    return plan === 'standard' || plan === 'premium';
}

export const handleGetLiqpayParams = (req: any, res: any) => {
    const plan = (req.query.plan as string)?.toLowerCase();

    if (!isValidPlan(plan)) {
        return res.status(400).json({ error: 'Invalid plan. Use standard or premium.' });
    }

    const userId = req.session.user.id;
    const publicKey = process.env.LIQPAY_PUBLIC_KEY || '';

    const payload = {
        public_key: publicKey,
        version: '3',
        action: 'pay',
        amount: PLAN_PRICES[plan],
        currency: 'UAH',
        description: plan,
        order_id: `${userId}_${Date.now()}`,
    };

    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = buildSignature(data);

    res.json({ data, signature });
};

export const handleSubscribePay = async (req: any, res: any) => {
    try {
        const { data, signature } = req.body;

        if (!data || !signature) {
            return res.status(400).json({ error: 'data and signature are required.' });
        }

        const expectedSignature = buildSignature(data);
        if (expectedSignature !== signature) {
            return res.status(403).json({ error: 'Signature mismatch.' });
        }

        let decoded: any;
        try {
            decoded = JSON.parse(Buffer.from(data, 'base64').toString());
        } catch {
            return res.status(400).json({ error: 'Invalid data encoding.' });
        }

        const plan = decoded.description?.toLowerCase();
        if (!isValidPlan(plan)) {
            return res.status(400).json({ error: 'Invalid plan in payload.' });
        }

        const subscribeType = plan === 'standard' ? 'Standard' : 'Premium';
        const subscribeExpired = new Date(Date.now() + SUBSCRIPTION_DURATION_MS);

        await User.findByIdAndUpdate(req.session.user.id, { subscribeType, subscribeExpired });

        res.json({ subscribeType, subscribeExpired });
    } catch (error) {
        console.error('Subscribe pay error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
};

export const handleLiqpayCallback = async (req: any, res: any) => {
    try {
        const { data, signature } = req.body;

        if (!data || !signature) {
            return res.sendStatus(200);
        }

        const expectedSignature = buildSignature(data);
        if (expectedSignature !== signature) {
            return res.sendStatus(200);
        }

        let decoded: any;
        try {
            decoded = JSON.parse(Buffer.from(data, 'base64').toString());
        } catch {
            return res.sendStatus(200);
        }

        const plan = decoded.description?.toLowerCase();
        if (!isValidPlan(plan)) {
            return res.sendStatus(200);
        }

        // order_id format: userId_timestamp
        const userId = decoded.order_id?.split('_')[0];
        if (!userId) {
            return res.sendStatus(200);
        }

        const subscribeType = plan === 'standard' ? 'Standard' : 'Premium';
        const subscribeExpired = new Date(Date.now() + SUBSCRIPTION_DURATION_MS);

        await User.findByIdAndUpdate(userId, { subscribeType, subscribeExpired });

        res.sendStatus(200);
    } catch (error) {
        console.error('LiqPay callback error:', error);
        res.sendStatus(200);
    }
};
