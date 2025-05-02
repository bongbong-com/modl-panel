import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { Staff } from "./models/mongodb-schemas";
import { createSystemLog } from "./routes/log-routes";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

declare global {
  namespace Express {
    interface User {
      _id: string;
      email: string;
      username: string;
      profilePicture?: string;
      admin: boolean;
    }
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  try {
    // Check if the stored password is in the correct format
    if (!stored || !stored.includes(".")) {
      console.error("Invalid stored password format");
      return false;
    }
    
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Error comparing passwords:", error);
    return false;
  }
}

// For demo purposes - normally you would store and verify these properly
const verificationCodes = new Map<string, string>();

// Generate a random 6-digit code
function generateVerificationCode(email: string): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  verificationCodes.set(email, code);
  console.log(`Generated verification code for ${email}: ${code}`);
  return code;
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "session-secret-dev-only",
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({
      usernameField: 'username',
      passwordField: 'password',
      passReqToCallback: true
    }, async (req, username, password, done) => {
      try {
        // Check verification method from request
        const { verificationMethod, verificationCode } = req.body;
        
        // Always use admin user for demo
        let user = await Staff.findOne({ admin: true });
        
        // If no admin user exists yet, create a demo user
        if (!user) {
          console.log("Creating demo admin user...");
          user = new Staff({
            username: "admin",
            email: "admin@cobl.gg",
            password: await hashPassword("adminpass"),
            admin: true,
            profilePicture: `https://ui-avatars.com/api/?name=Admin`
          });
          await user.save();
        }
        
        // Demo mode - all verification methods always succeed
        if (verificationMethod === 'email') {
          console.log(`Demo mode: Email verification always successful`);
        } else if (verificationMethod === '2fa') {
          console.log(`Demo mode: 2FA verification always successful`);
        } else if (verificationMethod === 'passkey') {
          console.log(`Demo mode: Passkey authentication always successful`);
        } else {
          console.log(`Demo mode: Password authentication always successful`);
        }
        
        return done(null, {
          _id: user._id,
          email: user.email,
          username: user.username,
          profilePicture: user.profilePicture,
          admin: user.admin
        });
      } catch (error) {
        return done(error);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await Staff.findById(id, { password: 0, twoFaSecret: 0 });
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, email, password } = req.body;
      
      // Check if user already exists
      const existingUser = await Staff.findOne({
        $or: [{ username }, { email }]
      });
      
      if (existingUser) {
        return res.status(400).json({
          message: "User with that username or email already exists"
        });
      }
      
      // Create new user
      const hashedPassword = await hashPassword(password);
      const newUser = new Staff({
        username,
        email,
        password: hashedPassword,
        admin: false, // Default to regular staff
        profilePicture: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}`
      });
      
      await newUser.save();
      
      // Log registration
      await createSystemLog(`New staff member registered: ${username}`);
      
      // Log user in
      req.login(
        {
          _id: newUser._id,
          username: newUser.username,
          email: newUser.email,
          profilePicture: newUser.profilePicture,
          admin: newUser.admin
        },
        err => {
          if (err) return next(err);
          
          res.status(201).json({
            _id: newUser._id,
            username: newUser.username,
            email: newUser.email,
            profilePicture: newUser.profilePicture,
            admin: newUser.admin
          });
        }
      );
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Request email verification code
  app.post("/api/request-email-verification", async (req, res) => {
    const { email } = req.body;
    
    try {
      // Demo mode - always succeed regardless of email
      const code = generateVerificationCode(email || "demo@example.com");
      
      console.log(`Demo mode: Email verification requested for ${email}. Code: ${code}`);
      
      return res.status(200).json({ 
        message: "Verification code sent",
        // For demo purposes only! Don't send the code back in production
        code
      });
    } catch (error) {
      console.error("Error requesting email verification:", error);
      // Even on error, return success in demo mode
      return res.status(200).json({ 
        message: "Verification code sent",
        code: "123456"
      });
    }
  });

  // Request 2FA verification code
  app.post("/api/request-2fa-verification", async (req, res) => {
    const { email } = req.body;
    
    try {
      // Demo mode - always succeed regardless of email
      const code = generateVerificationCode(email || "demo@example.com");
      
      console.log(`Demo mode: 2FA verification requested for ${email}. Code: ${code}`);
      
      return res.status(200).json({ 
        message: "2FA verification required",
        // For demo purposes only! Don't send the code back in production
        code
      });
    } catch (error) {
      console.error("Error with 2FA verification:", error);
      // Even on error, return success in demo mode
      return res.status(200).json({ 
        message: "2FA verification required",
        code: "123456"
      });
    }
  });

  // Request passkey authentication
  app.post("/api/request-passkey-auth", async (req, res) => {
    const { email } = req.body;
    
    try {
      // Demo mode - always succeed regardless of email
      console.log(`Demo mode: Passkey authentication requested for ${email}`);
      
      return res.status(200).json({ 
        message: "Passkey authentication initiated",
        challenge: "simulated-passkey-challenge"
      });
    } catch (error) {
      console.error("Error with passkey authentication:", error);
      // Even on error, return success in demo mode
      return res.status(200).json({ 
        message: "Passkey authentication initiated",
        challenge: "simulated-passkey-challenge"
      });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }
      
      req.login(user, err => {
        if (err) return next(err);
        
        createSystemLog(`User ${user.username} logged in`, "info", user.username)
          .catch(err => console.error("Failed to log login:", err));
        
        return res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    const username = req.user?.username;
    req.logout(err => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      
      if (username) {
        createSystemLog(`User ${username} logged out`, "info", username)
          .catch(err => console.error("Failed to log logout:", err));
      }
      
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });
}