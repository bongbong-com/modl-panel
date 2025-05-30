import { setupMinecraftRoutes } from './routes/minecraft-routes';
import express from 'express';
import { connectToMongoDB } from './db/mongodb';

// Create express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// For development testing, set environment variables
process.env.NODE_ENV = 'development';
process.env.SKIP_API_AUTH = 'true';
process.env.MINECRAFT_API_KEY = 'development-test-key';

// Simple middleware to log requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Register the Minecraft routes
setupMinecraftRoutes(app);

// Start the server for testing
async function startServer() {
  try {
    // Connect to MongoDB
    await connectToMongoDB();
    
    // Start the server
    const port = 3001;
    app.listen(port, () => {
      console.log(`Test server running on port ${port}`);
      console.log('Minecraft routes available for testing:');
      console.log('- POST /minecraft/player/login');
      console.log('- POST /minecraft/player/disconnect');
      console.log('- POST /minecraft/ticket/create');
      console.log('- POST /minecraft/punishment/create');
      console.log('- POST /minecraft/player/note/create');
      console.log('- GET /minecraft/player');
      console.log('- GET /minecraft/player/linked');
      console.log('\nPress Ctrl+C to stop the server');
    });
  } catch (error) {
    console.error('Failed to start test server:', error);
    process.exit(1);
  }
}

// Run the server
startServer();
