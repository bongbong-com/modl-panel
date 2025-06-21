import { Connection, Types, Document } from 'mongoose'; // Added Types, Document
import { Request, Response, NextFunction, Express } from 'express'; // Added Express for app type
import { v4 as uuidv4 } from 'uuid'; // For generating new player UUIDs
import { createSystemLog } from './log-routes'; // Import createSystemLog
import { verifyMinecraftApiKey } from '../middleware/api-auth';

interface IUsername {
  username: string;
  date: Date;
}

interface IIPAddress {
  ipAddress: string;
  country?: string;
  region?: string;
  asn?: string;
  proxy?: boolean;
  firstLogin: Date;
  logins: Date[];
}

interface IModification {
  type: string;
  issuerName: string;
  issued: Date;
  effectiveDuration?: number;
}

interface INote {
  text: string;
  date: Date;
  issuerName: string;
  issuerId?: string;
}

interface IPunishment {
  id: string;
  issuerName: string;
  issued: Date;
  started?: Date;
  type_ordinal: number | Types.Decimal128 | { valueOf(): number }; // Adjusted for lean objects
  modifications: IModification[];
  notes: INote[];
  attachedTicketIds: string[];
  data?: Map<string, any>;
  // Helper to get numeric value of type_ordinal
  getTypeOrdinalValue?(): number;
}

interface IPlayer extends Document {
  _id: string;
  minecraftUuid: string;
  usernames: IUsername[];
  notes: INote[];
  ipList: IIPAddress[];
  punishments: IPunishment[];
  pendingNotifications: string[];
  data?: Map<string, any>;
}

interface ITicket extends Document {
  _id: string;
  tags: string[];
  type: string;
  status: string;
  subject?: string;
  created: Date;
  creator: string;
  creatorUuid: string;
  reportedPlayer?: string;
  reportedPlayerUuid?: string;
  chatMessages?: string[];
  notes: any[]; // Define more specific type if needed
  replies: any[]; // Define more specific type if needed
  locked: boolean;
  formData?: Map<string, any>;
  data?: Map<string, any>;
}

/**
 * Utility function to check if a punishment is currently active
 */
function isPunishmentActive(punishment: IPunishment): boolean {
  if (!punishment.type_ordinal) return false;
  // Get the numeric value consistently
  const typeOrdinalValue = typeof punishment.type_ordinal === 'number' 
    ? punishment.type_ordinal 
    : (typeof punishment.type_ordinal.valueOf === 'function' ? punishment.type_ordinal.valueOf() : parseFloat(punishment.type_ordinal.toString()));

  if (punishment.data && punishment.data.has('active') && !punishment.data.get('active')) {
    return false;
  }
  if (punishment.data && punishment.data.has('expires')) {
    const expiry = punishment.data.get('expires');
    if (expiry && new Date(expiry) < new Date()) {
      return false;
    }
  }
  if (typeOrdinalValue === 2) { // Ban type
    if (!punishment.started) {
      return false;
    }
  }
  if (typeOrdinalValue === 1) { // Mute type
    if (!punishment.started) {
      return false;
    }
  }
  return true;
}

