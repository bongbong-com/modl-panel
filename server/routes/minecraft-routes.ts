import { Express, Request, Response } from 'express';
import { Player, Ticket } from '../models/mongodb-schemas';
import { v4 as uuidv4 } from 'uuid';
import { createSystemLog } from './log-routes';
import { verifyMinecraftApiKey } from '../middleware/api-auth';
import { Int32 } from 'mongodb';

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
      const { minecraftUuid, ipAddress, skinHash, username } = req.body;

      if (!minecraftUuid || !ipAddress || !username) {
        return res.status(400).json({
          status: 400,
          message: 'Missing required fields: minecraftUuid, ipAddress, username'
        });
      }
      
      // Get IP information from ip-api.com
      const ipInfo = await fetch(`http://ip-api.com/json/${ipAddress}?fields=status,message,countryCode,regionName,city,as,proxy,hosting`)
        .then(response => response.json());

      // Check if player already exists
      let player = await Player.findOne({ minecraftUuid });
      
      if (player) {
        // Update existing player
        let existingIp = player.ipList.find(ip => ip.ipAddress === ipAddress);
        if (existingIp) {
          // Just update the login dates
          existingIp.logins.push(new Date());
        } else {
          // Add new IP to list
          player.ipList.push({
            ipAddress,
            country: ipInfo.countryCode,
            region: `${ipInfo.regionName}, ${ipInfo.city}`,
            asn: ipInfo.as,
            proxy: ipInfo.proxy || ipInfo.hosting,
            firstLogin: new Date(),
            logins: [new Date()]          });
          
          // Check for IP ban evasion - find other accounts with this IP that are banned
          const linkedPlayers = await Player.find({
            minecraftUuid: { $ne: minecraftUuid }, // Exclude the current player
            'ipList.ipAddress': ipAddress
          });
          
          // Check if any linked accounts are banned
          let evading = false;
          let evasionDetails = {
            originalBannedName: '',
            originalBannedUuid: '',
            banReason: ''
          };
          
          for (const linkedPlayer of linkedPlayers) {
            // Check for active permanent bans or temporary bans that haven't expired
            const activeBan = linkedPlayer.punishments.find(punishment => {
              // Check if it's a ban (type_ordinal === 2)
              if (punishment.type_ordinal && punishment.type_ordinal.valueOf() === 2) {
                // Check if the ban is still active
                if (punishment.data && punishment.data.has('active') && !punishment.data.get('active')) {
                  return false;
                }
                
                // Check if the ban has an expiry and if it hasn't passed
                if (punishment.data && punishment.data.has('expires')) {
                  const expiry = punishment.data.get('expires');
                  if (expiry && new Date(expiry) < new Date()) {
                    return false;
                  }
                }
                
                // This is an active ban
                return true;
              }
              return false;
            });
            
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
            const id = Math.random().toString(36).substring(2, 10).toUpperCase();              // Create a new ban punishment
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
              type_ordinal: new Int32(2), // Manual Ban
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

        // Update username list if it's a new username
        const existingUsername = player.usernames.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!existingUsername) {
          player.usernames.push({ username, date: new Date() });
        }        // Check for inactive bans that need to be started now that player is online
        let startedAny = false;
        for (const punishment of player.punishments) {
          // Manual Ban (assuming ordinal 2)
          if (!punishment.started && punishment.type_ordinal && punishment.type_ordinal.valueOf() === 2) {
            punishment.started = new Date();
            startedAny = true;
          }
        }

        if (startedAny) {
          await createSystemLog(`Started pending ban for player ${username} (${minecraftUuid})`);
        }

        await player.save();
      } else {
        // Create a new player
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
          pendingNotifications: []
        });

        await player.save();
        await createSystemLog(`New player ${username} (${minecraftUuid}) registered`);
      }

      // Get active punishments
      const activePunishments = player.punishments.filter(punishment => {
        if (punishment.data && punishment.data.has('active') && !punishment.data.get('active')) {
          return false;
        }          // Check if the punishment has an expiry date and if it has passed
        if (punishment.data && punishment.data.has('expires')) {
          const expiry = punishment.data.get('expires');
          if (expiry && new Date(expiry) < new Date()) {
            return false;
          }
        }

        return true;
      });

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
