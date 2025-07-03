import { Connection, Types, Document } from 'mongoose'; // Added Types, Document
import { Request, Response, NextFunction, Express } from 'express'; // Added Express for app type
import { v4 as uuidv4 } from 'uuid'; // For generating new player UUIDs
import { createSystemLog } from './log-routes'; // Import createSystemLog
import { verifyMinecraftApiKey } from '../middleware/api-auth';
import { IIPAddress, IModification, INote, IPunishment, IPlayer, ITicket, IUsername } from 'modl-shared-web/types';

/**
 * Utility function to safely get data from punishment.data (handles both Map and plain object)
 */
function getPunishmentData(punishment: IPunishment, key: string): any {
  if (!punishment.data) return undefined;
  
  // Handle Map objects
  if (typeof punishment.data.get === 'function') {
    return punishment.data.get(key);
  }
  
  // Handle plain objects
  if (typeof punishment.data === 'object') {
    return (punishment.data as any)[key];
  }
  
  return undefined;
}

/**
 * Utility function to safely set data in punishment.data (handles both Map and plain object)
 */
function setPunishmentData(punishment: IPunishment, key: string, value: any): void {
  // Initialize data if it doesn't exist
  if (!punishment.data) {
    punishment.data = new Map();
  }
  
  // Handle Map objects
  if (typeof punishment.data.set === 'function') {
    punishment.data.set(key, value);
    return;
  }
  
  // Handle plain objects - convert to Map
  if (typeof punishment.data === 'object') {
    const newMap = new Map();
    // Copy existing data
    for (const [k, v] of Object.entries(punishment.data)) {
      newMap.set(k, v);
    }
    // Set new value
    newMap.set(key, value);
    punishment.data = newMap;
  }
}

/**
 * Load punishment type configuration from database
 */
async function loadPunishmentTypeConfig(dbConnection: Connection): Promise<Map<number, "BAN" | "MUTE">> {
  const typeMap = new Map<number, "BAN" | "MUTE">();
  
  // Set hardcoded administrative and system types
  typeMap.set(1, "MUTE"); // Manual Mute
  typeMap.set(2, "BAN");  // Manual Ban
  typeMap.set(3, "BAN");  // Security Ban
  typeMap.set(4, "BAN");  // Linked Ban
  typeMap.set(5, "BAN");  // Blacklist
  
  try {
    const Settings = dbConnection.model('Settings');
    const settingsDoc = await Settings.findOne({});
    
    if (settingsDoc?.settings) {
      const punishmentTypes = settingsDoc.settings.get('punishmentTypes') || [];
      
      for (const punishmentType of punishmentTypes) {
        // Only process custom punishment types (ordinal 6+)
        if (punishmentType.ordinal && punishmentType.ordinal >= 6) {
          let type: "BAN" | "MUTE" = "BAN"; // Default to ban
          
          // Check duration configuration
          if (punishmentType.durations) {
            // Check regular/first offense as the default type
            const firstDuration = punishmentType.durations.regular?.first || punishmentType.durations.low?.first;
            if (firstDuration?.type) {
              type = firstDuration.type.toUpperCase().includes('BAN') ? "BAN" : "MUTE";
            }
          } else if (punishmentType.singleSeverityDurations) {
            // Check single severity duration
            const firstDuration = punishmentType.singleSeverityDurations.first;
            if (firstDuration?.type) {
              type = firstDuration.type.toUpperCase().includes('BAN') ? "BAN" : "MUTE";
            }
          } else if (punishmentType.name) {
            // Fallback to name-based detection
            if (punishmentType.name.toLowerCase().includes('mute')) {
              type = "MUTE";
            } else if (punishmentType.name.toLowerCase().includes('ban')) {
              type = "BAN";
            }
          }
          
          typeMap.set(punishmentType.ordinal, type);
        }
      }
    }
  } catch (error) {
    console.error('Error loading punishment type configuration:', error);
  }
  
  return typeMap;
}

