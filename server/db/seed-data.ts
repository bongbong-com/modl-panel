import mongoose from 'mongoose';
import { Player, Staff, Ticket, Log, Settings } from '../models/mongodb-schemas';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// Helper to hash password for staff accounts
async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create a salt and hash using scrypt
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${derivedKey.toString('hex')}.${salt}`);
    });
  });
}

// Seed the database with initial data
export async function seedDatabase() {
  console.log('Seeding database with initial data...');
  
  try {
    // Only seed if database is empty
    const playerCount = await Player.countDocuments();
    const staffCount = await Staff.countDocuments();
    const ticketCount = await Ticket.countDocuments();
    
    if (playerCount > 0 || staffCount > 0 || ticketCount > 0) {
      console.log('Database already has data, skipping seed operation');
      return;
    }
    
    // Create sample players
    const players = [
      {
        _id: uuidv4(),
        minecraftUuid: '98f7e654-3d21-321d-4c5b-6a7890123d4e',
        usernames: [
          { username: 'DragonSlayer123', date: new Date('2023-01-15') },
          { username: 'DragonMaster123', date: new Date('2023-08-20') }
        ],
        notes: [
          {
            text: 'Excessive caps in chat',
            date: new Date('2023-04-12'),
            issuerId: 'staff-001',
            issuerName: 'Moderator2'
          }
        ],
        ipList: [
          { ipAddress: '192.168.1.1', country: 'US', region: 'CA', asn: 'AS123', firstLogin: new Date('2023-01-15') },
          { ipAddress: '192.168.1.2', country: 'US', region: 'CA', asn: 'AS123', firstLogin: new Date('2023-08-20') }
        ],
        punishments: [
          {
            id: 'ban-001',
            type: 'Chat Abuse',
            issuerId: 'staff-001',
            issuerName: 'Moderator2',
            reason: 'Repeated harassment of other players',
            date: new Date('2023-04-15'),
            expires: new Date('2023-04-22'),
            active: false,
            data: new Map<string, string | boolean | number>([
              ['severity', 'Medium'],
              ['autoDetected', false]
            ]),
            attachedTicketIds: []
          }
        ],
        pendingNotifications: []
      },
      {
        _id: uuidv4(),
        minecraftUuid: '12a3b456-7c89-123a-4b5c-6d7890123e4f',
        usernames: [
          { username: 'SkyWalker42', date: new Date('2022-11-10') }
        ],
        notes: [],
        ipList: [
          { ipAddress: '192.168.2.1', country: 'US', region: 'NY', asn: 'AS456', firstLogin: new Date('2022-11-10') }
        ],
        punishments: [
          {
            id: 'ban-002',
            type: 'Cheating',
            issuerId: 'staff-002',
            issuerName: 'AdminUser',
            reason: 'Using hacked client with fly mod',
            date: new Date('2023-05-20'),
            expires: null, // Permanent ban
            active: true,
            data: new Map<string, string | boolean | number>([
              ['severity', 'High'],
              ['autoDetected', true],
              ['proofLink', 'https://example.com/screenshot1.jpg']
            ]),
            attachedTicketIds: ['APPEAL-123456']
          }
        ],
        pendingNotifications: []
      },
      {
        _id: uuidv4(),
        minecraftUuid: '34c5d678-9e0f-456g-7h8i-9j0k12345l6m',
        usernames: [
          { username: 'CraftMaster99', date: new Date('2023-02-05') }
        ],
        notes: [
          {
            text: 'Helped with server event',
            date: new Date('2023-03-10'),
            issuerId: 'staff-002',
            issuerName: 'AdminUser'
          }
        ],
        ipList: [
          { ipAddress: '192.168.3.1', country: 'UK', region: 'London', asn: 'AS789', firstLogin: new Date('2023-02-05') }
        ],
        punishments: [],
        pendingNotifications: []
      }
    ];
    
    // Create staff members
    const staffPassword = await hashPassword('admin123');
    const staff = [
      {
        _id: 'staff-001',
        email: 'moderator@example.com',
        username: 'Moderator2',
        password: staffPassword,
        profilePicture: 'https://ui-avatars.com/api/?name=Moderator2',
        admin: false,
        twoFaSecret: crypto.randomBytes(10).toString('hex')
      },
      {
        _id: 'staff-002',
        email: 'admin@example.com',
        username: 'AdminUser',
        password: staffPassword,
        profilePicture: 'https://ui-avatars.com/api/?name=AdminUser',
        admin: true,
        twoFaSecret: crypto.randomBytes(10).toString('hex')
      }
    ];
    
    // Create tickets
    const tickets = [
      {
        _id: 'TICKET-123456',
        created: new Date('2023-06-15'),
        creator: 'DragonSlayer123',
        tags: ['bug', 'UI', 'critical'],
        replies: [
          {
            name: 'DragonSlayer123',
            content: 'I found a bug where the inventory UI disappears when opening the chat window.',
            type: 'player',
            created: new Date('2023-06-15'),
            staff: false
          },
          {
            name: 'System',
            content: 'Ticket has been assigned to Moderator2',
            type: 'system',
            created: new Date('2023-06-15T01:30:00'),
            staff: false
          },
          {
            name: 'Moderator2',
            content: 'Thank you for reporting this. I was able to reproduce the issue. Our development team will look into it.',
            type: 'staff',
            created: new Date('2023-06-16'),
            staff: true
          }
        ],
        notes: [
          {
            content: 'Verified with dev team, fix scheduled for next patch',
            author: 'AdminUser',
            date: new Date('2023-06-17')
          }
        ],
        data: new Map<string, string | boolean | number>([
          ['status', 'In Progress'],
          ['priority', 'Medium'],
          ['subject', 'Inventory UI Bug'],
          ['category', 'Bug Report'],
          ['assignedTo', 'Moderator2']
        ])
      },
      {
        _id: 'APPEAL-123456',
        created: new Date('2023-05-25'),
        creator: 'SkyWalker42',
        tags: ['appeal', 'Cheating'],
        replies: [
          {
            name: 'SkyWalker42',
            content: 'Appeal Details:\n\nAppeal Reason: I was not using any hacks. My internet connection was lagging and that made it look like I was flying.\n\nEvidence: None\n\nContact Email: player@example.com',
            type: 'player',
            created: new Date('2023-05-25'),
            staff: false
          },
          {
            name: 'System',
            content: 'Your appeal has been received and will be reviewed by our moderation team.',
            type: 'system',
            created: new Date('2023-05-25T00:10:00'),
            staff: false
          },
          {
            name: 'AdminUser',
            content: 'We have reviewed your appeal and the evidence. Our automated system detected impossible movement patterns that cannot be explained by lag. Appeal denied.',
            type: 'staff',
            created: new Date('2023-05-26'),
            staff: true
          }
        ],
        notes: [
          {
            content: 'Reviewed video evidence, definitely showing hacked client usage',
            author: 'AdminUser',
            date: new Date('2023-05-26')
          }
        ],
        data: new Map<string, string | boolean | number>([
          ['status', 'Rejected'],
          ['punishmentId', 'ban-002'],
          ['playerUuid', '12a3b456-7c89-123a-4b5c-6d7890123e4f'],
          ['email', 'player@example.com']
        ])
      },
      {
        _id: 'TICKET-654321',
        created: new Date('2023-07-01'),
        creator: 'CraftMaster99',
        tags: ['player', 'harassment'],
        replies: [
          {
            name: 'CraftMaster99',
            content: 'Player DragonSlayer123 was spamming inappropriate messages in global chat.',
            type: 'player',
            created: new Date('2023-07-01'),
            staff: false
          },
          {
            name: 'System',
            content: 'Ticket has been assigned to Moderator2',
            type: 'system',
            created: new Date('2023-07-01T00:15:00'),
            staff: false
          },
          {
            name: 'Moderator2',
            content: 'Thank you for your report. I have reviewed the chat logs and issued a warning to the player.',
            type: 'staff',
            created: new Date('2023-07-02'),
            staff: true
          }
        ],
        notes: [],
        data: new Map<string, string | boolean | number>([
          ['status', 'Resolved'],
          ['priority', 'Low'],
          ['subject', 'Chat Spam Report'],
          ['category', 'Player Report'],
          ['assignedTo', 'Moderator2'],
          ['relatedPlayer', 'DragonSlayer123'],
          ['relatedPlayerId', '98f7e654-3d21-321d-4c5b-6a7890123d4e']
        ])
      }
    ];
    
    // Create system logs
    const logs = [
      {
        description: 'Server started',
        level: 'info',
        source: 'system',
        created: new Date('2023-07-01')
      },
      {
        description: 'Player SkyWalker42 banned for cheating',
        level: 'moderation',
        source: 'AdminUser',
        created: new Date('2023-05-20')
      },
      {
        description: 'New appeal submitted for ban-002',
        level: 'info',
        source: 'system',
        created: new Date('2023-05-25')
      }
    ];
    
    // Create default settings
    const defaultSettings = new Map<string, any>();
    
    // Default punishment durations (in milliseconds)
    defaultSettings.set('defaultPunishmentDurations', {
      'Chat Abuse': 7 * 24 * 60 * 60 * 1000, // 7 days
      'Game Abuse': 14 * 24 * 60 * 60 * 1000, // 14 days
      'Cheating': 30 * 24 * 60 * 60 * 1000, // 30 days
      'Bad Name': 0, // Until fixed
      'Bad Skin': 0, // Until fixed
      'Security Ban': 3 * 24 * 60 * 60 * 1000 // 3 days
    });
    
    const settings = [
      {
        settings: defaultSettings
      }
    ];
    
    // Insert data into collections
    await Player.insertMany(players);
    await Staff.insertMany(staff);
    await Ticket.insertMany(tickets);
    await Log.insertMany(logs);
    await Settings.insertMany(settings);
    
    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}