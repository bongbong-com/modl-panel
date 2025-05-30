import { Express, Request, Response } from 'express';
import { Player, Ticket } from '../models/mongodb-schemas';
import { v4 as uuidv4 } from 'uuid';
import { createSystemLog } from './log-routes';
import { verifyMinecraftApiKey } from '../middleware/api-auth';
import { Int32 } from 'mongodb';

/**
 * Utility function to check if a punishment is currently active
 * Replicates the behavior of PunishmentHelper.isPunishmentActive in Java
 */
function isPunishmentActive(punishment: any): boolean {
  // Check type_ordinal is present
  if (!punishment.type_ordinal) return false;
  
  // Check if it's explicitly marked as inactive
  if (punishment.data && punishment.data.has('active') && !punishment.data.get('active')) {
    return false;
  }
  
  // Check if it has expired
  if (punishment.data && punishment.data.has('expires')) {
    const expiry = punishment.data.get('expires');
    if (expiry && new Date(expiry) < new Date()) {
      return false;
    }
  }
  
  // For bans, check if it's a ban type and if it's started
  if (punishment.type_ordinal.valueOf() === 2) { // Ban type
    // If it's not started yet, it's not active
    if (!punishment.started) {
      return false;
    }
  }
  
  // For other punishment types like mute
  if (punishment.type_ordinal.valueOf() === 1) { // Mute type
    // Mutes must be started to be active
    if (!punishment.started) {
      return false;
    }
  }
  
  // Default to active
  return true;
}