/**
 * Utility function to determine punishment type based on type_ordinal and preloaded config
 */
function getPunishmentType(punishment: IPunishment, typeConfig: Map<number, "BAN" | "MUTE">): "BAN" | "MUTE" {
  // Check preloaded config first
  const configuredType = typeConfig.get(punishment.type_ordinal);
  if (configuredType) {
    return configuredType;
  }
  
  // Fallback logic for unknown ordinals
  if (punishment.type_ordinal === 1) {
    return "MUTE"; // Manual Mute
  }
  
  // All other ordinals (2, 3, 4, 5 and unknown) default to BAN
  return "BAN";
}

/**
 * Utility function to check if punishment is a ban
 */
function isBanPunishment(punishment: IPunishment, typeConfig: Map<number, "BAN" | "MUTE">): boolean {
  return getPunishmentType(punishment, typeConfig) === "BAN";
}

/**
 * Utility function to check if punishment is a mute
 */
function isMutePunishment(punishment: IPunishment, typeConfig: Map<number, "BAN" | "MUTE">): boolean {
  return getPunishmentType(punishment, typeConfig) === "MUTE";
}

/**
 * Calculate the actual expiration timestamp for a punishment
 * For unstarted punishments, calculates what expiration would be if started now
 */
function calculateExpiration(punishment: IPunishment): number | null {
  // First check if effective state has an expiry (from modifications)
  const effectiveState = getEffectivePunishmentState(punishment);
  if (effectiveState.effectiveExpiry) {
    return effectiveState.effectiveExpiry.getTime();
  }
  
  const duration = getPunishmentData(punishment, 'duration');
  if (duration === undefined || duration === null) {
    return null; // No duration specified
  }
  
  if (duration === -1) {
    return null; // Permanent punishment
  }
  
  // For started punishments, use actual start time
  if (punishment.started && punishment.started !== null && punishment.started !== undefined) {
    const startTime = new Date(punishment.started).getTime();
    return startTime + Number(duration);
  }
  
  // For unstarted punishments, calculate as if starting now (for display purposes)
  const nowTime = new Date().getTime();
  return nowTime + Number(duration);
}

/**
 * Get and clear pending notifications for a player
 * Returns the notifications and removes them from the player's pendingNotifications array
 */
async function getAndClearPlayerNotifications(
  dbConnection: Connection, 
  playerUuid: string
): Promise<string[]> {
  try {
    const Player = dbConnection.model('Player');
    const player = await Player.findOne({ minecraftUuid: playerUuid });
    
    if (!player || !player.pendingNotifications || player.pendingNotifications.length === 0) {
      return [];
    }
    
    const notifications = [...player.pendingNotifications];
    
    // Clear the notifications
    await Player.updateOne(
      { minecraftUuid: playerUuid },
      { $set: { pendingNotifications: [] } }
    );
    
    return notifications;
  } catch (error) {
    console.error(`Error getting notifications for player ${playerUuid}:`, error);
    return [];
  }
}

/**
 * Get the appropriate description for a punishment
 * Uses punishment type player description for non-manual punishments, notes for manual ones
 */
async function getPunishmentDescription(
  punishment: IPunishment, 
  dbConnection: Connection
): Promise<string> {
  const defaultDescription = 'No reason provided';
  
  // For manual punishments (Manual Mute=1, Manual Ban=2, Kick=0), use notes
  if (punishment.type_ordinal <= 2) {
    const noteText = punishment.notes && punishment.notes.length > 0 ? punishment.notes[0].text : null;
    return noteText || defaultDescription;
  }
  
  // For non-manual punishments, get the player description from punishment type configuration
  try {
    const Settings = dbConnection.model('Settings');
    const settingsDoc = await Settings.findOne({});
    
    if (settingsDoc?.settings) {
      const punishmentTypes = settingsDoc.settings.get('punishmentTypes') || [];
      const punishmentType = punishmentTypes.find((pt: any) => pt.ordinal === punishment.type_ordinal);
      
      if (punishmentType?.playerDescription) {
        return punishmentType.playerDescription;
      }
    }
  } catch (error) {
    console.error('Error fetching punishment type description:', error);
  }
  
  // Fallback to notes if no player description found
  const noteText = punishment.notes && punishment.notes.length > 0 ? punishment.notes[0].text : null;
  return noteText || defaultDescription;
}

