import crypto from 'crypto';
import User from '../models/UserModel';

const PLAN_PRICES: Record<string, number> = {
    standard: 299,
    premium: 599,
};

const SUBSCRIPTION_DURATION_MS = 90 * 24 * 60 * 60 * 1000;
const SUBSCRIPTION_TEST_MODE = process.env.SUBSCRIPTION_TEST_MODE === 'true';
const TEST_PUBLIC_KEY = 'dimmryi_subscription_test_public';
const TEST_PRIVATE_KEY = 'dimmryi_subscription_test_private';

function buildSignature(data: string): string {
    const privateKey = getLiqpayPrivateKey();
    return crypto
        .createHash('sha1')
        .update(privateKey + data + privateKey)
        .digest('base64');
}

function getLiqpayPublicKey() {
    return process.env.LIQPAY_PUBLIC_KEY || (SUBSCRIPTION_TEST_MODE ? TEST_PUBLIC_KEY : '');
}

function getLiqpayPrivateKey() {
    return process.env.LIQPAY_PRIVATE_KEY || (SUBSCRIPTION_TEST_MODE ? TEST_PRIVATE_KEY : '');
}

function hasLiqpayKeys() {
    return Boolean(getLiqpayPublicKey() && getLiqpayPrivateKey());
}

function isValidPaidPlan(plan: string): plan is 'standard' | 'premium' {
    return plan === 'standard' || plan === 'premium';
}

export const handleGetLiqpayParams = (req: any, res: any) => {
    const plan = (req.query.plan as string)?.toLowerCase();

    if (!isValidPaidPlan(plan)) {
        return res.status(400).json({ error: 'Invalid plan. Use standard or premium.' });
    }

    if (!hasLiqpayKeys()) {
        return res.status(503).json({ error: 'LiqPay keys are not configured.' });
    }

    const userId = req.session.user.id;
    const publicKey = getLiqpayPublicKey();

    const payload = {
        public_key: publicKey,
        version: '3',
        action: 'pay',
        amount: PLAN_PRICES[plan],
        currency: 'UAH',
        description: plan,
        order_id: `${userId}_${Date.now()}`,
        sandbox: SUBSCRIPTION_TEST_MODE ? '1' : undefined,
    };

    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = buildSignature(data);

    res.json({ data, signature, testMode: SUBSCRIPTION_TEST_MODE });
};

export const handleSubscribePay = async (req: any, res: any) => {
    try {
        const { data, signature, plan: requestedPlan } = req.body;

        if (String(requestedPlan).toLowerCase() === 'free') {
            await User.findByIdAndUpdate(req.session.user.id, { subscribeType: 'Free', subscribeExpired: null });
            return res.json({ subscribeType: 'Free', subscribeExpired: null });
        }

        if (!data || !signature) {
            return res.status(400).json({ error: 'data and signature are required.' });
        }

        if (!hasLiqpayKeys()) {
            return res.status(503).json({ error: 'LiqPay keys are not configured.' });
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
        if (!isValidPaidPlan(plan)) {
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

        if (!hasLiqpayKeys()) {
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
        if (!isValidPaidPlan(plan)) {
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
