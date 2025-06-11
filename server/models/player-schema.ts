import mongoose, { Document, Schema } from \'mongoose\';
import { Int32 } from \'mongodb\';

// Username Schema
export interface IUsername extends Document {
  username: string;
  date: Date;
}
const usernameSchema = new Schema<IUsername>({
  username: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

// Note Schema
export interface INote extends Document {
  text: string;
  date: Date;
  issuerName: string;
  issuerId?: string;
}
const noteSchema = new Schema<INote>({
  text: { type: String, required: true },
  date: { type: Date, default: Date.now },
  issuerName: { type: String, required: true },
  issuerId: { type: String }
});

// IP Address Schema
export interface IIPAddress extends Document {
  ipAddress: string;
  country?: string;
  region?: string;
  asn?: string;
  firstLogin: Date;
  logins: Date[];
}
const ipAddressSchema = new Schema<IIPAddress>({
  ipAddress: { type: String, required: true },
  country: { type: String },
  region: { type: String },
  asn: { type: String },
  firstLogin: { type: Date, default: Date.now },
  logins: [{ type: Date }]
});

// Modification Schema
export interface IModification extends Document {
  type: string;
  issuerName: string;
  issued: Date;
  effectiveDuration?: number;
  reason?: string; // Added reason based on appeal-routes.ts usage
}
const modificationSchema = new Schema<IModification>({
  type: { type: String, required: true },
  issuerName: { type: String, required: true },
  issued: { type: Date, default: Date.now },
  effectiveDuration: { type: Number },
  reason: { type: String } 
});

// Punishment Schema
export interface IPunishment extends Document {
  id: string;
  issuerName: string;
  issued: Date;
  started: Date;
  type_ordinal: number; // Changed from Int32 to number for simplicity in TS
  modifications: IModification[];
  notes: INote[];
  attachedTicketIds: string[];
  data?: Map<string, any>; 
}
const punishmentSchema = new Schema<IPunishment>({
  id: { type: String, required: true },
  issuerName: { type: String, required: true },
  issued: { type: Date, default: Date.now },
  started: { type: Date, default: Date.now },
  type_ordinal: { type: Number, required: true }, // Mongoose will handle Int32 via Number
  modifications: [modificationSchema],
  notes: [noteSchema],
  attachedTicketIds: [{ type: String }],
  data: { type: Map, of: mongoose.Schema.Types.Mixed }
});

// Player Schema
export interface IPlayer extends Document {
  _id: string;
  minecraftUuid: string;
  usernames: IUsername[];
  notes: INote[];
  ipList: IIPAddress[];
  punishments: IPunishment[];
  pendingNotifications: string[];
  data?: Map<string, any>;
}
const playerSchemaDefinition = new Schema<IPlayer>({
  _id: { type: String },
  minecraftUuid: { type: String, required: true, unique: true },
  usernames: [usernameSchema],
  notes: [noteSchema],
  ipList: [ipAddressSchema],
  punishments: [punishmentSchema],
  pendingNotifications: [{ type: String }],
  data: { type: Map, of: mongoose.Schema.Types.Mixed }
});

// Note: Models are typically compiled by the connection in a multi-tenant setup.
// This file primarily exports interfaces and the schema definition.
export const PlayerSchema = playerSchemaDefinition;
