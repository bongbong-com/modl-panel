import express, { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Connection, Document } from 'mongoose';
import { createSystemLog } from './log-routes';
import { calculatePlayerStatus, updatePunishmentDataStructure } from '../utils/player-status-calculator';

// Local type definitions (temporary replacement for missing shared types)
interface IIPAddress {
  ipAddress: string;
  country?: string;
  region?: string;
  asn?: string;
  proxy?: boolean;
  firstLogin: Date;
  logins: Date[];
}

interface IUsername {
  username: string;
  date: Date;
}

interface INote {
  id: string;
  text: string;
  issuerName: string;
  date: Date;
}

interface IPunishmentNote {
  _id?: any;
  text: string;
  issuerName: string;
  date: Date;
}

interface IPunishment {
  id: string;
  issuerName: string;
  issued: Date;
  started?: Date;
  type_ordinal: number;
  modifications: any[];
  notes: IPunishmentNote[];
  evidence: string[];
  attachedTicketIds: string[];
  data: Map<string, any>;
}

interface IPlayer {
  _id?: any;
  minecraftUuid: string;
  usernames: IUsername[];
  ipAddresses: IIPAddress[];
  notes: INote[];
  punishments: IPunishment[];
  save(): Promise<IPlayer>;
}

interface IIPInfo {
  status?: string;
  message?: string;
  countryCode?: string;
  regionName?: string;
  city?: string;
  as?: string;
  proxy?: boolean;
  hosting?: boolean;
}

const router = express.Router();

