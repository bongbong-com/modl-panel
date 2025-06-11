import mongoose, { Document, Schema, Types } from \'mongoose\';

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
  type: { type: String, required: true }, // e.g., \'player\', \'staff\', \'system\'
  created: { type: Date, default: Date.now },
  staff: { type: Boolean, default: false },
  action: { type: String } // e.g., STATUS_OPEN, STATUS_CLOSED
});

// Ticket Schema
export interface ITicket {
  _id: string; 
  tags: string[];
  type: \'bug\' | \'player\' | \'chat\' | \'appeal\' | \'staff\' | \'support\';
  status: \'Unfinished\' | \'Open\' | \'Closed\' | \'Under Review\' | \'Pending Player Response\' | \'Resolved\'; // Added more statuses from appeal-routes
  subject: string;
  created: Date;
  updatedAt?: Date; // Added based on appeal-routes usage
  creator: string;
  creatorUuid: string;
  reportedPlayer?: string;
  reportedPlayerUuid?: string;
  chatMessages?: string[];
  notes: ITicketNote[];
  replies: Types.DocumentArray<IReply>; // Use Types.DocumentArray for array of subdocuments
  locked: boolean;
  formData?: Map<string, any>;
  data?: Map<string, any>;
}

export interface ITicketDocument extends ITicket, Document {
  // You can add any instance methods here if needed
}

const ticketSchemaDefinition = new Schema<ITicketDocument>({
  _id: { type: String },
  tags: [{ type: String }],
  type: {
    type: String,
    required: true,
    enum: [\'bug\', \'player\', \'chat\', \'appeal\', \'staff\', \'support\'],
    default: \'bug\'
  },
  status: {
    type: String,
    required: true,
    enum: [\'Unfinished\', \'Open\', \'Closed\', \'Under Review\', \'Pending Player Response\', \'Resolved\'], // Ensure this matches your application logic
    default: \'Unfinished\'
  },
  subject: { type: String, default: \'\' },
  created: { type: Date, default: Date.now },
  updatedAt: { type: Date }, // For manual updates, Mongoose timestamps can also be used
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

// Note: Models are typically compiled by the connection in a multi-tenant setup.
// This file primarily exports interfaces and the schema definition.
export const TicketSchema = ticketSchemaDefinition;
