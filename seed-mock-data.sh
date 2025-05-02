#!/bin/bash
# Script to run the mock data seeder

echo "🌱 Running enhanced mock data seeder..."
echo "This will create 20 mock players and 15 mock tickets in the database."
echo "Starting in 3 seconds..."
sleep 3

# Run the TypeScript script
npx tsx server/scripts/seed-mock-data.ts

echo "✅ Mock data seeding complete!"
echo "You can now use the application with mock data."