/**
 * Utility function to get the effective punishment state considering modifications
 */
function getEffectivePunishmentState(punishment: IPunishment): { effectiveActive: boolean; effectiveExpiry: Date | null; hasModifications: boolean } {
  const modifications = punishment.modifications || [];
  const expiresData = getPunishmentData(punishment, 'expires');
  const originalExpiry = expiresData ? new Date(expiresData) : null;
  const activeData = getPunishmentData(punishment, 'active');
  const originalActive = activeData !== undefined ? activeData !== false : true;
  
  let effectiveActive = originalActive;
  let effectiveExpiry = originalExpiry;
  
  // Apply modifications in chronological order
  const sortedModifications = modifications.sort((a: IModification, b: IModification) => {
    const dateA = a.issued ? new Date(a.issued) : new Date(0);
    const dateB = b.issued ? new Date(b.issued) : new Date(0);
    return dateA.getTime() - dateB.getTime();
  });
  
  for (const mod of sortedModifications) {
    const modDate = mod.issued ? new Date(mod.issued) : new Date();
    
    if (mod.type === 'MANUAL_PARDON' || mod.type === 'APPEAL_ACCEPT') {
      effectiveActive = false;
    } else if (mod.type === 'MANUAL_DURATION_CHANGE') {
      // Recalculate expiry based on modification  
      const effectiveDuration = mod.data ? getPunishmentData({ data: mod.data } as IPunishment, 'effectiveDuration') : undefined;
      if (effectiveDuration === 0 || effectiveDuration === -1) {
        effectiveExpiry = null; // Permanent
        effectiveActive = true;
      } else if (effectiveDuration && effectiveDuration > 0) {
        effectiveExpiry = new Date(modDate.getTime() + effectiveDuration);
        effectiveActive = effectiveExpiry.getTime() > new Date().getTime();
      }
    }
  }
  
  return { effectiveActive, effectiveExpiry, hasModifications: modifications.length > 0 };
}

/**
 * Utility function to check if a punishment is valid for execution (ignores started status)
 */
function isPunishmentValid(punishment: IPunishment): boolean {
  if (!punishment.type_ordinal) return false;

  // Get effective state considering modifications
  const { effectiveActive, effectiveExpiry } = getEffectivePunishmentState(punishment);
  
  // If explicitly marked as inactive by modifications
  if (!effectiveActive) {
    return false;
  }
  
  // Check if expired
  if (effectiveExpiry && effectiveExpiry < new Date()) {
    return false;
  }
  
  return true;
}

/**
 * Utility function to check if a punishment is currently active (started and valid)
 */
function isPunishmentActive(punishment: IPunishment, typeConfig: Map<number, "BAN" | "MUTE">): boolean {
  if (!isPunishmentValid(punishment)) {
    return false;
  }
  
  // For punishments that need to be started (bans/mutes), check if they've been started
  if ((isBanPunishment(punishment, typeConfig) || isMutePunishment(punishment, typeConfig)) && (!punishment.started || punishment.started === null || punishment.started === undefined)) {
    return false;
  }
  
  return true;
}

