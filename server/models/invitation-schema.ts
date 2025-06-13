import mongoose from 'mongoose';
const { Schema } = mongoose;

const invitationSchema = new Schema({
  email: { type: String, required: true, unique: true },
  role: {
    type: String,
    required: true,
    enum: ['Admin', 'Moderator', 'Helper'],
  },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted'],
    default: 'pending',
  },
});

export const Invitation = mongoose.model('Invitation', invitationSchema);