// Define the router for Minecraft API routes
export function setupMinecraftRoutes(app: Express) {
  // Apply API key verification middleware to all Minecraft routes
  app.use('/minecraft', verifyMinecraftApiKey);
  /**
   * Player login
   * - Update player's last_connect
   * - Update player's IP list
   * - Check for ban evasion
   * - Start inactive bans or return active punishments
   */
  app.post('/minecraft/player/login', async (req: Request, res: Response) => {
    try {
      const { minecraftUuid, ipAddress, skinHash, username } = req.body;      if (!minecraftUuid || !ipAddress || !username) {
        return res.status(400).json({
          status: 400,
          message: 'Missing required fields: minecraftUuid, ipAddress, username'
        });
      }
      
      // Check if player already exists
      let player = await Player.findOne({ minecraftUuid });
      let ipInfo;
      
      if (player) {
        // Update existing player
        let existingIp = player.ipList.find(ip => ip.ipAddress === ipAddress);

        // Handle existing IPs vs new IPs (replicating JoinListener.java behavior)
        if (existingIp) {
          // Just update the login dates (similar to ip.get().logins().add(new Date()) in Java)
          existingIp.logins.push(new Date());
        } else {
          // Only request IP information if this is a new IP we haven't seen before
          ipInfo = await fetch(`http://ip-api.com/json/${ipAddress}?fields=status,message,countryCode,regionName,city,as,proxy,hosting`)
            .then(response => response.json());
            
          // This is a new IP, add it to the player's list (like in handleNewIP method)
          player.ipList.push({
            ipAddress,
            country: ipInfo.countryCode,
            region: `${ipInfo.regionName}, ${ipInfo.city}`,
            asn: ipInfo.as,
            proxy: ipInfo.proxy || ipInfo.hosting,
            firstLogin: new Date(),
            logins: [new Date()]
          });
          
          // Find linked accounts with this IP (similar to findLinkedAccounts in Java)
          const linkedPlayers = await Player.find({
            minecraftUuid: { $ne: minecraftUuid }, // Exclude the current player
            'ipList.ipAddress': ipAddress
          });
          
          // Search for linked punishments (similar to handleNewIP in Java)
          let linkedActiveBan = null;
          let linkedPlayer = null;
          
          // Check each linked account for active bans that have 'altBlocking' enabled
          for (const account of linkedPlayers) {
            let unstartedPunishments: any[] = [];
            for (const punishment of account.punishments) {
                
              if (!punishment.started) {
                unstartedPunishments.push(punishment);
                continue;
              }
              
              // Skip bans that are already linked to this account
              const isAlreadyLinked = player.punishments.some(p => 
                p.data && 
                p.data.has('linkedBanId') && 
                p.data.get('linkedBanId') === punishment.id
              );
              
              if (isAlreadyLinked) continue;
              
              // Check if punishment is active and configured for alt blocking
              if (isPunishmentActive(punishment) && 
                  punishment.data && 
                  punishment.data.has('altBlocking') && 
                  punishment.data.get('altBlocking')) {
                linkedActiveBan = punishment;
                linkedPlayer = account;
                break;
              }
            }

            for (const punishment of unstartedPunishments) {
              punishment.started = new Date();
              await account.save();
              
              // Skip bans that are already linked to this account
              const isAlreadyLinked = player.punishments.some(p => 
                p.data && 
                p.data.has('linkedBanId') && 
                p.data.get('linkedBanId') === punishment.id
              );
              
              if (isAlreadyLinked) continue;
              
              // Check if punishment is active and configured for alt blocking
              if (isPunishmentActive(punishment) && 
                  punishment.data && 
                  punishment.data.has('altBlocking') && 
                  punishment.data.get('altBlocking')) {
                linkedActiveBan = punishment;
                linkedPlayer = account;
                break;
              }
            }
            
            if (linkedActiveBan) break;
          }
          
          // If we found an active ban with alt blocking, create a linked punishment
          if (linkedActiveBan) {
            // Generate a random 8-character alphanumeric ID for the ban
            const id = Math.random().toString(36).substring(2, 10).toUpperCase();
            
            // Create ban data with link information
            const linkedBanData = new Map();
            linkedBanData.set('active', true);
            linkedBanData.set('linkedBanId', linkedActiveBan.id);
            linkedBanData.set('linkedBanExpiry', linkedActiveBan.data && linkedActiveBan.data.has('expires') ? 
              linkedActiveBan.data.get('expires') : null);
            linkedBanData.set('altBlocking', true);
            
            const linkedUsername = linkedPlayer.usernames[linkedPlayer.usernames.length - 1].username;
            
            // Create the linked punishment (similar to createLinkedPunishment in Java)
            const linkedPunishment = {
              id,
              issuerName: 'System',
              issued: new Date(),
              started: new Date(), // Start immediately
              type_ordinal: new Int32(2), // Ban type
              modifications: [],
              notes: [{ 
                text: `Alt account of banned player ${linkedUsername} (${linkedPlayer.minecraftUuid})`, 
                issuerName: 'System',
                date: new Date() 
              }],
              attachedTicketIds: [],
              data: linkedBanData
            };
            
            // Add linked ban to player
            player.punishments.push(linkedPunishment);
            
            // Log the alt detection
            await createSystemLog(`Alt account detected: ${username} (${minecraftUuid}) is an alt of banned player ${linkedUsername} (${linkedPlayer.minecraftUuid})`);
          } else {
            // If no linked ban with altBlocking, still check for regular ban evasion
            let evading = false;
            let evasionDetails = {
              originalBannedName: '',
              originalBannedUuid: '',
              banReason: ''
            };
            
            for (const linkedPlayer of linkedPlayers) {
              // Check for active permanent bans or temporary bans that haven't expired
              const activeBan = linkedPlayer.punishments.find(punishment => isPunishmentActive(punishment));
              
              if (activeBan) {
                evading = true;
                evasionDetails.originalBannedName = linkedPlayer.usernames[linkedPlayer.usernames.length - 1].username;
                evasionDetails.originalBannedUuid = linkedPlayer.minecraftUuid;
                evasionDetails.banReason = activeBan.notes && activeBan.notes.length > 0 
                  ? activeBan.notes[0].text 
                  : 'Unknown reason';
                break;
              }
            }
            
            // If evasion detected, issue a new ban for this player
            if (evading) {
              // Generate a random 8-character alphanumeric ID for the ban
              const id = Math.random().toString(36).substring(2, 10).toUpperCase();
              
              // Create ban data
              const evasionBanData = new Map();
              evasionBanData.set('active', true);
              evasionBanData.set('permanentBan', true);
              evasionBanData.set('severity', 'Severe');
              evasionBanData.set('evasion', true);
              evasionBanData.set('originalBannedUuid', evasionDetails.originalBannedUuid);
              
              const evasionBan = {
                id,
                issuerName: 'System',
                issued: new Date(),
                started: new Date(), // Ban starts immediately
                type_ordinal: new Int32(2), // Ban type
                modifications: [],
                notes: [{ 
                  text: `Ban evasion - Previously banned as ${evasionDetails.originalBannedName} (${evasionDetails.originalBannedUuid}) for: ${evasionDetails.banReason}`, 
                  issuerName: 'System',
                  date: new Date() 
                }],
                attachedTicketIds: [],
                data: evasionBanData
              };
              
              // Add evasion ban to player
              player.punishments.push(evasionBan);
              
              // Log the evasion detection
              await createSystemLog(`Ban evasion detected: ${username} (${minecraftUuid}) is evading a ban on ${evasionDetails.originalBannedName} (${evasionDetails.originalBannedUuid})`);
            }
          }
        }

        // Update username list if it's a new username (similar to Java code handling username)
        const existingUsername = player.usernames.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!existingUsername) {
          player.usernames.push({ username, date: new Date() });
        }

        // Handle unstartedPunishments like in handleBansRestrictions method in Java
        // First create a sorted tree map of punishments by date
        const unstartedPunishments = player.punishments
          .filter(p => !p.started && isPunishmentActive(p))
          .sort((a, b) => new Date(a.issued) - new Date(b.issued));
        
        let startedAny = false;
        for (const punishment of unstartedPunishments) {
          // Start previously unstartedPunishments (like in Java code)
          punishment.started = new Date();
          startedAny = true;
        }

        if (startedAny) {
          await createSystemLog(`Started pending punishments for player ${username} (${minecraftUuid})`);
        }
        
        // Handle restrictions (blockedName, blockedSkin) if present
        // This implementation is simplified since we don't have the same restriction concepts
        if (skinHash) {
          const skinRestriction = player.punishments.find(p => 
            p.data && 
            p.data.has('blockedSkin') && 
            p.data.get('blockedSkin') === skinHash
          );
          
          if (skinRestriction && isPunishmentActive(skinRestriction)) {
            // Log the skin restriction trigger
            await createSystemLog(`Player ${username} (${minecraftUuid}) triggered a skin restriction`);
          }
        }

        await player.save();      } else {
        // For new players, we need to get the IP information
        if (!ipInfo) {
          ipInfo = await fetch(`http://ip-api.com/json/${ipAddress}?fields=status,message,countryCode,regionName,city,as,proxy,hosting`)
            .then(response => response.json());
        }
        
        // Create a new player (similar to Java code: account = new Account(...))
        player = new Player({
          _id: uuidv4(),
          minecraftUuid,
          usernames: [{ username, date: new Date() }],
          notes: [],
          ipList: [{
            ipAddress,
            country: ipInfo.countryCode,
            region: `${ipInfo.regionName}, ${ipInfo.city}`,
            asn: ipInfo.as,
            proxy: ipInfo.proxy || ipInfo.hosting,
            firstLogin: new Date(),
            logins: [new Date()]
          }],
          punishments: [],
          pendingNotifications: [],
          data: new Map([['firstJoin', new Date()]])
        });
        
        // After creating the player, check for linked accounts with this IP
        const linkedPlayers = await Player.find({
          minecraftUuid: { $ne: minecraftUuid },
          'ipList.ipAddress': ipAddress
        });
        
        // Similar to handleNewIP in Java, check for alt blocking on new accounts
        for (const linkedAccount of linkedPlayers) {
          for (const punishment of linkedAccount.punishments) {
            if (isPunishmentActive(punishment) && 
                punishment.data && 
                punishment.data.has('altBlockingNewAccounts') && 
                punishment.data.get('altBlockingNewAccounts')) {
                
              // Create linked punishment
              const id = Math.random().toString(36).substring(2, 10).toUpperCase();
              const linkedBanData = new Map();
              linkedBanData.set('active', true);
              linkedBanData.set('linkedBanId', punishment.id);
              linkedBanData.set('linkedBanExpiry', punishment.data.has('expires') ? 
                punishment.data.get('expires') : null);
              linkedBanData.set('altBlocking', true);
              linkedBanData.set('preventNewAccount', true);
              
              const linkedUsername = linkedAccount.usernames[linkedAccount.usernames.length - 1].username;
              
              // Create the linked punishment
              const linkedPunishment = {
                id,
                issuerName: 'System',
                issued: new Date(),
                started: new Date(),
                type_ordinal: new Int32(2), // Ban type
                modifications: [],
                notes: [{ 
                  text: `New account created from IP of banned player ${linkedUsername} (${linkedAccount.minecraftUuid})`, 
                  issuerName: 'System',
                  date: new Date() 
                }],
                attachedTicketIds: [],
                data: linkedBanData
              };
              
              player.punishments.push(linkedPunishment);
              await createSystemLog(`New account restriction: ${username} (${minecraftUuid}) created from IP of banned player ${linkedUsername}`);
              break;
            }
          }
        }
        
        await player.save();
        await createSystemLog(`New player ${username} (${minecraftUuid}) registered`);
      }// Handle mutes separately (similar to handleMute method in Java)
      // Find all mutes for sorting
      const unstartedMutes = player.punishments
        .filter(p => 
          p.type_ordinal && 
          p.type_ordinal.valueOf() === 1 && // Mute type
          !p.started &&
          isPunishmentActive(p)
        )
        .sort((a, b) => new Date(a.issued).getTime() - new Date(b.issued).getTime());
        
      const activeMutes = player.punishments
        .filter(p => 
          p.type_ordinal && 
          p.type_ordinal.valueOf() === 1 && // Mute type
          p.started &&
          isPunishmentActive(p)
        )
        .sort((a, b) => new Date(a.started).getTime() - new Date(b.started).getTime());
      
      // Start the oldest unstarted mute if there are no active mutes
      if (activeMutes.length === 0 && unstartedMutes.length > 0) {
        const muteToStart = unstartedMutes[0]; // Get the oldest mute
        muteToStart.started = new Date();
        await createSystemLog(`Started mute for player ${username} (${minecraftUuid})`);
      }

      // Get all active punishments (both bans and mutes)
      const activePunishments = player.punishments.filter(punishment => isPunishmentActive(punishment));

      // Convert type_ordinal to plain number for JSON response
      const formattedPunishments = activePunishments.map(punishment => {
        const plainPunishment = punishment.toObject ? punishment.toObject() : {...punishment};
        if (plainPunishment.type_ordinal && typeof plainPunishment.type_ordinal !== 'number') {
          plainPunishment.type_ordinal = plainPunishment.type_ordinal.valueOf();
        }
        return plainPunishment;
      });

      return res.status(200).json({
        status: 200,
        activePunishments: formattedPunishments
      });
    } catch (error) {
      console.error('Error in player login:', error);
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
  app.post('/minecraft/player/disconnect', async (req: Request, res: Response) => {
    try {
      const { minecraftUuid } = req.body;

      if (!minecraftUuid) {
        return res.status(400).json({
          status: 400,
          message: 'Missing required field: minecraftUuid'
        });
      }

      // Find the player and update their last disconnect time
      const player = await Player.findOne({ minecraftUuid });
      
      if (!player) {
        return res.status(404).json({
          status: 404,
          message: 'Player not found'
        });
      }

      // We don't have a dedicated field for last_disconnect in our schema
      // We could add it to the Map data field
      if (!player.data) {
        player.data = new Map();
      }
      player.data.set('lastDisconnect', new Date());
      
      await player.save();
      
      return res.status(200).json({
        status: 200,
        message: 'Player disconnect recorded successfully'
      });
    } catch (error) {
      console.error('Error in player disconnect:', error);
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
  app.post('/minecraft/ticket/create', async (req: Request, res: Response) => {
    try {
      const { minecraftUuid, typeOrdinal } = req.body;

      if (!minecraftUuid || typeOrdinal === undefined) {
        return res.status(400).json({
          status: 400,
          message: 'Missing required fields: minecraftUuid, typeOrdinal'
        });
      }

      // Get player information
      const player = await Player.findOne({ minecraftUuid });
      
      if (!player) {
        return res.status(404).json({
          status: 404,
          message: 'Player not found'
        });
      }

      const username = player.usernames[player.usernames.length - 1].username;

      // Map typeOrdinal to actual ticket type
      let ticketType: string;
      switch (typeOrdinal) {
        case 1:
          ticketType = 'player';
          break;
        case 2:
          ticketType = 'chat';
          break;
        case 3:
          ticketType = 'bug';
          break;
        case 4:
          ticketType = 'appeal';
          break;
        case 5:
          ticketType = 'staff';
          break;
        default:
          ticketType = 'support';
      }

      // Generate a unique ticket ID
      const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
      const ticketId = `${ticketType.toUpperCase()}-${randomDigits}`;

      // Create the ticket
      const newTicket = new Ticket({
        _id: ticketId,
        type: ticketType,
        status: 'Unfinished',
        tags: [ticketType],
        creator: username,
        creatorUuid: minecraftUuid
      });

      await newTicket.save();
      await createSystemLog(`Ticket ${ticketId} created by ${username} from Minecraft`);

      // Create a link to the ticket
      const ticketLink = `https://panel.yourdomain.com/player-ticket/${ticketId}`;

      return res.status(200).json({
        status: 200,
        link: ticketLink
      });
    } catch (error) {
      console.error('Error creating ticket:', error);
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
  app.post('/minecraft/punishment/create', async (req: Request, res: Response) => {
    try {
      const { 
        minecraftUuid, 
        minecraftStaffUuid, 
        note, 
        typeOrdinal, 
        punishmentData,
        online 
      } = req.body;

      if (!minecraftUuid || !minecraftStaffUuid || typeOrdinal === undefined) {
        return res.status(400).json({
          status: 400,
          message: 'Missing required fields: minecraftUuid, minecraftStaffUuid, typeOrdinal'
        });
      }

      // Get player information
      const player = await Player.findOne({ minecraftUuid });
      
      if (!player) {
        return res.status(404).json({
          status: 404,
          message: 'Player not found'
        });
      }

      // Get staff information
      const staffMember = await Player.findOne({ minecraftUuid: minecraftStaffUuid });
      
      if (!staffMember) {
        return res.status(404).json({
          status: 404,
          message: 'Staff member not found'
        });
      }

      const playerUsername = player.usernames[player.usernames.length - 1].username;
      const staffUsername = staffMember.usernames[staffMember.usernames.length - 1].username;

      // Generate a random 8-character alphanumeric ID
      const id = Math.random().toString(36).substring(2, 10).toUpperCase();

      // Create the punishment object
      const punishment = {
        id,
        issuerName: staffUsername,
        issued: new Date(),
        // Only start the ban if the player is online, mutes always start immediately
        started: (online || typeOrdinal === 1) ? new Date() : null, // Assuming typeOrdinal 1 is mute
        type_ordinal: typeOrdinal,
        modifications: [],
        notes: note ? [{ text: note, issuerName: staffUsername, date: new Date() }] : [],
        attachedTicketIds: [],
        data: punishmentData || {}
      };

      // Add the punishment to the player
      player.punishments.push(punishment);
      await player.save();

      await createSystemLog(`Punishment created for ${playerUsername} by ${staffUsername}`);

      return res.status(200).json({
        status: 200,
        punishment
      });
    } catch (error) {
      console.error('Error creating punishment:', error);
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
  app.post('/minecraft/player/note/create', async (req: Request, res: Response) => {
    try {
      const { minecraftUuid, minecraftStaffUuid, note } = req.body;

      if (!minecraftUuid || !minecraftStaffUuid || !note) {
        return res.status(400).json({
          status: 400,
          message: 'Missing required fields: minecraftUuid, minecraftStaffUuid, note'
        });
      }

      // Get player information
      const player = await Player.findOne({ minecraftUuid });
      
      if (!player) {
        return res.status(404).json({
          status: 404,
          message: 'Player not found'
        });
      }

      // Get staff information
      const staffMember = await Player.findOne({ minecraftUuid: minecraftStaffUuid });
      
      if (!staffMember) {
        return res.status(404).json({
          status: 404,
          message: 'Staff member not found'
        });
      }

      const staffUsername = staffMember.usernames[staffMember.usernames.length - 1].username;

      // Add the note
      player.notes.push({
        text: note,
        issuerName: staffUsername,
        issuerId: minecraftStaffUuid,
        date: new Date()
      });

      await player.save();
      await createSystemLog(`Note added to ${player.usernames[player.usernames.length - 1].username}'s profile by ${staffUsername}`);

      return res.status(200).json({
        status: 200,
        message: 'Note added successfully'
      });
    } catch (error) {
      console.error('Error adding note:', error);
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
  app.get('/minecraft/player', async (req: Request, res: Response) => {
    try {
      const { minecraftUuid } = req.query;

      if (!minecraftUuid) {
        return res.status(400).json({
          status: 400,
          message: 'Missing required query parameter: minecraftUuid'
        });
      }

      // Get player information
      const player = await Player.findOne({ minecraftUuid });
      
      if (!player) {
        return res.status(404).json({
          status: 404,
          message: 'Player not found'
        });
      }

      // Format the response to include relevant profile information
      const profile = {
        uuid: player.minecraftUuid,
        username: player.usernames[player.usernames.length - 1].username,
        firstJoined: player.usernames[0].date,
        punishments: player.punishments,
        notes: player.notes,
        ipHistory: player.ipList
      };

      return res.status(200).json({
        status: 200,
        profile
      });
    } catch (error) {
      console.error('Error fetching player profile:', error);
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
  app.get('/minecraft/player/linked', async (req: Request, res: Response) => {
    try {
      const { minecraftUuid } = req.query;

      if (!minecraftUuid) {
        return res.status(400).json({
          status: 400,
          message: 'Missing required query parameter: minecraftUuid'
        });
      }

      // Get player information
      const player = await Player.findOne({ minecraftUuid });
      
      if (!player) {
        return res.status(404).json({
          status: 404,
          message: 'Player not found'
        });
      }

      // Extract IPs from this player
      const ipAddresses = player.ipList.map(ip => ip.ipAddress);

      // Find other players with the same IPs
      const linkedPlayers = await Player.find({
        minecraftUuid: { $ne: minecraftUuid }, // Exclude the current player
        'ipList.ipAddress': { $in: ipAddresses }
      });

      // Format the response
      const profiles = linkedPlayers.map(linkedPlayer => ({
        uuid: linkedPlayer.minecraftUuid,
        username: linkedPlayer.usernames[linkedPlayer.usernames.length - 1].username,
        firstJoined: linkedPlayer.usernames[0].date,        isPunished: linkedPlayer.punishments.some(p => 
          p.type_ordinal && p.type_ordinal.valueOf() === 2 && // Manual Ban, assuming ordinal 2
          (!p.data || !p.data.get('expires') || new Date(p.data.get('expires')) > new Date())
        ),
        sharedIPs: linkedPlayer.ipList
          .filter(ip => ipAddresses.includes(ip.ipAddress))
          .map(ip => ip.ipAddress)
      }));

      return res.status(200).json({
        status: 200,
        profiles
      });
    } catch (error) {
      console.error('Error fetching linked accounts:', error);
      return res.status(500).json({
        status: 500,
        message: 'Internal server error'
      });
    }
  });
}
