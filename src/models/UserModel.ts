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
    authMethod?: string;
    role: string;
}

const UserSchema: Schema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false },
    googleId: String,
    preferredContact: { type: String, required: false },
    contact: { type: String, required: false },
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
});

UserSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(`${this.password}`, 10);
    }
    next();
});

export default mongoose.model<IUser>('User', UserSchema);