import mongoose from 'mongoose';

// Ticket Subscription Schema
const TicketSubscriptionSchema = new mongoose.Schema({
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  staffUsername: {
    type: String,
    required: true,
    index: true
  },
  subscribedAt: {
    type: Date,
    default: Date.now
  },
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  unsubscribedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
TicketSubscriptionSchema.index({ ticketId: 1, staffUsername: 1 }, { unique: true });
TicketSubscriptionSchema.index({ staffUsername: 1, active: 1 });

// Ticket Subscription Update Schema
const TicketSubscriptionUpdateSchema = new mongoose.Schema({
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  replyContent: {
    type: String,
    required: true,
    maxlength: 1000 // Truncated version of the reply for notification purposes
  },
  replyBy: {
    type: String,
    required: true
  },
  replyAt: {
    type: Date,
    required: true,
    index: true
  },
  isStaffReply: {
    type: Boolean,
    default: false
  },
  readBy: [{
    type: String // Array of staff usernames who have read this update
  }]
}, {
  timestamps: true
});

// Index for efficient queries
TicketSubscriptionUpdateSchema.index({ ticketId: 1, replyAt: -1 });
TicketSubscriptionUpdateSchema.index({ replyAt: -1 });

export { TicketSubscriptionSchema, TicketSubscriptionUpdateSchema };