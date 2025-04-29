import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/hooks/use-sidebar';
import { useState, useEffect } from 'react';
import { 
  Home, 
  Search, 
  Ticket, 
  FileText, 
  Settings, 
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { recentLookups } from '@/data/mockData';

const Sidebar = () => {
  const { isSearchActive, setIsSearchActive } = useSidebar();
  const [location, navigate] = useLocation();
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const toggleLookup = () => {
    setIsLookupOpen(!isLookupOpen);
  };

  // Update search active state when search query changes
  useEffect(() => {
    setIsSearchActive(searchQuery.length > 0);
  }, [searchQuery, setIsSearchActive]);

  // Define nav items with Home first and Lookup second
  const navItems = [
    { 
      name: 'Home', 
      path: '/', 
      icon: <Home className="h-5 w-5" />,
      notifications: 3,
      onClick: () => navigate('/')
    },
    { 
      name: 'Lookup', 
      path: '/lookup', 
      icon: <Search className="h-5 w-5" />,
      onClick: toggleLookup
    },
    { 
      name: 'Tickets', 
      path: '/tickets', 
      icon: <Ticket className="h-5 w-5" />,
      notifications: 5,
      onClick: () => navigate('/tickets')
    },
    { 
      name: 'Audit', 
      path: '/audit', 
      icon: <FileText className="h-5 w-5" />,
      onClick: () => navigate('/audit')
    },
    { 
      name: 'Settings', 
      path: '/settings', 
      icon: <Settings className="h-5 w-5" />,
      onClick: () => navigate('/settings')
    },
  ];

  // Filter lookup results
  const filteredLookups = searchQuery 
    ? recentLookups.filter(player => 
        player.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        player.uuid.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : recentLookups;

  return (
    <aside 
      className={`bg-sidebar/90 h-auto min-h-[300px] transition-all duration-300 ease-in-out overflow-visible fixed top-4 left-4 z-40 rounded-2xl ${isLookupOpen ? 'w-[340px]' : 'w-16'}`}
      style={{ backdropFilter: 'blur(12px)' }}
    >
      <div className="flex flex-col h-full p-2 pt-4">
        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto scrollbar">
          <ul className="space-y-4">
            {navItems.map((item, index) => {
              const isActive = location === item.path || (item.path === '/lookup' && isLookupOpen);
              
              // Special handling for lookup
              if (item.path === '/lookup') {
                return (
                  <li key={item.path} className="relative group">
                    <div className="flex justify-between items-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={isActive ? "secondary" : "ghost"}
                            size="icon"
                            className={cn(
                              "w-10 h-10",
                              isActive && "bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/20"
                            )}
                            onClick={toggleLookup}
                            onMouseEnter={() => !isLookupOpen && toggleLookup()}
                          >
                            <div className="relative">
                              <Search className="h-5 w-5" />
                            </div>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Lookup</TooltipContent>
                      </Tooltip>
                      
                      {isLookupOpen && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 mr-1" 
                          onClick={toggleLookup}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    {isLookupOpen && (
                      <div className="mt-3 px-2 w-full">
                        <div className="w-full space-y-3">
                          <div className="flex items-center">
                            <Input
                              placeholder="Search players..."
                              className="w-full text-sm px-3 py-2 h-9 bg-background/50 border-sidebar-border"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              autoFocus
                            />
                          </div>
                          
                          {filteredLookups.length > 0 && searchQuery && (
                            <div className="max-h-[240px] overflow-y-auto">
                              {filteredLookups.map((player, index) => (
                                <Button
                                  key={index}
                                  variant="ghost"
                                  className="w-full justify-start text-xs py-2 px-3 h-auto mb-1"
                                  onClick={() => {
                                    navigate(`/lookup?id=${player.uuid}`);
                                    toggleLookup();
                                  }}
                                >
                                  <div className="flex flex-col items-start">
                                    <span className="font-medium">{player.username}</span>
                                    <span className="text-muted-foreground text-[10px]">{player.lastOnline}</span>
                                  </div>
                                </Button>
                              ))}
                            </div>
                          )}
                          
                          {!searchQuery && (
                            <div className="text-muted-foreground text-sm px-2 py-2">
                              Type to search for players...
                            </div>
                          )}
                          
                          {searchQuery && filteredLookups.length === 0 && (
                            <div className="text-muted-foreground text-sm px-2 py-2">
                              No players found matching "{searchQuery}"
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              }
              
              // Regular menu items
              return (
                <li key={item.path}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        size="icon"
                        className={cn(
                          "w-full h-10",
                          isActive && "bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/20"
                        )}
                        onClick={item.onClick}
                      >
                        <div className="relative">
                          {item.icon}
                          {item.notifications && (
                            <Badge 
                              variant="default" 
                              className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center bg-sidebar-primary text-white text-[10px]"
                            >
                              {item.notifications}
                            </Badge>
                          )}
                        </div>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.name}</TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
