import mongoose, { Document, Schema, Types } from 'mongoose';

// Ticket Note Schema
export interface ITicketNote extends Document {
  content: string;
  author: string;
  date: Date;
}
const ticketNoteSchema = new Schema<ITicketNote>({
  content: { type: String, required: true },
  author: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

// Reply Schema
export interface IReply extends Document {
  name: string;
  content: string;
  type: string;
  created: Date;
  staff: boolean;
  action?: string;
}
const replySchema = new Schema<IReply>({
  name: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, required: true },
  created: { type: Date, default: Date.now },
  staff: { type: Boolean, default: false },
  action: { type: String }
});

export interface ITicket {
  tags: string[];
  type: 'bug' | 'player' | 'chat' | 'appeal' | 'staff' | 'support';
  status: 'Unfinished' | 'Open' | 'Closed' | 'Under Review' | 'Pending Player Response' | 'Resolved';
  subject: string;
  created: Date;
  updatedAt?: Date;
  creator: string;
  creatorUuid: string;
  reportedPlayer?: string;
  reportedPlayerUuid?: string;
  chatMessages?: string[];
  notes: ITicketNote[];
  replies: Types.DocumentArray<IReply>;
  locked: boolean;
  formData?: Map<string, any>;
  data?: Map<string, any>;
}

export interface ITicketDocument extends ITicket, Document {
}

const ticketSchemaDefinition = new Schema<ITicketDocument>({
  _id: { type: String },
  tags: [{ type: String }],
  type: {
    type: String,
    required: true,
    enum: ['bug', 'player', 'chat', 'appeal', 'staff', 'support'],
    default: 'bug'
  },
  status: {
    type: String,
    required: true,
    enum: ['Unfinished', 'Open', 'Closed', 'Under Review', 'Pending Player Response', 'Resolved'],
    default: 'Unfinished'
  },
  subject: { type: String, default: '' },
  created: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  creator: { type: String, required: true },
  creatorUuid: { type: String, required: true },
  reportedPlayer: { type: String },
  reportedPlayerUuid: { type: String },
  chatMessages: [{ type: String }],
  notes: [ticketNoteSchema],
  replies: [replySchema],
  locked: { type: Boolean, default: false },
  formData: { type: Map, of: mongoose.Schema.Types.Mixed },
  data: { type: Map, of: mongoose.Schema.Types.Mixed }
}, { timestamps: true }); // Enabling Mongoose timestamps (createdAt, updatedAt)

export const TicketSchema = ticketSchemaDefinition;