export function setupMinecraftRoutes(app: Express): void {
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
      // Load punishment type configuration
      const punishmentTypeConfig = await loadPunishmentTypeConfig(serverDbConnection);
      
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

        // Don't auto-start punishments on login - they should only be started when server acknowledges

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
              const activeBans = linkedAccount.punishments.filter((p: IPunishment) => isBanPunishment(p, punishmentTypeConfig) && isPunishmentActive(p, punishmentTypeConfig));
              if (activeBans.length > 0) {
                // Create a new ban for the new player (ban evasion)
                const newBanId = uuidv4().substring(0, 8);
                const banReason = `Ban Evasion (Linked to: ${linkedAccount.usernames[0].username} - ${linkedAccount.minecraftUuid})`;
                const evasionBan: IPunishment = {
                  id: newBanId,
                  issuerName: 'System', // Or a specific admin/system user
                  issued: new Date(),
                  started: undefined, // Even evasion bans need server acknowledgement
                  type_ordinal: 2, // Manual Ban
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
      // Get both started and unstarted punishments for login response
      // Include:
      // 1. Started punishments that are still active
      // 2. Unstarted punishments that are valid (for immediate execution)
      const startedActivePunishments = player.punishments.filter((punishment: IPunishment) => {
        // Must be started
        if (!punishment.started || punishment.started === null || punishment.started === undefined) return false;
        
        // Get effective state considering modifications (pardons, duration changes, etc.)
        const effectiveState = getEffectivePunishmentState(punishment);
        
        // If punishment has been pardoned or otherwise made inactive by modifications
        if (!effectiveState.effectiveActive) return false;

        // Check duration-based expiry using effective expiry if available
        if (effectiveState.effectiveExpiry) {
          return effectiveState.effectiveExpiry.getTime() > new Date().getTime();
        }
        
        // Fallback to original duration logic for punishments without modifications
        const duration = getPunishmentData(punishment, 'duration');
        if (duration === -1 || duration === undefined) return true; // Permanent punishment
        
        const startTime = new Date(punishment.started).getTime();
        const endTime = startTime + Number(duration);
        
        return endTime > Date.now(); // Active if not expired
      });

      // Get valid unstarted punishments (for immediate execution by server)
      const unstartedValidPunishments = player.punishments
        .filter((p: IPunishment) => (!p.started || p.started === null || p.started === undefined) && isPunishmentValid(p))
        .sort((a: IPunishment, b: IPunishment) => new Date(a.issued).getTime() - new Date(b.issued).getTime());

      // Implement stacking: only include oldest unstarted ban + oldest unstarted mute
      const oldestUnstartedBan = unstartedValidPunishments.find((p: IPunishment) => isBanPunishment(p, punishmentTypeConfig));
      const oldestUnstartedMute = unstartedValidPunishments.find((p: IPunishment) => isMutePunishment(p, punishmentTypeConfig));

      // Combine started active punishments with priority unstarted ones
      const activePunishments = [
        ...startedActivePunishments,
        ...(oldestUnstartedBan ? [oldestUnstartedBan] : []),
        ...(oldestUnstartedMute ? [oldestUnstartedMute] : [])
      ];

      // Convert to simplified active punishment format with proper descriptions
      const formattedPunishments = await Promise.all(activePunishments.map(async (p: IPunishment) => {
        const description = await getPunishmentDescription(p, serverDbConnection);
        const punishmentType = getPunishmentType(p, punishmentTypeConfig);
        
        return {
          type: punishmentType,
          started: p.started ? true : false,
          expiration: calculateExpiration(p),
          description: description,
          id: p.id
        };
      }));

      // Get and clear pending notifications for the player
      const pendingNotifications = await getAndClearPlayerNotifications(serverDbConnection, minecraftUuid);

      return res.status(200).json({
        status: 200,
        activePunishments: formattedPunishments,
        pendingNotifications: pendingNotifications,
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
    const { targetUuid, issuerName, type, reason, duration, data, notes, attachedTicketIds } = req.body;
    const serverDbConnection = req.serverDbConnection!;
    const serverName = req.serverName!;
    const Player = serverDbConnection.model<IPlayer>('Player');

    try {
      const player = await Player.findOne({ minecraftUuid: targetUuid });
      if (!player) {
        return res.status(404).json({ status: 404, message: 'Target player not found' });
      }

      const punishmentId = uuidv4().substring(0, 8); // Generate an 8-char ID

      // Convert type string to type_ordinal
      let type_ordinal: number;
      if (type === 'Mute' || type === 'MUTE') {
        type_ordinal = 1; // Manual Mute
      } else if (type === 'Ban' || type === 'BAN') {
        type_ordinal = 2; // Manual Ban
      } else {
        return res.status(400).json({ status: 400, message: 'Invalid punishment type' });
      }

      const newPunishmentData = new Map<string, any>([
        ['reason', reason],
        ...(duration ? [['duration', duration] as [string, any]] : []),
        // Don't set expires until punishment is started by server
        ...(data ? Object.entries(data) : [])
      ]);
      const newPunishment: IPunishment = {
        id: punishmentId,
        issuerName,
        issued: new Date(),
        // Don't set started until server acknowledges execution
        started: undefined,
        type_ordinal: type_ordinal,
        modifications: [],
        notes: notes ? notes.map((note: any) => ({ text: note.text, date: new Date(), issuerName: note.issuerName || issuerName } as INote)) : [],
        attachedTicketIds: attachedTicketIds || [],
        data: newPunishmentData
      };

      player.punishments.push(newPunishment);
      await player.save();
      await createSystemLog(serverDbConnection, serverName, `Punishment ID ${punishmentId} (Type: ${type}) issued to ${player.usernames[0].username} (${targetUuid}) by ${issuerName}. Reason: ${reason}.`, 'moderation', 'minecraft-api');

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
      // Load punishment type configuration
      const punishmentTypeConfig = await loadPunishmentTypeConfig(serverDbConnection);
      
      const player = await Player.findOne({ minecraftUuid }).lean<IPlayer>();
      if (!player) {
        return res.status(404).json({ status: 404, message: 'Player not found' });
      }
      const responsePlayer = {
        ...player,
        punishments: player.punishments ? player.punishments.map((p: IPunishment) => ({
          ...p,
          type: getPunishmentType(p, punishmentTypeConfig),
        })) : [],
      };
      return res.status(200).json({ status: 200, player: responsePlayer });
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
      // Load punishment type configuration
      const punishmentTypeConfig = await loadPunishmentTypeConfig(serverDbConnection);
      
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
        activeBans: acc.punishments ? acc.punishments.filter((p: IPunishment) => isBanPunishment(p, punishmentTypeConfig) && isPunishmentActive(p, punishmentTypeConfig)).length : 0,
        activeMutes: acc.punishments ? acc.punishments.filter((p: IPunishment) => isMutePunishment(p, punishmentTypeConfig) && isPunishmentActive(p, punishmentTypeConfig)).length : 0,
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

  /**
   * Get player profile by username
   * - Get player information by username (most recent player to use that username)
   */
  app.get('/api/minecraft/player-name', async (req: Request, res: Response) => {
    const { username } = req.query;
    const serverDbConnection = req.serverDbConnection!;
    const Player = serverDbConnection.model<IPlayer>('Player');

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ status: 400, message: 'username query parameter is required' });
    }

    try {
      // Load punishment type configuration
      const punishmentTypeConfig = await loadPunishmentTypeConfig(serverDbConnection);
      // Find all players who have used this username (case-insensitive)
      const playersWithUsername = await Player.find({
        'usernames.username': { $regex: new RegExp(`^${username}$`, 'i') }
      }).lean<IPlayer[]>();

      if (!playersWithUsername || playersWithUsername.length === 0) {
        return res.status(404).json({ status: 404, message: 'No player found with that username' });
      }

      // Find the player who most recently logged in with this username
      let mostRecentPlayer: IPlayer | null = null;
      let mostRecentLogin: Date | null = null;

      for (const player of playersWithUsername) {
        // Get the most recent login time from player data
        const lastConnect = player.data?.get('lastConnect');
        const loginTime = lastConnect ? new Date(lastConnect) : new Date(0);

        if (!mostRecentLogin || loginTime > mostRecentLogin) {
          mostRecentLogin = loginTime;
          mostRecentPlayer = player;
        }
      }

      if (!mostRecentPlayer) {
        return res.status(404).json({ status: 404, message: 'Player not found' });
      }      
      
      const responsePlayer = {
        ...mostRecentPlayer,
        punishments: mostRecentPlayer.punishments ? mostRecentPlayer.punishments.map((p: IPunishment) => ({
          ...p,
          type: getPunishmentType(p, punishmentTypeConfig),
        })) : [],
      };

      return res.status(200).json({ status: 200, player: responsePlayer });
    } catch (error: any) {
      console.error('Error getting player profile by username:', error);
      return res.status(500).json({
        status: 500,
        message: 'Internal server error'
      });
    }
  });

  /**
   * Sync endpoint for Minecraft server polling
   * - Get pending punishments that need to be executed
   * - Update online player status
   * - Return new punishments since last sync
   * Called every 5 seconds by Minecraft server
   */
  app.post('/api/minecraft/sync', async (req: Request, res: Response) => {
    const { onlinePlayers, lastSyncTimestamp } = req.body;
    const serverDbConnection = req.serverDbConnection!;
    const serverName = req.serverName!;
    const Player = serverDbConnection.model<IPlayer>('Player');

    try {
      // Load punishment type configuration
      const punishmentTypeConfig = await loadPunishmentTypeConfig(serverDbConnection);
      
      const now = new Date();
      const lastSync = lastSyncTimestamp ? new Date(lastSyncTimestamp) : new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default to 24 hours ago if no timestamp

      // 1. Update online status for all players
      if (onlinePlayers && Array.isArray(onlinePlayers)) {
        // Set all players to offline first
        await Player.updateMany(
          {},
          { $set: { 'data.isOnline': false, 'data.lastSeen': now } }
        );

        // Set online players to online
        const onlineUuids = onlinePlayers.map((p: any) => p.uuid || p.minecraftUuid);
        if (onlineUuids.length > 0) {
          await Player.updateMany(
            { minecraftUuid: { $in: onlineUuids } },
            { $set: { 'data.isOnline': true, 'data.lastSeen': now } }
          );
        }
      }

      // 2. Find pending punishments for online players specifically
      const onlineUuids = onlinePlayers ? onlinePlayers.map((p: any) => p.uuid || p.minecraftUuid) : [];
      const pendingPunishments: any[] = [];

      if (onlineUuids.length > 0) {
        // Get online players with unstarted punishments or recently issued punishments
        const onlinePlayersWithPendingPunishments = await Player.find({
          minecraftUuid: { $in: onlineUuids },
          $or: [
            { 'punishments.started': null }, // Unstarted punishments (null)
            { 'punishments.started': { $exists: false } }, // Unstarted punishments (missing field)
            { 'punishments.issued': { $gte: lastSync } }    // Recently issued punishments
          ]
        }).lean();

        for (const player of onlinePlayersWithPendingPunishments) {
          // Get all valid unstarted punishments for this player, prioritizing recently issued ones
          const validUnstartedPunishments = player.punishments
            .filter((p: IPunishment) => (!p.started || p.started === null || p.started === undefined) && isPunishmentValid(p))
            .sort((a: IPunishment, b: IPunishment) => new Date(a.issued).getTime() - new Date(b.issued).getTime());

          // Also get recently issued punishments that might need immediate execution
          const recentlyIssuedUnstarted = validUnstartedPunishments
            .filter((p: IPunishment) => new Date(p.issued) >= lastSync);

          // Prioritize recently issued punishments, then fall back to oldest unstarted
          const priorityBan = recentlyIssuedUnstarted.find((p: IPunishment) => isBanPunishment(p, punishmentTypeConfig)) || 
                             validUnstartedPunishments.find((p: IPunishment) => isBanPunishment(p, punishmentTypeConfig));
          const priorityMute = recentlyIssuedUnstarted.find((p: IPunishment) => isMutePunishment(p, punishmentTypeConfig)) || 
                              validUnstartedPunishments.find((p: IPunishment) => isMutePunishment(p, punishmentTypeConfig));

          // Add the priority ban if exists
          if (priorityBan) {
            const description = await getPunishmentDescription(priorityBan, serverDbConnection);
            const banType = getPunishmentType(priorityBan, punishmentTypeConfig);

            pendingPunishments.push({
              minecraftUuid: player.minecraftUuid,
              username: player.usernames[player.usernames.length - 1]?.username || 'Unknown',
              punishment: {
                type: banType,
                started: false,
                expiration: calculateExpiration(priorityBan),
                description: description,
                id: priorityBan.id
              }
            });
          }

          // Add the priority mute if exists
          if (priorityMute) {
            const description = await getPunishmentDescription(priorityMute, serverDbConnection);
            const muteType = getPunishmentType(priorityMute, punishmentTypeConfig);

            pendingPunishments.push({
              minecraftUuid: player.minecraftUuid,
              username: player.usernames[player.usernames.length - 1]?.username || 'Unknown',
              punishment: {
                type: muteType,
                started: false,
                expiration: calculateExpiration(priorityMute),
                description: description,
                id: priorityMute.id
              }
            });
          }
        }
      }

      // 3. Find recently started punishments that need to be applied
      const recentlyStartedPlayers = await Player.find({
        'punishments.started': { $gte: lastSync }
      }).lean();

      const recentlyStartedPunishments: any[] = [];

      for (const player of recentlyStartedPlayers) {
        const recentlyStarted = player.punishments
          .filter((p: IPunishment) => p.started && new Date(p.started) >= lastSync);

        for (const punishment of recentlyStarted) {
          const description = await getPunishmentDescription(punishment, serverDbConnection);
          const punishmentType = getPunishmentType(punishment, punishmentTypeConfig);

          recentlyStartedPunishments.push({
            minecraftUuid: player.minecraftUuid,
            username: player.usernames[player.usernames.length - 1]?.username || 'Unknown',
            punishment: {
              type: punishmentType,
              started: true,
              expiration: calculateExpiration(punishment),
              description: description,
              id: punishment.id
            }
          });
        }
      }

      // 4. Find recently modified punishments (pardons, duration changes, etc.)
      const recentlyModifiedPunishments = await Player.aggregate([
        {
          $match: {
            'punishments.modifications.issued': { $gte: lastSync }
          }
        },
        {
          $unwind: '$punishments'
        },
        {
          $match: {
            'punishments.modifications.issued': { $gte: lastSync }
          }
        },
        {
          $project: {
            minecraftUuid: 1,
            username: { $arrayElemAt: ['$usernames.username', -1] },
            punishment: {
              id: '$punishments.id',
              type: '$punishments.type_ordinal',
              modifications: {
                $filter: {
                  input: '$punishments.modifications',
                  cond: { $gte: ['$$this.issued', lastSync] }
                }
              }
            }
          }
        }
      ]);

      // 5. Get server statistics
      const stats = {
        totalPlayers: await Player.countDocuments({}),
        onlinePlayers: onlinePlayers ? onlinePlayers.length : 0,
        activeBans: await Player.countDocuments({
          'punishments.type_ordinal': { $in: [2, 3, 4, 5] }, // Manual Ban, Security Ban, Linked Ban, Blacklist
          'punishments.started': { $exists: true },
          $or: [
            { 'punishments.data.expires': { $exists: false } },
            { 'punishments.data.expires': { $gt: now } }
          ],
          'punishments.data.active': { $ne: false }
        }),
        activeMutes: await Player.countDocuments({
          'punishments.type_ordinal': 1, // Manual Mute
          'punishments.started': { $exists: true },
          $or: [
            { 'punishments.data.expires': { $exists: false } },
            { 'punishments.data.expires': { $gt: now } }
          ],
          'punishments.data.active': { $ne: false }
        })
      };

      // Log sync activity
      await createSystemLog(
        serverDbConnection, 
        serverName, 
        `Server sync completed. Online: ${stats.onlinePlayers}, Pending punishments: ${pendingPunishments.length}, Recent modifications: ${recentlyModifiedPunishments.length}`, 
        'info', 
        'minecraft-sync'
      );

      // 5. Get notifications for online players
      const playerNotifications: any[] = [];
      
      if (onlineUuids.length > 0) {
        for (const playerUuid of onlineUuids) {
          const notifications = await getAndClearPlayerNotifications(serverDbConnection, playerUuid);
          if (notifications.length > 0) {
            playerNotifications.push({
              minecraftUuid: playerUuid,
              notifications: notifications
            });
          }
        }
      }

      return res.status(200).json({
        status: 200,
        timestamp: now.toISOString(),
        data: {
          pendingPunishments,
          recentlyStartedPunishments,
          recentlyModifiedPunishments,
          playerNotifications,
          stats,
          serverStatus: {
            lastSync: now.toISOString(),
            onlinePlayerCount: stats.onlinePlayers
          }
        }
      });
    } catch (error: any) {
      console.error('Error in Minecraft sync:', error);
      await createSystemLog(serverDbConnection, serverName, `Error during Minecraft sync: ${error.message || error}`, 'error', 'minecraft-sync');
      return res.status(500).json({
        status: 500,
        message: 'Internal server error during sync'
      });
    }
  });

  /**
   * Acknowledge punishment execution
   * - Mark punishment as started and executed on the server
   * - Update punishment status after server has applied it
   */
  app.post('/api/minecraft/punishment/acknowledge', async (req: Request, res: Response) => {
    const { punishmentId, playerUuid, executedAt, success, errorMessage } = req.body;
    const serverDbConnection = req.serverDbConnection!;
    const serverName = req.serverName!;
    const Player = serverDbConnection.model<IPlayer>('Player');

    try {
      const player = await Player.findOne({ minecraftUuid: playerUuid });
      if (!player) {
        return res.status(404).json({ status: 404, message: 'Player not found' });
      }

      const punishment = player.punishments.find((p: IPunishment) => p.id === punishmentId);
      if (!punishment) {
        return res.status(404).json({ status: 404, message: 'Punishment not found' });
      }

      // Mark punishment as started if successful and set expiry from start time
      if (success) {
        const startTime = new Date(executedAt || Date.now());
        
        // Only set start date if punishment hasn't been started yet
        if (!punishment.started) {
          punishment.started = startTime;
          
          // Set expiry time based on when punishment actually started
          const duration = getPunishmentData(punishment, 'duration');
          if (duration && duration > 0) {
            setPunishmentData(punishment, 'expires', new Date(startTime.getTime() + duration));
          }
        }
        
        // Add execution confirmation to punishment data
        setPunishmentData(punishment, 'executedOnServer', true);
        setPunishmentData(punishment, 'executedAt', startTime);
      } else {
        // Log execution failure
        setPunishmentData(punishment, 'executionFailed', true);
        setPunishmentData(punishment, 'executionError', errorMessage || 'Unknown error');
        setPunishmentData(punishment, 'executionAttemptedAt', new Date(executedAt || Date.now()));
      }

      await player.save();

      const logMessage = success 
        ? `Punishment ${punishmentId} executed successfully on server for ${player.usernames[0]?.username} (${playerUuid})`
        : `Punishment ${punishmentId} execution failed for ${player.usernames[0]?.username} (${playerUuid}): ${errorMessage}`;
      
      await createSystemLog(serverDbConnection, serverName, logMessage, success ? 'info' : 'error', 'minecraft-sync');

      return res.status(200).json({
        status: 200,
        message: success ? 'Punishment execution acknowledged' : 'Punishment execution failure recorded'
      });
    } catch (error: any) {
      console.error('Error acknowledging punishment execution:', error);
      await createSystemLog(serverDbConnection, serverName, `Error acknowledging punishment ${punishmentId}: ${error.message || error}`, 'error', 'minecraft-sync');
      return res.status(500).json({
        status: 500,
        message: 'Internal server error'
      });
    }
  });
}
