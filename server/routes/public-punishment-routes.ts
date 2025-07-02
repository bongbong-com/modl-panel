import express, { Request, Response } from 'express';
import { IPlayer } from 'modl-shared-web';

const router = express.Router();

// Get public punishment information for appeals (excludes staff-only data)
router.get('/punishment/:punishmentId/appeal-info', async (req: Request<{ punishmentId: string }>, res: Response): Promise<void> => {
  try {
    const punishmentId = req.params.punishmentId;
    
    if (!req.serverDbConnection) {
      return res.status(500).json({ error: 'Database connection not available' });
    }
    
    const Player = req.serverDbConnection.model<IPlayer>('Player');
    
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
    
    // Get the punishment type name and appealability from settings
    let punishmentTypeName = 'Violation';
    let punishmentTypeIsAppealable = true;
    
    try {
      const Settings = req.serverDbConnection.model('Settings');
      const settings = await Settings.findOne({});
      if (settings?.settings?.punishmentTypes) {
        const punishmentTypes = typeof settings.settings.punishmentTypes === 'string' 
          ? JSON.parse(settings.settings.punishmentTypes) 
          : settings.settings.punishmentTypes;
        
        const punishmentType = punishmentTypes.find((pt: any) => pt.ordinal === punishment.type_ordinal);
        if (punishmentType) {
          punishmentTypeName = punishmentType.name;
          punishmentTypeIsAppealable = punishmentType.isAppealable !== false;
        }
      }
    } catch (settingsError) {
      console.warn('Could not fetch punishment type settings:', settingsError);
    }
    
    // Check if punishment is currently active
    let isActive = true;
    
    // Check if punishment has been pardoned
    if (punishment.data && punishment.data.get('active') === false) {
      isActive = false;
    }
    
    // Check if punishment has expired
    const duration = punishment.data?.get('duration');
    if (duration && duration > 0 && punishment.started) {
      const expiryDate = new Date(punishment.started.getTime() + duration);
      if (expiryDate < new Date()) {
        isActive = false;
      }
    }
    
    // Check if there's already an existing appeal for this punishment
    let existingAppeal = null;
    try {
      const Appeal = req.serverDbConnection.model('Appeal');
      const appeal = await Appeal.findOne({ 
        punishmentId: punishmentId,
        playerUuid: player.minecraftUuid 
      }).sort({ submittedDate: -1 });
      
      if (appeal) {
        existingAppeal = {
          id: appeal.id,
          status: appeal.status,
          submittedDate: appeal.submittedDate,
          resolved: appeal.resolved || false
        };
      }
    } catch (appealError) {
      console.warn('Could not check for existing appeals:', appealError);
    }
    
    // Return sanitized punishment data suitable for public appeals
    const publicPunishmentData = {
      id: punishment.id,
      type: punishmentTypeName,
      reason: punishment.data?.get('reason') || 'No reason provided',
      issued: punishment.issued,
      started: punishment.started,
      active: isActive,
      appealable: punishmentTypeIsAppealable,
      existingAppeal: existingAppeal,
      // Only include the most recent username for verification purposes
      playerUsername: player.usernames.length > 0 ? player.usernames[player.usernames.length - 1].username : 'Unknown'
    };
    
    res.json(publicPunishmentData);
    
  } catch (error) {
    console.error('Error fetching public punishment data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;