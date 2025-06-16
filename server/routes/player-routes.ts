import express, { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Connection, Document } from 'mongoose';
import { createSystemLog } from './log-routes';

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

interface IIP {
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
  text: string;
  issuerName: string;
  issuerId?: string; // Added issuerId
  date: Date;
}

interface IModification {
  type: string;
  issuerName: string;
  issued: Date;
  effectiveDuration?: number;
  reason?: string; 
}

interface IPunishment {
  id: string;
  issuerName: string;
  issued: Date;
  started?: Date;
  type_ordinal: number;
  modifications: IModification[];
  notes: string[]; // Assuming notes are strings, adjust if they are INote objects
  attachedTicketIds: string[];
  data: Map<string, any>;
}

interface IPlayer extends Document {
  _id: string;
  minecraftUuid: string;
  usernames: IUsername[];
  notes: INote[];
  ipList: IIP[];
  punishments: IPunishment[];
  pendingNotifications: any[]; // Define further if structure is known
  data: Map<string, any>;
}

const router = express.Router();

router.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.serverDbConnection) {
    console.error('Player route accessed without serverDbConnection.');
    return res.status(503).json({
      status: 503,
      error: 'Service Unavailable: Database connection not established for this server.'
    });
  }
  if (!req.serverName) {
    console.error('Player route accessed without serverName.');
    return res.status(500).json({
      status: 500,
      error: 'Internal Server Error: Server name not identified.'
    });
  }
  next();
});

router.get('/', async (req: Request, res: Response) => {
  const Player = req.serverDbConnection!.model<IPlayer>('Player');
  try {
    const players = await Player.find({});
    res.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:uuid', async (req: Request<{ uuid: string }>, res: Response) => {
  const Player = req.serverDbConnection!.model<IPlayer>('Player');
  try {
    const player = await Player.findOne({ minecraftUuid: req.params.uuid });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json(player);
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

router.post('/login', async (req: Request<{}, {}, PlayerLoginBody>, res: Response) => {
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

    let player = await Player.findOne({ minecraftUuid });

    if (player) {
      const existingIp = player.ipList.find(ip => ip.ipAddress === ipAddress);
      if (existingIp) {
        existingIp.logins.push(new Date());
      } else {
        player.ipList.push({
          ipAddress,
          country: ipInfo.countryCode,
          region: ipInfo.city ? `${ipInfo.regionName}, ${ipInfo.city}` : ipInfo.regionName,
          asn: ipInfo.as,
          proxy: ipInfo.proxy || ipInfo.hosting,
          firstLogin: new Date(),
          logins: [new Date()]
        });
      }

      const existingUsername = player.usernames.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (!existingUsername) {
        player.usernames.push({ username, date: new Date() });
      }
      player.data = player.data || new Map<string, any>();
      player.data.set('lastLogin', new Date());
      
      await player.save();
      await createSystemLog(req.serverDbConnection, req.serverName, `Player ${username} (${minecraftUuid}) logged in. IP: ${ipAddress}.`, 'info', 'player-api');
      return res.status(200).json(player);
    }

    player = new Player({
      _id: uuidv4(),
      minecraftUuid,
      usernames: [{ username, date: new Date() }],
      notes: [],
      ipList: [{
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
router.post('/', async (req: Request<{}, {}, CreatePlayerBody>, res: Response) => {
  const Player = req.serverDbConnection!.model<IPlayer>('Player');
  try {
    const { minecraftUuid, username } = req.body;

    if (!minecraftUuid || !username) {
        return res.status(400).json({ error: 'Missing minecraftUuid or username' });
    }
        
    const existingPlayer = await Player.findOne({ minecraftUuid });
    if (existingPlayer) {
      return res.status(400).json({ error: 'Player already exists' });
    }
    
    const player = new Player({
      _id: uuidv4(),
      minecraftUuid,
      usernames: [{ username, date: new Date() }],
      notes: [],
      ipList: [],
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
router.post('/:uuid/usernames', async (req: Request<{ uuid: string }, {}, AddUsernameBody>, res: Response) => {
  const Player = req.serverDbConnection!.model<IPlayer>('Player');
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });
    
    const player = await Player.findOne({ minecraftUuid: req.params.uuid });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    const existingUsername = player.usernames.find(u => u.username.toLowerCase() === username.toLowerCase());
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
router.post('/:uuid/notes', async (req: Request<{ uuid: string }, {}, AddNoteBody>, res: Response) => {
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
router.post('/:uuid/ips', async (req: Request<{ uuid: string }, {}, AddIpBody>, res: Response) => {
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
    
    const existingIp = player.ipList.find(ip => ip.ipAddress === ipAddress);
    if (existingIp) {
      existingIp.logins.push(new Date());
    } else {
      player.ipList.push({
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
    attachedTicketIds?: string[];
    data?: Record<string, any>; // For Map conversion
    reason?: string;
    duration?: number;
}
router.post('/:uuid/punishments', async (req: Request<{ uuid: string }, {}, AddPunishmentBody>, res: Response) => {
  const Player = req.serverDbConnection!.model<IPlayer>('Player');
  try {
    const {
      issuerName, 
      type_ordinal,
      notes, 
      attachedTicketIds, 
      data, 
      reason, 
      duration 
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
    if (reason) punishmentData.set('reason', reason);
    if (duration !== undefined) {
        punishmentData.set('duration', duration); 
        if (duration > 0) {
            punishmentData.set('expires', new Date(Date.now() + duration));
        }
    }
    if (data && typeof data === 'object') {
        for (const [key, value] of Object.entries(data)) {
            punishmentData.set(key, value);
        }
    }

    const newPunishment: IPunishment = {
      id,
      issuerName,
      issued: new Date(),
      started: (type_ordinal === 1 || type_ordinal === 2) ? new Date() : undefined,
      type_ordinal,
      modifications: [],
      notes: notes || [],
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
router.post('/:uuid/punishments/:punishmentId/modifications', async (req: Request<{ uuid: string, punishmentId: string }, {}, AddPunishmentModificationBody>, res: Response) => {
  const Player = req.serverDbConnection!.model<IPlayer>('Player');
  try {
    const { type, issuerName, effectiveDuration, reason } = req.body;
    if (!type || !issuerName) return res.status(400).json({ error: 'Type and issuerName are required for modifications' });
    
    const player = await Player.findOne({ minecraftUuid: req.params.uuid });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    const punishment = player.punishments.find(p => p.id === req.params.punishmentId);
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

router.get('/:uuid/activePunishments', async (req: Request<{ uuid: string }>, res: Response) => {
  const Player = req.serverDbConnection!.model<IPlayer>('Player');
  try {
    const player = await Player.findOne({ minecraftUuid: req.params.uuid });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    const activePunishments = player.punishments.filter(punishment => {
      if (punishment.data && punishment.data.get('active') === false) return false;
      if (!punishment.started) return false;

      const duration = punishment.data ? punishment.data.get('duration') : undefined;
      if (duration === -1 || duration === undefined) return true; 
      
      const startTime = new Date(punishment.started).getTime();
      const endTime = startTime + Number(duration);
      
      return endTime > Date.now();
    });
    
    res.json(activePunishments);
  } catch (error) {
    console.error('Error fetching active punishments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;