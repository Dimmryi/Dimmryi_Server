import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
    _id: string;
    name: string;
    email: string;
    password?: string | unknown;
    googleId?: string;
    preferredContact?: string;
    contact?: string;
    passwordResetToken?: string | null;
    passwordResetExpires?: any | null;
    authMethod?: string;
    role: string;
    subscribeType: 'Free' | 'Standard' | 'Premium';
    subscribeExpired: Date | null;
}

const UserSchema: Schema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false },
    googleId: String,
    preferredContact: { type: String, required: false },
    contact: { type: String, required: false },
    passwordResetToken:   { type: String, default: null },
    passwordResetExpires: { type: Date,   default: null },
    authMethod: {
        type: String,
        enum: ['password', 'google'],
        default: 'password'
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
        required: false,
    },
    subscribeType: {
        type: String,
        enum: ['Free', 'Standard', 'Premium'],
        default: 'Free',
    },
    subscribeExpired: {
        type: Date,
        default: null,
    },
});

UserSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(`${this.password}`, 10);
    }
    next();
});

export default mongoose.model<IUser>('User', UserSchema);