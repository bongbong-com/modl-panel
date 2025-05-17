import { useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2, ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePlayers } from '@/hooks/use-data';
import { Player } from '@/lib/types';

const LookupPage = () => {
  const [location, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Fetch players from API using React Query
  const { data: players, isLoading } = usePlayers();
  
  // Filter lookup results
  const filteredLookups = searchQuery && players
    ? players.filter(
        (player: Player) =>
          player.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          player.uuid.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : players || [];

  const handlePlayerSelect = (player: Player) => {
    // Navigate to player detail page with the player's UUID
    navigate(`/player/${player.uuid}`);
  };

  return (
    <div className="container max-w-4xl py-4 space-y-6">
      <div className="flex items-center">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/')}
          className="mr-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Player Lookup</h1>
      </div>
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search players by name or UUID..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {searchQuery ? (
            <>
              <h2 className="text-sm text-muted-foreground font-medium">
                {filteredLookups.length} Results
              </h2>
              
              {filteredLookups.length > 0 ? (
                <div className="grid gap-2">
                  {filteredLookups.map((player: Player) => (
                    <div 
                      key={player.uuid}
                      className="bg-card p-3 rounded-lg border border-border flex justify-between items-center cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => handlePlayerSelect(player)}
                    >
                      <div>
                        <p className="font-medium">{player.username}</p>
                        <p className="text-xs text-muted-foreground">
                          Last online: {player.lastOnline || 'Unknown'}
                        </p>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full ${
                        player.status === 'Active' ? 'bg-green-100 text-green-800' :
                        player.status === 'Warned' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {player.status}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-muted/30 p-6 rounded-lg text-center">
                  <p>No players found matching '{searchQuery}'</p>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="text-sm text-muted-foreground font-medium">
                Recent Players
              </h2>
              
              <div className="grid gap-2">
                {players && players.slice(0, 10).map((player: Player) => (
                  <div 
                    key={player.uuid}
                    className="bg-card p-3 rounded-lg border border-border flex justify-between items-center cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => handlePlayerSelect(player)}
                  >
                    <div>
                      <p className="font-medium">{player.username}</p>
                      <p className="text-xs text-muted-foreground">
                        Last online: {player.lastOnline || 'Unknown'}
                      </p>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full ${
                      player.status === 'Active' ? 'bg-green-100 text-green-800' :
                      player.status === 'Warned' ? 'bg-amber-100 text-amber-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {player.status}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Add padding at the bottom to account for the mobile navbar */}
      <div className="h-20"></div>
    </div>
  );
};

export default LookupPage;