import { Connection, Types, Document } from 'mongoose'; // Added Types, Document
import { Request, Response, NextFunction, Express } from 'express'; // Added Express for app type
import { v4 as uuidv4 } from 'uuid'; // For generating new player UUIDs
import { createSystemLog } from './log-routes'; // Import createSystemLog
import { verifyMinecraftApiKey } from '../middleware/api-auth';
import { IIPAddress, IModification, INote, IPunishment, IPlayer, ITicket, IUsername } from 'modl-shared-web/types';

// Import getUserPermissions from permission middleware
async function getUserPermissions(req: Request, userRole: string): Promise<string[]> {
  if (!req.serverDbConnection) {
    throw new Error('Database connection not available');
  }

  // Define default role permissions
  const defaultPermissions: Record<string, string[]> = {
    'Super Admin': [
      'admin.settings.view', 'admin.settings.modify', 'admin.staff.manage', 'admin.analytics.view',
      'ticket.view.all', 'ticket.reply.all', 'ticket.close.all', 'ticket.delete.all'
    ],
    'Admin': [
      'admin.settings.view', 'admin.staff.manage', 'admin.analytics.view',
      'ticket.view.all', 'ticket.reply.all', 'ticket.close.all'
    ],
    'Moderator': [
      'ticket.view.all', 'ticket.reply.all', 'ticket.close.all'
    ],
    'Helper': [
      'ticket.view.all', 'ticket.reply.all'
    ]
  };

  // Get punishment permissions from settings
  try {
    const Settings = req.serverDbConnection.model('Settings');
    const settingsDoc = await Settings.findOne({});
    const punishmentTypes = settingsDoc?.settings?.get('punishmentTypes') || [];
    
    const punishmentPermissions = punishmentTypes.map((type: any) => 
      `punishment.apply.${type.name.toLowerCase().replace(/\s+/g, '-')}`
    );

    // Add punishment permissions to appropriate roles
    if (userRole === 'Super Admin' || userRole === 'Admin') {
      defaultPermissions[userRole] = [...defaultPermissions[userRole], ...punishmentPermissions];
    } else if (userRole === 'Moderator') {
      // Moderators get all punishment permissions except the most severe ones
      const moderatorPunishmentPerms = punishmentPermissions.filter((p: string) => 
        !p.includes('blacklist') && !p.includes('security-ban')
      );
      defaultPermissions[userRole] = [...defaultPermissions[userRole], ...moderatorPunishmentPerms];
    }
  } catch (error) {
    console.error('Error fetching punishment permissions:', error);
  }

  // Check if user has a custom role
  try {
    const StaffRoles = req.serverDbConnection.model('StaffRole');
    const customRole = await StaffRoles.findOne({ name: userRole });
    
    if (customRole) {
      return customRole.permissions || [];
    }
  } catch (error) {
    // Custom role model might not exist, fall back to default permissions
    console.log('Custom role model not found, using default permissions');
  }

  // Return default permissions for the role
  return defaultPermissions[userRole] || [];
}

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
async function loadPunishmentTypeConfig(dbConnection: Connection): Promise<Map<number, "BAN" | "MUTE" | "KICK">> {
  const typeMap = new Map<number, "BAN" | "MUTE" | "KICK">();
  
  // Set hardcoded administrative and system types
  typeMap.set(0, "KICK"); // Kick
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
          let type: "BAN" | "MUTE" | "KICK" = "BAN"; // Default to ban
          
          // Check duration configuration
          if (punishmentType.durations) {
            // Check regular/first offense as the default type
            const firstDuration = punishmentType.durations.regular?.first || punishmentType.durations.low?.first;
            if (firstDuration?.type) {
              const typeStr = firstDuration.type.toUpperCase();
              if (typeStr.includes('KICK')) {
                type = "KICK";
              } else if (typeStr.includes('BAN')) {
                type = "BAN";
              } else {
                type = "MUTE";
              }
            }
          } else if (punishmentType.singleSeverityDurations) {
            // Check single severity duration
            const firstDuration = punishmentType.singleSeverityDurations.first;
            if (firstDuration?.type) {
              const typeStr = firstDuration.type.toUpperCase();
              if (typeStr.includes('KICK')) {
                type = "KICK";
              } else if (typeStr.includes('BAN')) {
                type = "BAN";
              } else {
                type = "MUTE";
              }
            }
          } else if (punishmentType.name) {
            // Fallback to name-based detection
            const nameStr = punishmentType.name.toLowerCase();
            if (nameStr.includes('kick')) {
              type = "KICK";
            } else if (nameStr.includes('mute')) {
              type = "MUTE";
            } else if (nameStr.includes('ban')) {
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
function getPunishmentType(punishment: IPunishment, typeConfig: Map<number, "BAN" | "MUTE" | "KICK">): "BAN" | "MUTE" | "KICK" {
  // Check preloaded config first
  const configuredType = typeConfig.get(punishment.type_ordinal);
  if (configuredType) {
    return configuredType;
  }
  
  // Fallback logic for unknown ordinals
  if (punishment.type_ordinal === 0) {
    return "KICK"; // Kick
  } else if (punishment.type_ordinal === 1) {
    return "MUTE"; // Manual Mute
  }
  
  // All other ordinals (2, 3, 4, 5 and unknown) default to BAN
  return "BAN";
}

/**
 * Utility function to check if punishment is a ban
 */
function isBanPunishment(punishment: IPunishment, typeConfig: Map<number, "BAN" | "MUTE" | "KICK">): boolean {
  return getPunishmentType(punishment, typeConfig) === "BAN";
}

/**
 * Utility function to check if punishment is a mute
 */
function isMutePunishment(punishment: IPunishment, typeConfig: Map<number, "BAN" | "MUTE" | "KICK">): boolean {
  return getPunishmentType(punishment, typeConfig) === "MUTE";
}

/**
 * Utility function to check if punishment is a kick
 */
function isKickPunishment(punishment: IPunishment, typeConfig: Map<number, "BAN" | "MUTE" | "KICK">): boolean {
  return getPunishmentType(punishment, typeConfig) === "KICK";
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
 * Find and link accounts by IP addresses
 * Links accounts that share IP addresses, considering proxy detection and timing
 * @param dbConnection Database connection
 * @param ipAddresses Array of IP addresses to check for linking
 * @param currentPlayerUuid UUID of the current player (to avoid self-linking)
 * @param serverName Server name for logging
 */
async function findAndLinkAccounts(
  dbConnection: Connection,
  ipAddresses: string[],
  currentPlayerUuid: string,
  serverName: string
): Promise<void> {
  try {
    const Player = dbConnection.model<IPlayer>('Player');
    
    if (!ipAddresses || ipAddresses.length === 0) {
      return;
    }

    console.log(`[Account Linking] Checking for linked accounts with IPs: ${ipAddresses.join(', ')}`);
    
    // Find all players that have used any of these IP addresses
    const potentialLinkedPlayers = await Player.find({
      minecraftUuid: { $ne: currentPlayerUuid }, // Exclude current player
      'ipList.ipAddress': { $in: ipAddresses }
    }).lean<IPlayer[]>();

    const currentPlayer = await Player.findOne({ minecraftUuid: currentPlayerUuid });
    if (!currentPlayer) {
      console.error(`[Account Linking] Current player ${currentPlayerUuid} not found`);
      return;
    }

    const linkedAccounts: string[] = [];

    for (const player of potentialLinkedPlayers) {
      let shouldLink = false;
      const matchingIPs: string[] = [];

      // Check each IP address for linking criteria
      for (const ipAddress of ipAddresses) {
        const playerIpEntry = player.ipList?.find((ip: IIPAddress) => ip.ipAddress === ipAddress);
        const currentPlayerIpEntry = currentPlayer.ipList?.find((ip: IIPAddress) => ip.ipAddress === ipAddress);
        
        if (playerIpEntry && currentPlayerIpEntry) {
          // Both players have used this IP
          const isProxy = playerIpEntry.proxy || currentPlayerIpEntry.proxy;
          
          if (!isProxy) {
            // Non-proxy IP - always link
            shouldLink = true;
            matchingIPs.push(ipAddress);
          } else {
            // Proxy IP - only link if used within 6 hours of each other
            const playerLastLogin = playerIpEntry.logins && playerIpEntry.logins.length > 0 
              ? new Date(Math.max(...playerIpEntry.logins.map((d: any) => new Date(d).getTime())))
              : playerIpEntry.firstLogin;
            
            const currentPlayerLastLogin = currentPlayerIpEntry.logins && currentPlayerIpEntry.logins.length > 0
              ? new Date(Math.max(...currentPlayerIpEntry.logins.map((d: any) => new Date(d).getTime())))
              : currentPlayerIpEntry.firstLogin;

            if (playerLastLogin && currentPlayerLastLogin) {
              const timeDiff = Math.abs(playerLastLogin.getTime() - currentPlayerLastLogin.getTime());
              const sixHours = 6 * 60 * 60 * 1000;
              
              if (timeDiff <= sixHours) {
                shouldLink = true;
                matchingIPs.push(`${ipAddress} (proxy, within 6h)`);
              }
            }
          }
        }
      }

      if (shouldLink) {
        linkedAccounts.push(player.minecraftUuid);
        
        // Update both players' linked accounts
        await updatePlayerLinkedAccounts(dbConnection, currentPlayer.minecraftUuid, player.minecraftUuid);
        await updatePlayerLinkedAccounts(dbConnection, player.minecraftUuid, currentPlayer.minecraftUuid);
        
        console.log(`[Account Linking] Linked ${currentPlayer.minecraftUuid} with ${player.minecraftUuid} via IPs: ${matchingIPs.join(', ')}`);
        
        // Create system log
        await createSystemLog(
          dbConnection,
          serverName,
          `Account linking detected: ${currentPlayer.usernames[0]?.username || 'Unknown'} (${currentPlayer.minecraftUuid}) linked to ${player.usernames[0]?.username || 'Unknown'} (${player.minecraftUuid}) via shared IPs: ${matchingIPs.join(', ')}`,
          'info',
          'account-linking'
        );
      }
    }

    if (linkedAccounts.length > 0) {
      console.log(`[Account Linking] Found ${linkedAccounts.length} linked accounts for ${currentPlayerUuid}`);
    } else {
      console.log(`[Account Linking] No linked accounts found for ${currentPlayerUuid}`);
    }
  } catch (error) {
    console.error(`[Account Linking] Error finding linked accounts:`, error);
  }
}

/**
 * Update a player's linked accounts list
 * @param dbConnection Database connection
 * @param playerUuid Player to update
 * @param linkedUuid Account to link
 */
async function updatePlayerLinkedAccounts(
  dbConnection: Connection,
  playerUuid: string,
  linkedUuid: string
): Promise<void> {
  try {
    const Player = dbConnection.model<IPlayer>('Player');
    
    const player = await Player.findOne({ minecraftUuid: playerUuid });
    if (!player) {
      return;
    }

    // Initialize linkedAccounts if it doesn't exist
    if (!player.data) {
      player.data = new Map<string, any>();
    }
    
    const existingLinkedAccounts = player.data.get('linkedAccounts') || [];
    
    // Only add if not already linked
    if (!existingLinkedAccounts.includes(linkedUuid)) {
      existingLinkedAccounts.push(linkedUuid);
      player.data.set('linkedAccounts', existingLinkedAccounts);
      player.data.set('lastLinkedAccountUpdate', new Date());
      await player.save();
      
      console.log(`[Account Linking] Updated ${playerUuid} linked accounts: added ${linkedUuid}`);
    }
  } catch (error) {
    console.error(`[Account Linking] Error updating player linked accounts:`, error);
  }
}

/**
 * Check if an IP address is new for a player
 * @param player Player object
 * @param ipAddress IP address to check
 * @returns True if this is a new IP for the player
 */
function isNewIPForPlayer(player: IPlayer, ipAddress: string): boolean {
  if (!player.ipList || player.ipList.length === 0) {
    return true; // First IP for this player
  }
  
  return !player.ipList.some((ip: IIPAddress) => ip.ipAddress === ipAddress);
}

/**
 * Check for active alt-blocking bans in linked accounts and issue linked bans
 * @param dbConnection Database connection
 * @param playerUuid Player to check for linked bans
 * @param serverName Server name for logging
 */
async function checkAndIssueLinkedBans(
  dbConnection: Connection,
  playerUuid: string,
  serverName: string
): Promise<void> {
  try {
    const Player = dbConnection.model<IPlayer>('Player');
    const punishmentTypeConfig = await loadPunishmentTypeConfig(dbConnection);
    
    const player = await Player.findOne({ minecraftUuid: playerUuid });
    if (!player) {
      console.error(`[Linked Bans] Player ${playerUuid} not found`);
      return;
    }

    const linkedAccountUuids = player.data?.get('linkedAccounts') || [];
    if (linkedAccountUuids.length === 0) {
      console.log(`[Linked Bans] No linked accounts found for ${playerUuid}`);
      return;
    }

    console.log(`[Linked Bans] Checking ${linkedAccountUuids.length} linked accounts for active alt-blocking bans`);

    // Check each linked account for active alt-blocking bans
    for (const linkedUuid of linkedAccountUuids) {
      const linkedPlayer = await Player.findOne({ minecraftUuid: linkedUuid });
      if (!linkedPlayer) {
        console.warn(`[Linked Bans] Linked player ${linkedUuid} not found`);
        continue;
      }

      // Find active alt-blocking bans in linked account
      const activeAltBlockingBans = linkedPlayer.punishments.filter((punishment: IPunishment) => {
        // Must be a ban
        if (!isBanPunishment(punishment, punishmentTypeConfig)) {
          return false;
        }
        
        // Must be active
        if (!isPunishmentActive(punishment, punishmentTypeConfig)) {
          return false;
        }
        
        // Must have alt-blocking enabled
        const isAltBlocking = getPunishmentData(punishment, 'altBlocking');
        return isAltBlocking === true;
      });

      // Issue linked bans for each active alt-blocking ban
      for (const altBlockingBan of activeAltBlockingBans) {
        await issueLinkedBan(
          dbConnection,
          player,
          linkedPlayer,
          altBlockingBan,
          serverName
        );
      }
    }
  } catch (error) {
    console.error(`[Linked Bans] Error checking for linked bans:`, error);
  }
}

/**
 * Issue a linked ban to a player based on an alt-blocking ban from a linked account
 * @param dbConnection Database connection
 * @param targetPlayer Player to receive the linked ban
 * @param sourcePlayer Player with the alt-blocking ban
 * @param sourceAltBlockingBan The alt-blocking ban from the source player
 * @param serverName Server name for logging
 */
async function issueLinkedBan(
  dbConnection: Connection,
  targetPlayer: IPlayer,
  sourcePlayer: IPlayer,
  sourceAltBlockingBan: IPunishment,
  serverName: string
): Promise<void> {
  try {
    // Check if player already has a linked ban for this source punishment
    const existingLinkedBan = targetPlayer.punishments.find((punishment: IPunishment) => {
      const linkedBanId = getPunishmentData(punishment, 'linkedBanId');
      return linkedBanId === sourceAltBlockingBan.id;
    });

    if (existingLinkedBan) {
      console.log(`[Linked Bans] Player ${targetPlayer.minecraftUuid} already has linked ban for source punishment ${sourceAltBlockingBan.id}`);
      return;
    }

    // Calculate expiry based on source ban
    const sourceExpiry = calculateExpiration(sourceAltBlockingBan);
    let linkedBanDuration = -1; // Default to permanent
    let linkedBanExpiry: Date | null = null;
    
    if (sourceExpiry && sourceExpiry > Date.now()) {
      linkedBanDuration = sourceExpiry - Date.now();
      linkedBanExpiry = new Date(sourceExpiry);
    }

    // Generate linked ban ID
    const linkedBanId = uuidv4().substring(0, 8).toUpperCase();
    const reason = `Linked ban (connected to ${sourcePlayer.usernames[0]?.username || 'Unknown'} - ${sourceAltBlockingBan.id})`;

    // Create linked ban data
    const linkedBanData = new Map<string, any>();
    linkedBanData.set('reason', reason);
    linkedBanData.set('automated', true);
    linkedBanData.set('linkedBanId', sourceAltBlockingBan.id);
    linkedBanData.set('linkedToPlayer', sourcePlayer.minecraftUuid);
    linkedBanData.set('duration', linkedBanDuration);
    linkedBanData.set('severity', null); // Set severity to null for linked bans
    linkedBanData.set('status', null); // Set status to null for linked bans
    
    if (linkedBanExpiry) {
      linkedBanData.set('expires', linkedBanExpiry);
    }

    // Create linked ban punishment
    const linkedBanPunishment: IPunishment = {
      id: linkedBanId,
      issuerName: 'System (Linked Ban)',
      issued: new Date(),
      started: undefined, // Needs server acknowledgment
      type_ordinal: 4, // Linked Ban
      modifications: [],
      notes: [],
      attachedTicketIds: [],
      data: linkedBanData
    };

    // Add linked ban to target player
    targetPlayer.punishments.push(linkedBanPunishment);
    await targetPlayer.save();

    // Create system log
    await createSystemLog(
      dbConnection,
      serverName,
      `Linked ban issued: ${targetPlayer.usernames[0]?.username || 'Unknown'} (${targetPlayer.minecraftUuid}) banned due to alt-blocking ban ${sourceAltBlockingBan.id} from linked account ${sourcePlayer.usernames[0]?.username || 'Unknown'} (${sourcePlayer.minecraftUuid}). Expires: ${linkedBanExpiry ? linkedBanExpiry.toISOString() : 'Never'}`,
      'moderation',
      'linked-ban'
    );

    console.log(`[Linked Bans] Issued linked ban ${linkedBanId} to ${targetPlayer.minecraftUuid} based on alt-blocking ban ${sourceAltBlockingBan.id} from ${sourcePlayer.minecraftUuid}`);
  } catch (error) {
    console.error(`[Linked Bans] Error issuing linked ban:`, error);
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
        if (punishmentType.ordinal === 4) {
          return punishmentType.playerDescription.replace("{linked-id}", punishment.data.get('linkedBanId') || 'Unknown');
        }
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
function isPunishmentActive(punishment: IPunishment, typeConfig: Map<number, "BAN" | "MUTE" | "KICK">): boolean {
  if (!isPunishmentValid(punishment)) {
    return false;
  }
  
  // Kicks are never active - they are instant actions
  if (isKickPunishment(punishment, typeConfig)) {
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
    const { minecraftUuid, username, ipAddress, skinHash, ipInfo, serverName: requestServerName } = req.body;
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
        
        // Update last server and session tracking
        const currentServer = requestServerName || serverName;
        player.data.set('lastServer', currentServer);
        player.data.set('isOnline', true);
        
        // End previous session if player was marked as online (handles server switches)
        const currentSessionStart = player.data.get('currentSessionStart');
        const lastDisconnect = player.data.get('lastDisconnect');
        
        if (currentSessionStart && !lastDisconnect) {
          // Player was online but no disconnect recorded - end previous session
          const sessionDuration = new Date().getTime() - new Date(currentSessionStart).getTime();
          const totalPlaytime = player.data.get('totalPlaytime') || 0;
          player.data.set('totalPlaytime', totalPlaytime + sessionDuration);
        }
        
        // Start new session
        player.data.set('currentSessionStart', new Date());

        const existingIp = player.ipList.find((ip: IIPAddress) => ip.ipAddress === ipAddress);
        const isNewIP = !existingIp;
        
        if (existingIp) {
          existingIp.logins.push(new Date());
        } else if (ipInfo) { // Only add if ipInfo is available
          player.ipList.push({
            ipAddress,
            country: ipInfo.countryCode || 'Unknown',
            region: ipInfo.regionName && ipInfo.city ? `${ipInfo.regionName}, ${ipInfo.city}` : (ipInfo.regionName || ipInfo.city || 'Unknown'),
            asn: ipInfo.as || 'Unknown',
            proxy: ipInfo.proxy || ipInfo.hosting || false, // Assuming proxy/hosting indicates VPN/proxy
            hosting: ipInfo.hosting || false,
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
        
        // Check for linked accounts if this is a new IP address
        if (isNewIP && ipAddress) {
          console.log(`[Account Linking] Player ${username} (${minecraftUuid}) logged in with new IP ${ipAddress}`);
          // Run account linking asynchronously to avoid blocking login
          setImmediate(() => {
            findAndLinkAccounts(serverDbConnection, [ipAddress], minecraftUuid, serverName)
              .then(() => {
                // After linking accounts, check for linked bans
                return checkAndIssueLinkedBans(serverDbConnection, minecraftUuid, serverName);
              })
              .catch(error => {
                console.error(`[Account Linking] Error during login linking for ${minecraftUuid}:`, error);
              });
          });
        }
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
            country: ipInfo.countryCode || 'Unknown',
            region: ipInfo.regionName && ipInfo.city ? `${ipInfo.regionName}, ${ipInfo.city}` : (ipInfo.regionName || ipInfo.city || 'Unknown'),
            asn: ipInfo.as || 'Unknown',
            proxy: ipInfo.proxy || ipInfo.hosting || false,
            hosting: ipInfo.hosting || false,
            firstLogin: new Date(),
            logins: [new Date()]
          } as IIPAddress] : [] as IIPAddress[],
          punishments: [] as IPunishment[],
          pendingNotifications: [] as string[],
          data: new Map<string, any>([
            ['firstJoin', new Date()],
            ['lastConnect', new Date()],
            ['lastServer', requestServerName || serverName],
            ['isOnline', true],
            ['currentSessionStart', new Date()],
            ['totalPlaytime', 0]
          ])
        });


        await player.save();
        await createSystemLog(serverDbConnection, serverName, `New player ${username} (${minecraftUuid}) registered`, 'info', 'system-login');
        
        // Check for linked accounts for new players
        if (ipAddress) {
          console.log(`[Account Linking] New player ${username} (${minecraftUuid}) joined with IP ${ipAddress}`);
          // Run account linking asynchronously to avoid blocking login
          setImmediate(() => {
            findAndLinkAccounts(serverDbConnection, [ipAddress], minecraftUuid, serverName)
              .then(() => {
                // After linking accounts, check for linked bans
                return checkAndIssueLinkedBans(serverDbConnection, minecraftUuid, serverName);
              })
              .catch(error => {
                console.error(`[Account Linking] Error during new player linking for ${minecraftUuid}:`, error);
              });
          });
        }
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
      player.data.set('isOnline', false);
      
      // Calculate session duration and update total playtime
      const currentSessionStart = player.data.get('currentSessionStart');
      if (currentSessionStart) {
        const sessionDuration = new Date().getTime() - new Date(currentSessionStart).getTime();
        const totalPlaytime = player.data.get('totalPlaytime') || 0;
        player.data.set('totalPlaytime', totalPlaytime + sessionDuration);
        
        // Clear current session
        player.data.delete('currentSessionStart');
        
        await createSystemLog(
          serverDbConnection, 
          serverName, 
          `Player ${minecraftUuid} disconnected after ${Math.round(sessionDuration / 60000)} minutes`, 
          'info', 
          'system-disconnect'
        );
      }
      
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
      if (type === 'Kick' || type === 'KICK') {
        type_ordinal = 0; // Kick
      } else if (type === 'Mute' || type === 'MUTE') {
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
      
      const player = await Player.findOne({ minecraftUuid }).lean<IPlayer>();
      if (!player) {
        return res.status(200).json({ status: 200, linkedAccounts: [] });
      }

      const linkedAccountUuids = new Set<string>();

      // Method 1: Get linked accounts from stored data (new system)
      const storedLinkedAccounts = player.data?.get ? player.data.get('linkedAccounts') : player.data?.linkedAccounts;
      if (storedLinkedAccounts && Array.isArray(storedLinkedAccounts)) {
        storedLinkedAccounts.forEach((uuid: string) => linkedAccountUuids.add(uuid));
        console.log(`[Linked Accounts API] Found ${storedLinkedAccounts.length} stored linked accounts for ${minecraftUuid}`);
      }

      // Method 2: Get linked accounts by IP addresses (legacy/fallback system)
      if (player.ipList && player.ipList.length > 0) {
        const playerIps = player.ipList.map((ip: IIPAddress) => ip.ipAddress);
        const ipLinkedPlayers = await Player.find({
          minecraftUuid: { $ne: minecraftUuid },
          'ipList.ipAddress': { $in: playerIps }
        }).select('minecraftUuid').lean();
        
        ipLinkedPlayers.forEach((p: any) => linkedAccountUuids.add(p.minecraftUuid));
        console.log(`[Linked Accounts API] Found ${ipLinkedPlayers.length} IP-linked accounts for ${minecraftUuid}`);
      }

      if (linkedAccountUuids.size === 0) {
        console.log(`[Linked Accounts API] No linked accounts found for ${minecraftUuid}`);
        return res.status(200).json({ status: 200, linkedAccounts: [] });
      }

      // Get full player data for all linked accounts
      const linkedPlayers = await Player.find({
        minecraftUuid: { $in: Array.from(linkedAccountUuids) }
      }).select('minecraftUuid usernames punishments data').lean<IPlayer[]>();

      const formattedLinkedAccounts = linkedPlayers.map((acc: IPlayer) => {
        const activeBans = acc.punishments ? acc.punishments.filter((p: IPunishment) => isBanPunishment(p, punishmentTypeConfig) && isPunishmentActive(p, punishmentTypeConfig)).length : 0;
        const activeMutes = acc.punishments ? acc.punishments.filter((p: IPunishment) => isMutePunishment(p, punishmentTypeConfig) && isPunishmentActive(p, punishmentTypeConfig)).length : 0;
        const lastLinkedUpdate = acc.data?.get ? acc.data.get('lastLinkedAccountUpdate') : acc.data?.lastLinkedAccountUpdate;
        
        return {
          minecraftUuid: acc.minecraftUuid,
          username: acc.usernames && acc.usernames.length > 0 ? acc.usernames[acc.usernames.length - 1].username : 'N/A',
          activeBans,
          activeMutes,
          lastLinkedUpdate: lastLinkedUpdate || null
        };
      });
      
      console.log(`[Linked Accounts API] Returning ${formattedLinkedAccounts.length} linked accounts for ${minecraftUuid}`);
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
          // For kicks, only send recently issued ones (kicks are instant)
          const priorityKick = recentlyIssuedUnstarted.find((p: IPunishment) => isKickPunishment(p, punishmentTypeConfig));

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

          // Add the priority kick if exists (kicks are instant and don't persist)
          if (priorityKick) {
            const description = await getPunishmentDescription(priorityKick, serverDbConnection);
            const kickType = getPunishmentType(priorityKick, punishmentTypeConfig);

            pendingPunishments.push({
              minecraftUuid: player.minecraftUuid,
              username: player.usernames[player.usernames.length - 1]?.username || 'Unknown',
              punishment: {
                type: kickType,
                started: false,
                expiration: null, // Kicks are instant
                description: description,
                id: priorityKick.id
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
      // await createSystemLog(
      //   serverDbConnection, 
      //   serverName, 
      //   `Server sync completed. Online: ${stats.onlinePlayers}, Pending punishments: ${pendingPunishments.length}, Recent modifications: ${recentlyModifiedPunishments.length}`, 
      //   'info', 
      //   'minecraft-sync'
      // );

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

      // 6. Get active staff members among online players with their permissions
      const activeStaffMembers: any[] = [];
      
      if (onlineUuids.length > 0) {
        const Staff = serverDbConnection.model('Staff');
        
        // Find staff members whose assigned Minecraft players are online
        const staffWithOnlinePlayers = await Staff.find({
          assignedMinecraftUuid: { $in: onlineUuids }
        }).lean();

        // Get permissions for each staff member
        for (const staffMember of staffWithOnlinePlayers) {
          try {
            // Get user permissions based on their role
            const userPermissions = await getUserPermissions(req, staffMember.role);
            
            activeStaffMembers.push({
              minecraftUuid: staffMember.assignedMinecraftUuid,
              minecraftUsername: staffMember.assignedMinecraftUsername,
              staffUsername: staffMember.username,
              staffRole: staffMember.role,
              permissions: userPermissions,
              email: staffMember.email
            });
          } catch (permissionError) {
            console.error(`Error getting permissions for staff member ${staffMember.username}:`, permissionError);
            // Include staff member without permissions if permission lookup fails
            activeStaffMembers.push({
              minecraftUuid: staffMember.assignedMinecraftUuid,
              minecraftUsername: staffMember.assignedMinecraftUsername,
              staffUsername: staffMember.username,
              staffRole: staffMember.role,
              permissions: [],
              email: staffMember.email
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
          activeStaffMembers,
          stats,
          serverStatus: {
            lastSync: now.toISOString(),
            onlinePlayerCount: stats.onlinePlayers,
            activeStaffCount: activeStaffMembers.length
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

      // Load punishment type configuration to check if this is a kick
      const punishmentTypeConfig = await loadPunishmentTypeConfig(serverDbConnection);
      const isKick = isKickPunishment(punishment, punishmentTypeConfig);
      
      // Mark punishment as started if successful and set expiry from start time
      if (success) {
        const startTime = new Date(executedAt || Date.now());
        
        // Only set start date if punishment hasn't been started yet
        if (!punishment.started) {
          punishment.started = startTime;
          
          // Set expiry time based on when punishment actually started (except for kicks)
          if (!isKick) {
            const duration = getPunishmentData(punishment, 'duration');
            if (duration && duration > 0) {
              setPunishmentData(punishment, 'expires', new Date(startTime.getTime() + duration));
            }
          }
          // For kicks, mark as completed immediately
          else {
            setPunishmentData(punishment, 'completed', true);
            setPunishmentData(punishment, 'completedAt', startTime);
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