router.use((req: Request, res: Response, next: NextFunction): void => {
  if (!req.serverDbConnection) {
    console.error('Player route accessed without serverDbConnection.');
    res.status(503).json({
      status: 503,
      error: 'Service Unavailable: Database connection not established for this server.'
    });
    return;
  }
  if (!req.serverName) {
    console.error('Player route accessed without serverName.');
    res.status(500).json({
      status: 500,
      error: 'Internal Server Error: Server name not identified.'
    });
    return;
  }
  next();
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const Player = req.serverDbConnection!.model<IPlayer>('Player');
  try {
    const players = await Player.find({});
    const formattedPlayers = players.map(player => ({
      uuid: player.minecraftUuid,
      username: player.usernames?.length > 0 
        ? player.usernames[player.usernames.length - 1].username 
        : 'Unknown',
      status: (player.punishments?.some((p: any) => p.type === 'BAN' && p.active)) ? 'Banned' : 'Active',
      lastOnline: player.data?.get('lastLogin') || null
    }));
    res.json(formattedPlayers);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:uuid', async (req: Request<{ uuid: string }>, res: Response): Promise<void> => {
  const Player = req.serverDbConnection!.model<IPlayer>('Player');
  try {
    const player = await Player.findOne({ minecraftUuid: req.params.uuid });
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    // Calculate player status
    try {
      const Settings = req.serverDbConnection!.model('Settings');
      const settings = await Settings.findOne({});
      
      let punishmentTypes = [];
      let thresholds = {
        gameplay: { medium: 5, habitual: 10 },
        social: { medium: 4, habitual: 8 }
      };

      if (settings?.settings) {
        // Get punishment types
        if (settings.settings.punishmentTypes) {
          punishmentTypes = typeof settings.settings.punishmentTypes === 'string' 
            ? JSON.parse(settings.settings.punishmentTypes) 
            : settings.settings.punishmentTypes;
        }

        // Get status thresholds
        if (settings.settings.statusThresholds) {
          const settingsThresholds = typeof settings.settings.statusThresholds === 'string'
            ? JSON.parse(settings.settings.statusThresholds)
            : settings.settings.statusThresholds;
          
          if (settingsThresholds) {
            thresholds = settingsThresholds;
          }
        }
      }

      // Calculate status using the player's punishments
      const playerStatus = calculatePlayerStatus(
        player.punishments || [],
        punishmentTypes,
        thresholds
      );      // Add calculated status to player data
      const enhancedPlayer = {
        ...player.toObject(),
        social: playerStatus.social,
        gameplay: playerStatus.gameplay,
        socialPoints: playerStatus.socialPoints,
        gameplayPoints: playerStatus.gameplayPoints,
        // Transform punishments to include properly extracted data from Maps
        punishments: player.punishments.map((punishment: any) => {
          const punishmentObj = punishment.toObject ? punishment.toObject() : punishment;
          
          // If data is a Map, convert it to a plain object
          if (punishmentObj.data && punishmentObj.data instanceof Map) {
            const dataObj: { [key: string]: any } = {};
            for (const [key, value] of punishmentObj.data.entries()) {
              dataObj[key] = value;
            }
            punishmentObj.data = dataObj;
          }
          
          // Extract common fields that might be in the data Map
          const expires = punishmentObj.data?.expires;
          const duration = punishmentObj.data?.duration;
          const active = punishmentObj.data?.active;
          
          return {
            ...punishmentObj,
            expires: expires,
            duration: duration,
            active: active !== false, // Default to true if not explicitly false
          };
        })
      };

      res.json(enhancedPlayer);    } catch (statusError) {
      console.error('Error calculating player status:', statusError);
      // Return player without calculated status if calculation fails, but still process punishments
      const playerObj = player.toObject();
      const enhancedPlayer = {
        ...playerObj,
        // Transform punishments to include properly extracted data from Maps
        punishments: player.punishments.map((punishment: any) => {
          const punishmentObj = punishment.toObject ? punishment.toObject() : punishment;
          
          // If data is a Map, convert it to a plain object
          if (punishmentObj.data && punishmentObj.data instanceof Map) {
            const dataObj: { [key: string]: any } = {};
            for (const [key, value] of punishmentObj.data.entries()) {
              dataObj[key] = value;
            }
            punishmentObj.data = dataObj;
          }
          
          // Extract common fields that might be in the data Map
          const expires = punishmentObj.data?.expires;
          const duration = punishmentObj.data?.duration;
          const active = punishmentObj.data?.active;
          
          return {
            ...punishmentObj,
            expires: expires,
            duration: duration,
            active: active !== false, // Default to true if not explicitly false
          };
        })
      };
      res.json(enhancedPlayer);
    }
  } catch (error) {
    console.error('Error fetching player:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface PlayerLoginBody {
  minecraftUuid: string;
  username: string;
  ipAddress: string;
}

router.post('/login', async (req: Request<{}, {}, PlayerLoginBody>, res: Response): Promise<void> => {
  const Player = req.serverDbConnection!.model<IPlayer>('Player');
  
  try {
    const { minecraftUuid, username, ipAddress } = req.body;

    if (!minecraftUuid || !username || !ipAddress) {
        return res.status(400).json({ error: 'Missing minecraftUuid, username, or ipAddress' });
    }

    let ipInfo: IIPInfo = {};
    try {
        const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=status,message,countryCode,regionName,city,as,proxy,hosting`);
        ipInfo = await response.json() as IIPInfo;
        if (ipInfo.status !== 'success') {
            console.warn(`Failed to fetch IP info for ${ipAddress}: ${ipInfo.message}`);
        }
    } catch (fetchError) {
        console.error(`Error fetching IP info for ${ipAddress}:`, fetchError);
    }

    let player = await Player.findOne({ minecraftUuid });    if (player) {
      const existingIp = player.ipAddresses.find((ip: any) => ip.ipAddress === ipAddress);
      if (existingIp) {
        existingIp.logins.push(new Date());
      } else {
        player.ipAddresses.push({
          ipAddress,
          country: ipInfo.countryCode,
          region: ipInfo.city ? `${ipInfo.regionName}, ${ipInfo.city}` : ipInfo.regionName,
          asn: ipInfo.as,
          proxy: ipInfo.proxy || ipInfo.hosting,
          firstLogin: new Date(),
          logins: [new Date()]
        });
      }

      const existingUsername = player.usernames.find((u: any) => u.username.toLowerCase() === username.toLowerCase());
      if (!existingUsername) {
        player.usernames.push({ username, date: new Date() });
      }
      player.data = player.data || new Map<string, any>();
      player.data.set('lastLogin', new Date());
      
      await player.save();
      await createSystemLog(req.serverDbConnection, req.serverName, `Player ${username} (${minecraftUuid}) logged in. IP: ${ipAddress}.`, 'info', 'player-api');
      return res.status(200).json(player);
    }    player = new Player({
      _id: uuidv4(),
      minecraftUuid,
      usernames: [{ username, date: new Date() }],
      notes: [],
      ipAddresses: [{
        ipAddress,
        country: ipInfo.countryCode,
        region: ipInfo.city ? `${ipInfo.regionName}, ${ipInfo.city}` : ipInfo.regionName,
        asn: ipInfo.as,
        proxy: ipInfo.proxy || ipInfo.hosting,
        firstLogin: new Date(),
        logins: [new Date()]
      }],
      punishments: [],
      pendingNotifications: [],
      data: new Map<string, any>([['firstJoin', new Date()], ['lastLogin', new Date()]])
    });

    await player.save();
    await createSystemLog(req.serverDbConnection, req.serverName, `New player ${username} (${minecraftUuid}) created and logged in. IP: ${ipAddress}.`, 'info', 'player-api');
    res.status(201).json(player);
  } catch (error) {
    console.error('Error in player login/creation:', error);
    await createSystemLog(req.serverDbConnection, req.serverName, `Error in player login/creation for ${req.body.username} (${req.body.minecraftUuid}): ${(error as Error).message}`, 'error', 'player-api');
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface CreatePlayerBody {
    minecraftUuid: string;
    username: string;
}
router.post('/', async (req: Request<{}, {}, CreatePlayerBody>, res: Response): Promise<void> => {
  const Player = req.serverDbConnection!.model<IPlayer>('Player');
  try {
    const { minecraftUuid, username } = req.body;    if (!minecraftUuid || !username) {
        res.status(400).json({ error: 'Missing minecraftUuid or username' });
        return;
    }
        
    const existingPlayer = await Player.findOne({ minecraftUuid });
    if (existingPlayer) {
      res.status(400).json({ error: 'Player already exists' });
      return;
    }
      const player = new Player({
      _id: uuidv4(),
      minecraftUuid,
      usernames: [{ username, date: new Date() }],
      notes: [],
      ipAddresses: [],
      punishments: [],
      pendingNotifications: [],
      data: new Map<string, any>([['firstJoin', new Date()]])
    });
    
    await player.save();
    await createSystemLog(req.serverDbConnection, req.serverName, `New player ${username} (${minecraftUuid}) created via API.`, 'info', 'player-api');
    res.status(201).json(player);
  } catch (error) {
    console.error('Error creating player:', error);
    await createSystemLog(req.serverDbConnection, req.serverName, `Error creating player ${req.body.username} (${req.body.minecraftUuid}): ${(error as Error).message}`, 'error', 'player-api');
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface AddUsernameBody {
    username: string;
}
router.post('/:uuid/usernames', async (req: Request<{ uuid: string }, {}, AddUsernameBody>, res: Response): Promise<void> => {
  const Player = req.serverDbConnection!.model<IPlayer>('Player');
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });
    
    const player = await Player.findOne({ minecraftUuid: req.params.uuid });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    const existingUsername = player.usernames.find((u: any) => u.username.toLowerCase() === username.toLowerCase());
    if (!existingUsername) {
        player.usernames.push({ username, date: new Date() });
        await player.save();
        await createSystemLog(req.serverDbConnection, req.serverName, `Username ${username} added to player ${req.params.uuid}.`, 'info', 'player-api');
    }
    res.json(player);
  } catch (error) {
    console.error('Error adding username:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface AddNoteBody {
    text: string;
    issuerName: string;
    issuerId?: string;
}
router.post('/:uuid/notes', async (req: Request<{ uuid: string }, {}, AddNoteBody>, res: Response): Promise<void> => {
  const Player = req.serverDbConnection!.model<IPlayer>('Player');
  try {
    const { text, issuerName, issuerId } = req.body;
    if (!text || !issuerName) return res.status(400).json({ error: 'Text and issuerName are required for notes' });
    
    const player = await Player.findOne({ minecraftUuid: req.params.uuid });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    player.notes.push({ text, issuerName, issuerId, date: new Date() });
    await player.save();
    await createSystemLog(req.serverDbConnection, req.serverName, `Note added to player ${req.params.uuid} by ${issuerName}.`, 'info', 'player-api');
    res.json(player);
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface AddIpBody {
    ipAddress: string;
}
router.post('/:uuid/ips', async (req: Request<{ uuid: string }, {}, AddIpBody>, res: Response): Promise<void> => {
  const Player = req.serverDbConnection!.model<IPlayer>('Player');
  try {
    const { ipAddress } = req.body; 
    if (!ipAddress) return res.status(400).json({ error: 'ipAddress is required' });

    let ipInfo: IIPInfo = {};
    try {
        const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=status,message,countryCode,regionName,city,as,proxy,hosting`);
        ipInfo = await response.json() as IIPInfo;
        if (ipInfo.status !== 'success') {
            console.warn(`Failed to fetch IP info for ${ipAddress}: ${ipInfo.message}`);
        }
    } catch (fetchError) {
        console.error(`Error fetching IP info for ${ipAddress}:`, fetchError);
    }
    
    const player = await Player.findOne({ minecraftUuid: req.params.uuid });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
      const existingIp = player.ipAddresses.find((ip: any) => ip.ipAddress === ipAddress);
    if (existingIp) {
      existingIp.logins.push(new Date());
    } else {
      player.ipAddresses.push({
        ipAddress,
        country: ipInfo.countryCode,
        region: ipInfo.city ? `${ipInfo.regionName}, ${ipInfo.city}` : ipInfo.regionName,
        asn: ipInfo.as,
        proxy: ipInfo.proxy || ipInfo.hosting,
        firstLogin: new Date(),
        logins: [new Date()]
      });
    }
    
    await player.save();
    await createSystemLog(req.serverDbConnection, req.serverName, `IP ${ipAddress} added/updated for player ${req.params.uuid}.`, 'info', 'player-api');
    res.json(player);
  } catch (error) {
    console.error('Error adding IP address:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface AddPunishmentBody {
    issuerName: string;
    type_ordinal: number;
    notes?: string[];
    evidence?: string[];
    attachedTicketIds?: string[];
    severity?: string;
    status?: string;
    data?: Record<string, any>; // For Map conversion
}
router.post('/:uuid/punishments', async (req: Request<{ uuid: string }, {}, AddPunishmentBody>, res: Response): Promise<void> => {
  const Player = req.serverDbConnection!.model<IPlayer>('Player');  try {
    const {
      issuerName, 
      type_ordinal,
      notes, 
      evidence,
      attachedTicketIds,
      severity,
      status,
      data
    } = req.body;

    if (!issuerName || type_ordinal === undefined) {
        return res.status(400).json({ error: 'issuerName and type_ordinal are required for punishments' });
    }
    
    const player = await Player.findOne({ minecraftUuid: req.params.uuid });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
      const id = uuidv4().substring(0, 8).toUpperCase();
      const punishmentData = new Map<string, any>();
    
    // Initialize required fields with defaults
    punishmentData.set('duration', 0);
    punishmentData.set('blockedName', null);
    punishmentData.set('blockedSkin', null);
    punishmentData.set('linkedBanId', null);
    punishmentData.set('linkedBanExpiry', null); // Set to null by default, only set for linked bans
    punishmentData.set('chatLog', null);
    punishmentData.set('altBlocking', false);
    punishmentData.set('wipeAfterExpiry', false);
    
    // Add severity and status to data map
    if (severity) {
        punishmentData.set('severity', severity);
    }
    if (status) {
        punishmentData.set('status', status);
    }
    
    // Override with any provided data (duration and other fields come from here now)
    if (data && typeof data === 'object') {
        for (const [key, value] of Object.entries(data)) {
            // Don't include reason in data - it should be the first note
            if (key !== 'reason') {
                punishmentData.set(key, value);
            }
        }
    }
    
    // Set linkedBanExpiry only for linked bans
    if (data?.linkedBanId) {
        punishmentData.set('linkedBanExpiry', new Date());
    }

    // Set expiry date if duration is provided in data
    const durationValue = punishmentData.get('duration');
    if (durationValue !== undefined && durationValue > 0) {
        punishmentData.set('expires', new Date(Date.now() + durationValue));
    }    const newPunishment: IPunishment = {
      id,
      issuerName,
      issued: new Date(),
      started: (type_ordinal === 1 || type_ordinal === 2) ? new Date() : undefined,
      type_ordinal,
      modifications: [],
      notes: notes || [],
      evidence: evidence || [],
      attachedTicketIds: attachedTicketIds || [],
      data: punishmentData
    };

    player.punishments.push(newPunishment);
    await player.save();
    await createSystemLog(req.serverDbConnection, req.serverName, `Punishment ID ${id} (Type: ${type_ordinal}) added to player ${req.params.uuid} by ${issuerName}.`, 'moderation', 'player-api');
    res.json(player);
  } catch (error) {
    console.error('Error adding punishment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface AddPunishmentModificationBody {
    type: string;
    issuerName: string;
    effectiveDuration?: number;
    reason?: string;
}
router.post('/:uuid/punishments/:punishmentId/modifications', async (req: Request<{ uuid: string, punishmentId: string }, {}, AddPunishmentModificationBody>, res: Response): Promise<void> => {
  const Player = req.serverDbConnection!.model<IPlayer>('Player');
  try {
    const { type, issuerName, effectiveDuration, reason } = req.body;
    if (!type || !issuerName) return res.status(400).json({ error: 'Type and issuerName are required for modifications' });
    
    const player = await Player.findOne({ minecraftUuid: req.params.uuid });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    const punishment = player.punishments.find((p: any) => p.id === req.params.punishmentId);
    if (!punishment) {
      return res.status(404).json({ error: 'Punishment not found' });
    }
    
    punishment.modifications.push({
      type,
      issuerName,
      issued: new Date(),
      effectiveDuration,
      reason 
    });
    
    await player.save();
    await createSystemLog(req.serverDbConnection, req.serverName, `Modification of type '${type}' added to punishment ${req.params.punishmentId} for player ${req.params.uuid} by ${issuerName}.`, 'moderation', 'player-api');
    res.json(player);
  } catch (error) {
    console.error('Error adding modification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:uuid/activePunishments', async (req: Request<{ uuid: string }>, res: Response): Promise<void> => {
  const Player = req.serverDbConnection!.model<IPlayer>('Player');
  try {
    const player = await Player.findOne({ minecraftUuid: req.params.uuid });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
      const activePunishments = player.punishments.filter((punishment: any) => {
      if (punishment.data && punishment.data.get('active') === false) return false;
      if (!punishment.started) return false;

      const duration = punishment.data ? punishment.data.get('duration') : undefined;
      if (duration === -1 || duration === undefined) return true; 
      
      const startTime = new Date(punishment.started).getTime();
      const endTime = startTime + Number(duration);
      
      return endTime > Date.now();
    }).map((punishment: any) => {
      const punishmentObj = punishment.toObject ? punishment.toObject() : punishment;
      
      // If data is a Map, convert it to a plain object
      if (punishmentObj.data && punishmentObj.data instanceof Map) {
        const dataObj: { [key: string]: any } = {};
        for (const [key, value] of punishmentObj.data.entries()) {
          dataObj[key] = value;
        }
        punishmentObj.data = dataObj;
      }
      
      // Extract common fields that might be in the data Map
      const expires = punishmentObj.data?.expires;
      const duration = punishmentObj.data?.duration;
      const active = punishmentObj.data?.active;
      
      return {
        ...punishmentObj,
        expires: expires,
        duration: duration,
        active: active !== false, // Default to true if not explicitly false
      };
    });
    
    res.json(activePunishments);
  } catch (error) {
    console.error('Error fetching active punishments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get punishment by ID (searches across all players)
router.get('/punishment/:punishmentId', async (req: Request<{ punishmentId: string }>, res: Response): Promise<void> => {
  const Player = req.serverDbConnection!.model<IPlayer>('Player');
  try {
    const punishmentId = req.params.punishmentId;
    
    // Search for the punishment across all players
    const player = await Player.findOne({ 'punishments.id': punishmentId });
    
    if (!player) {
      return res.status(404).json({ error: 'Punishment not found' });
    }
    
    // Find the specific punishment within the player's punishments
    const punishment = player.punishments.find((p: any) => p.id === punishmentId);
    
    if (!punishment) {
      return res.status(404).json({ error: 'Punishment not found' });
    }
      // Get the punishment type name from settings if available
    let punishmentTypeName = 'Unknown';
    let punishmentTypeIsAppealable = true; // Default to appealable
    try {
      const Settings = req.serverDbConnection!.model('Settings');
      const settings = await Settings.findOne({});
      if (settings?.settings?.punishmentTypes) {
        const punishmentTypes = typeof settings.settings.punishmentTypes === 'string' 
          ? JSON.parse(settings.settings.punishmentTypes) 
          : settings.settings.punishmentTypes;
        
        const punishmentType = punishmentTypes.find((pt: any) => pt.ordinal === punishment.type_ordinal);
        if (punishmentType) {
          punishmentTypeName = punishmentType.name;
          punishmentTypeIsAppealable = punishmentType.isAppealable !== false; // Default to true if not specified
        }
      }
    } catch (settingsError) {
      console.warn('Could not fetch punishment type name from settings:', settingsError);
    }
      // Transform punishment data for the frontend
    const transformedPunishment = {
      id: punishment.id,
      type: punishmentTypeName,
      isAppealable: punishmentTypeIsAppealable,
      reason: punishment.data?.get('reason') || 'No reason provided',
      issued: punishment.issued,
      started: punishment.started,
      issuerName: punishment.issuerName,
      playerUuid: player.minecraftUuid,
      playerUsername: player.usernames.length > 0 ? player.usernames[player.usernames.length - 1].username : 'Unknown',
      active: true, // Default to true
      expires: null as Date | null
    };
    
    // Check if punishment is active
    if (punishment.data && punishment.data.get('active') === false) {
      transformedPunishment.active = false;
    }
    
    // Check expiry
    const duration = punishment.data?.get('duration');
    if (duration && duration > 0 && punishment.started) {
      const expiryDate = new Date(punishment.started.getTime() + duration);
      transformedPunishment.expires = expiryDate;
      
      if (expiryDate < new Date()) {
        transformedPunishment.active = false;
      }
    }
    
    res.json(transformedPunishment);
  } catch (error) {
    console.error('Error fetching punishment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface AddPunishmentNoteBody {
  text: string;
  issuerName: string;
}

router.post('/:uuid/punishments/:punishmentId/notes', async (req: Request<{ uuid: string, punishmentId: string }, {}, AddPunishmentNoteBody>, res: Response): Promise<void> => {
  const Player = req.serverDbConnection!.model<IPlayer>('Player');
  try {
    const { text, issuerName } = req.body;
    if (!text || !issuerName) {
      res.status(400).json({ error: 'Text and issuerName are required for notes' });
      return;
    }
    
    const player = await Player.findOne({ minecraftUuid: req.params.uuid });
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    
    const punishment = player.punishments.find((p: any) => p.id === req.params.punishmentId);
    if (!punishment) {
      res.status(404).json({ error: 'Punishment not found' });
      return;
    }
    
    // Add note to punishment as an object with the required schema fields
    const newNote = {
      text: text,
      issuerName: issuerName,
      date: new Date()
    };
    
    punishment.notes.push(newNote);
    
    await player.save();
    await createSystemLog(req.serverDbConnection, req.serverName, `Note added to punishment ${req.params.punishmentId} for player ${req.params.uuid} by ${issuerName}.`, 'moderation', 'player-api');
    res.json(player);
  } catch (error) {
    console.error('Error adding punishment note:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;