export function setupMinecraftRoutes(app: Express) {
  // Apply API key verification middleware to all Minecraft routes
  app.use('/api/minecraft', verifyMinecraftApiKey);

  app.use('/api/minecraft', (req: Request, res: Response, next: NextFunction) => {
    if (!req.serverDbConnection) {
      console.error('Minecraft route accessed without serverDbConnection.');
      return res.status(503).json({
        status: 503,
        message: 'Service Unavailable: Database connection not established for this server.'
      });
    }
    if (!req.serverName) {
      console.error('Minecraft route accessed without serverName.');
      return res.status(500).json({
        status: 500,
        message: 'Internal Server Error: Server name not identified.'
      });
    }
    next();
  });

  /**
   * Player login
   * - Update player's last_connect
   * - Update player's IP list
   * - Check for ban evasion
   * - Start inactive bans or return active punishments
   */
  app.post('/api/minecraft/player/login', async (req: Request, res: Response) => {
    const { minecraftUuid, username, ipAddress, skinHash, ipInfo } = req.body;
    const serverDbConnection = req.serverDbConnection!;
    const serverName = req.serverName!;
    const Player = serverDbConnection.model<IPlayer>('Player');

    try {
      let player = await Player.findOne({ minecraftUuid });

      if (player) {
        // Update last connect and IP list for existing player
        player.data = player.data || new Map<string, any>();
        player.data.set('lastConnect', new Date());

        const existingIp = player.ipList.find((ip: IIPAddress) => ip.ipAddress === ipAddress);
        if (existingIp) {
          existingIp.logins.push(new Date());
        } else if (ipInfo) { // Only add if ipInfo is available
          player.ipList.push({
            ipAddress,
            country: ipInfo.countryCode,
            region: `${ipInfo.regionName}, ${ipInfo.city}`,
            asn: ipInfo.as,
            proxy: ipInfo.proxy || ipInfo.hosting, // Assuming proxy/hosting indicates VPN/proxy
            firstLogin: new Date(),
            logins: [new Date()]
          });
        }

        // Update username list if it's a new username (similar to Java code handling username)
        const existingUsername = player.usernames.find((u: IUsername) => u.username.toLowerCase() === username.toLowerCase());
        if (!existingUsername) {
          player.usernames.push({ username, date: new Date() });
        }

        // Handle unstartedPunishments like in handleBansRestrictions method in Java
        // First create a sorted tree map of punishments by date
        const unstartedPunishments = player.punishments
          .filter((p: IPunishment) => !p.started && isPunishmentActive(p))
          .sort((a: IPunishment, b: IPunishment) => new Date(a.issued).getTime() - new Date(b.issued).getTime());

        let startedAny = false;
        for (const punishment of unstartedPunishments) {
          // Simplified: just start them. Add more complex logic if needed.
          punishment.started = new Date();
          startedAny = true;
          await createSystemLog(serverDbConnection, serverName, `Auto-started punishment ID ${punishment.id} for ${player.usernames[0].username} (${player.minecraftUuid}) on login.`, 'moderation', 'system-login');
        }

        if (startedAny) {
          await createSystemLog(serverDbConnection, serverName, `Started ${unstartedPunishments.length} pending punishments for ${player.usernames[0].username} (${player.minecraftUuid}) on login.`, 'info', 'system-login');
        }

        // Handle restrictions (blockedName, blockedSkin) if present
        // This implementation is simplified since we don't have the same restriction concepts
        if (skinHash) {
            // Placeholder for skin hash checks if needed in the future
        }

        await player.save();
      } else {
        // For new players, we need to get the IP information
        if (!ipInfo) {
          console.warn(`No IP info for new player ${username} (${minecraftUuid}) at IP ${ipAddress}. Skipping IP-based checks.`);
          // Decide if you want to allow login without IP info or return an error
        }

        // Create a new player (similar to Java code: account = new Account(...))
        player = new Player({
          _id: uuidv4(),
          minecraftUuid,
          usernames: [{ username, date: new Date() } as IUsername],
          notes: [] as INote[],
          ipList: ipInfo ? [{ // Only add IP if ipInfo is available
            ipAddress,
            country: ipInfo.countryCode,
            region: `${ipInfo.regionName}, ${ipInfo.city}`,
            asn: ipInfo.as,
            proxy: ipInfo.proxy || ipInfo.hosting,
            firstLogin: new Date(),
            logins: [new Date()]
          } as IIPAddress] : [] as IIPAddress[],
          punishments: [] as IPunishment[],
          pendingNotifications: [] as string[],
          data: new Map<string, any>([['firstJoin', new Date()]])
        });

        // After creating the player, check for linked accounts with this IP (only if ipAddress is present)
        if (ipAddress) {
            const linkedPlayers = await Player.find({
              minecraftUuid: { $ne: minecraftUuid },
              'ipList.ipAddress': ipAddress
            });

            // Similar to handleNewIP in Java, check for alt blocking on new accounts
            for (const linkedAccount of linkedPlayers) {
              const activeBans = linkedAccount.punishments.filter((p: IPunishment) => {
                  const pType = typeof p.type_ordinal === 'number' ? p.type_ordinal : p.type_ordinal.valueOf();
                  return pType === 2 && isPunishmentActive(p);
              });
              if (activeBans.length > 0) {
                // Create a new ban for the new player (ban evasion)
                const newBanId = uuidv4().substring(0, 8);
                const banReason = `Ban Evasion (Linked to: ${linkedAccount.usernames[0].username} - ${linkedAccount.minecraftUuid})`;
                const evasionBan: IPunishment = {
                  id: newBanId,
                  issuerName: 'System', // Or a specific admin/system user
                  issued: new Date(),
                  started: new Date(), // Evasion bans start immediately
                  type_ordinal: 2, // Ban type
                  modifications: [],
                  notes: [{ text: banReason, date: new Date(), issuerName: 'System' } as INote],
                  attachedTicketIds: [],
                  data: new Map<string, any>([
                      ['reason', banReason],
                      ['duration', -1] // Permanent ban
                    ])
                };
                player.punishments.push(evasionBan);
                await createSystemLog(serverDbConnection, serverName, `Player ${username} (${minecraftUuid}) banned for evasion. Linked to ${linkedAccount.usernames[0].username} (${linkedAccount.minecraftUuid}).`, 'moderation', 'system-evasion');
                break; // One evasion ban is enough
              }
            }
        }

        await player.save();
        await createSystemLog(serverDbConnection, serverName, `New player ${username} (${minecraftUuid}) registered`, 'info', 'system-login');
      }
      // Handle mutes separately (similar to handleMute method in Java)
      // Find all mutes for sorting
      const unstartedMutes = player.punishments
        .filter((p: IPunishment) =>
          p.type_ordinal &&
          p.type_ordinal.valueOf() === 1 && // Mute type
          !p.started &&
          isPunishmentActive(p)
        )
        .sort((a: IPunishment, b: IPunishment) => new Date(a.issued).getTime() - new Date(b.issued).getTime());

      const activeMutes = player.punishments
        .filter((p: IPunishment) =>
          p.type_ordinal &&
          p.type_ordinal.valueOf() === 1 && // Mute type
          p.started &&
          isPunishmentActive(p)
        )
        .sort((a: IPunishment, b: IPunishment) => new Date(a.started!).getTime() - new Date(b.started!).getTime());

      // Start the oldest unstarted mute if there are no active mutes
      if (activeMutes.length === 0 && unstartedMutes.length > 0) {
        const muteToStart = unstartedMutes[0];
        muteToStart.started = new Date();
        await player.save();
        await createSystemLog(serverDbConnection, serverName, `Auto-started mute ID ${muteToStart.id} for ${player.usernames[0].username} (${player.minecraftUuid}) on login.`, 'moderation', 'system-login');
      }

      // Get all active punishments (both bans and mutes)
      const activePunishments = player.punishments.filter((p: IPunishment) => isPunishmentActive(p));

      // Convert type_ordinal to plain number for JSON response
      const formattedPunishments = activePunishments.map((p: IPunishment) => ({
        ...p,
        type_ordinal: typeof p.type_ordinal === 'number' ? p.type_ordinal : (typeof p.type_ordinal.valueOf === 'function' ? p.type_ordinal.valueOf() : parseFloat(p.type_ordinal.toString()))
      }));

      return res.status(200).json({
        status: 200,
        activePunishments: formattedPunishments
      });
    } catch (error: any) {
      console.error('Error in player login:', error);
      // Ensure createSystemLog is called with dbConnection and serverName if an error occurs and they are available
      if (serverDbConnection && serverName) {
        await createSystemLog(serverDbConnection, serverName, `Error during player login for ${minecraftUuid}: ${error.message || error}`, 'error', 'system-login');
      }
      return res.status(500).json({
        status: 500,
        message: 'Internal server error'
      });
    }
  });

  /**
   * Player disconnect
   * - Update player's last_disconnect to current time
   */
  app.post('/api/minecraft/player/disconnect', async (req: Request, res: Response) => {
    const { minecraftUuid } = req.body;
    const serverDbConnection = req.serverDbConnection!;
    const serverName = req.serverName!;
    const Player = serverDbConnection.model<IPlayer>('Player');

    try {
      const player = await Player.findOne({ minecraftUuid });
      if (!player) {
        return res.status(404).json({ status: 404, message: 'Player not found' });
      }

      player.data = player.data || new Map<string, any>();
      player.data.set('lastDisconnect', new Date());
      await player.save();

      return res.status(200).json({ status: 200, message: 'Player disconnect time updated' });
    } catch (error: any) {
      console.error('Error in player disconnect:', error);
      await createSystemLog(serverDbConnection, serverName, `Error during player disconnect for ${minecraftUuid}: ${error.message || error}`, 'error', 'system-disconnect');
      return res.status(500).json({
        status: 500,
        message: 'Internal server error'
      });
    }
  });

  /**
   * Create ticket
   * - Create a new ticket
   */
  app.post('/api/minecraft/ticket/create', async (req: Request, res: Response) => {
    const { creatorUuid, creatorUsername, type, subject, reportedPlayerUuid, reportedPlayerUsername, chatMessages, formData } = req.body;
    const serverDbConnection = req.serverDbConnection!;
    const serverName = req.serverName!;
    const Ticket = serverDbConnection.model<ITicket>('Ticket');
    const Player = serverDbConnection.model<IPlayer>('Player'); // For fetching player details if needed

    try {
      // Validate creator exists (optional, but good practice)
      const creator = await Player.findOne({ minecraftUuid: creatorUuid });
      if (!creator) {
        return res.status(400).json({ status: 400, message: 'Ticket creator not found.' });
      }
      
      // Generate a unique ticket ID (example format, adjust as needed)
      const ticketId = `${type.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const newTicket = new Ticket({
        _id: ticketId,
        type,
        subject,
        creator: creatorUsername,
        creatorUuid,
        reportedPlayer: reportedPlayerUsername,
        reportedPlayerUuid,
        chatMessages: chatMessages || [],
        formData: formData || {},
        status: 'Open', // Default status for new tickets
        created: new Date(),
        replies: [],
        notes: [],
        tags: [],
        locked: false,
        data: new Map<string, any>()
      });

      await newTicket.save();
      await createSystemLog(serverDbConnection, serverName, `New ticket ${ticketId} created by ${creatorUsername} (${creatorUuid}). Type: ${type}.`, 'info', 'minecraft-api');

      return res.status(201).json({
        status: 201,
        message: 'Ticket created successfully',
        ticketId: newTicket._id
      });
    } catch (error: any) {
      console.error('Error creating ticket:', error);
      await createSystemLog(serverDbConnection, serverName, `Error creating ticket by ${creatorUsername} (${creatorUuid}): ${error.message || error}`, 'error', 'minecraft-api');
      return res.status(500).json({
        status: 500,
        message: 'Internal server error'
      });
    }
  });

  /**
   * Create punishment
   * - Create a new punishment and update player profile
   */
  app.post('/api/minecraft/punishment/create', async (req: Request, res: Response) => {
    const { targetUuid, issuerName, typeOrdinal, reason, duration, data, notes, attachedTicketIds } = req.body;
    const serverDbConnection = req.serverDbConnection!;
    const serverName = req.serverName!;
    const Player = serverDbConnection.model<IPlayer>('Player');

    try {
      const player = await Player.findOne({ minecraftUuid: targetUuid });
      if (!player) {
        return res.status(404).json({ status: 404, message: 'Target player not found' });
      }

      const punishmentId = uuidv4().substring(0, 8); // Generate an 8-char ID

      const newPunishmentData = new Map<string, any>([
        ['reason', reason],
        ...(duration ? [['duration', duration] as [string, any]] : []),
        ...(duration && duration > 0 ? [['expires', new Date(Date.now() + duration)] as [string, any]] : []),
        ...(data ? Object.entries(data) : [])
      ]);
      const newPunishment: IPunishment = {
        id: punishmentId,
        issuerName,
        issued: new Date(),
        started: (typeOrdinal === 2 || typeOrdinal === 1) ? new Date() : undefined, // Bans/Mutes start immediately, others might not
        type_ordinal: typeOrdinal,
        modifications: [],
        notes: notes ? notes.map((note: any) => ({ text: note.text, date: new Date(), issuerName: note.issuerName || issuerName } as INote)) : [],
        attachedTicketIds: attachedTicketIds || [],
        data: newPunishmentData
      };

      player.punishments.push(newPunishment);
      await player.save();
      await createSystemLog(serverDbConnection, serverName, `Punishment ID ${punishmentId} (Type: ${typeOrdinal}) issued to ${player.usernames[0].username} (${targetUuid}) by ${issuerName}. Reason: ${reason}.`, 'moderation', 'minecraft-api');

      return res.status(201).json({
        status: 201,
        message: 'Punishment created successfully',
        punishmentId
      });
    } catch (error: any) {
      console.error('Error creating punishment:', error);
      await createSystemLog(serverDbConnection, serverName, `Error creating punishment for ${targetUuid} by ${issuerName}: ${error.message || error}`, 'error', 'minecraft-api');
      return res.status(500).json({
        status: 500,
        message: 'Internal server error'
      });
    }
  });

  /**
   * Create player note
   * - Add a note to the player's profile
   */
  app.post('/api/minecraft/player/note/create', async (req: Request, res: Response) => {
    const { targetUuid, issuerName, text } = req.body;
    const serverDbConnection = req.serverDbConnection!;
    const serverName = req.serverName!;
    const Player = serverDbConnection.model<IPlayer>('Player');

    try {
      const player = await Player.findOne({ minecraftUuid: targetUuid });
      if (!player) {
        return res.status(404).json({ status: 404, message: 'Player not found' });
      }

      const newNote: INote = {
        text,
        date: new Date(),
        issuerName,
        // issuerId: // If you have issuer's staff ID, add it here
      };

      player.notes.push(newNote);
      await player.save();
      await createSystemLog(serverDbConnection, serverName, `Note added to player ${player.usernames[0].username} (${targetUuid}) by ${issuerName}.`, 'info', 'minecraft-api');

      return res.status(201).json({ status: 201, message: 'Note created successfully' });
    } catch (error: any) {
      console.error('Error creating player note:', error);
      await createSystemLog(serverDbConnection, serverName, `Error creating note for ${targetUuid} by ${issuerName}: ${error.message || error}`, 'error', 'minecraft-api');
      return res.status(500).json({
        status: 500,
        message: 'Internal server error'
      });
    }
  });

  /**
   * Get player profile
   * - Get player information including punishments and notes
   */
  app.get('/api/minecraft/player', async (req: Request, res: Response) => {
    const { minecraftUuid } = req.query;
    const serverDbConnection = req.serverDbConnection!;
    const Player = serverDbConnection.model<IPlayer>('Player');

    if (!minecraftUuid || typeof minecraftUuid !== 'string') {
      return res.status(400).json({ status: 400, message: 'minecraftUuid query parameter is required' });
    }

    try {
      const player = await Player.findOne({ minecraftUuid }).lean<IPlayer>();
      if (!player) {
        return res.status(404).json({ status: 404, message: 'Player not found' });
      }
      if (player.punishments) {
        // Ensure type_ordinal is consistently a number after .lean()
        player.punishments = player.punishments.map((p: IPunishment) => ({
          ...p,
          type_ordinal: typeof p.type_ordinal === 'number' 
            ? p.type_ordinal 
            : (typeof p.type_ordinal.valueOf === 'function' ? p.type_ordinal.valueOf() : parseFloat(p.type_ordinal.toString())),
        } as IPunishment)); // Cast back to IPunishment after transformation
      }
      return res.status(200).json({ status: 200, player });
    } catch (error: any) {
      console.error('Error getting player profile:', error);
      return res.status(500).json({
        status: 500,
        message: 'Internal server error'
      });
    }
  });

  /**
   * Get linked accounts
   * - Find accounts linked by IP addresses
   */
  app.get('/api/minecraft/player/linked', async (req: Request, res: Response) => {
    const { minecraftUuid } = req.query;
    const serverDbConnection = req.serverDbConnection!;
    const Player = serverDbConnection.model<IPlayer>('Player');

    if (!minecraftUuid || typeof minecraftUuid !== 'string') {
      return res.status(400).json({ status: 400, message: 'minecraftUuid query parameter is required' });
    }

    try {
      const player = await Player.findOne({ minecraftUuid }).select('ipList.ipAddress usernames punishments').lean<IPlayer>(); // Added usernames and punishments for full data
      if (!player || !player.ipList || player.ipList.length === 0) {
        return res.status(200).json({ status: 200, linkedAccounts: [] });
      }
      const playerIps = player.ipList.map((ip: IIPAddress) => ip.ipAddress);
      const linkedPlayers = await Player.find({
        minecraftUuid: { $ne: minecraftUuid },
        'ipList.ipAddress': { $in: playerIps }
      }).select('minecraftUuid usernames punishments').lean<IPlayer[]>(); // Ensure array type for lean

      const formattedLinkedAccounts = linkedPlayers.map((acc: IPlayer) => ({
        minecraftUuid: acc.minecraftUuid,
        username: acc.usernames && acc.usernames.length > 0 ? acc.usernames[0].username : 'N/A',
        activeBans: acc.punishments ? acc.punishments.filter((p: IPunishment) => {
            const pType = typeof p.type_ordinal === 'number' ? p.type_ordinal : p.type_ordinal.valueOf();
            return pType === 2 && isPunishmentActive(p);
        }).length : 0,
        activeMutes: acc.punishments ? acc.punishments.filter((p: IPunishment) => {
            const pType = typeof p.type_ordinal === 'number' ? p.type_ordinal : p.type_ordinal.valueOf();
            return pType === 1 && isPunishmentActive(p);
        }).length : 0,
      }));
      return res.status(200).json({ status: 200, linkedAccounts: formattedLinkedAccounts });
    } catch (error: any) {
      console.error('Error getting linked accounts:', error);
      return res.status(500).json({
        status: 500,
        message: 'Internal server error'
      });
    }
  });
}
