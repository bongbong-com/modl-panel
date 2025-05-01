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
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await Staff.findOne({ username });
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid username or password" });
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