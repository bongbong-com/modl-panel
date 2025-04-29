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
  ChevronUp
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

  // Reorder nav items to put lookup at the top
  const navItems = [
    { 
      name: 'Lookup', 
      path: '/lookup', 
      icon: <Search className="h-5 w-5" />,
      onClick: toggleLookup
    },
    { 
      name: 'Home', 
      path: '/', 
      icon: <Home className="h-5 w-5" />,
      notifications: 3,
      onClick: () => navigate('/')
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
      className="bg-sidebar/90 h-auto min-h-[300px] transition-all duration-300 ease-in-out overflow-hidden fixed top-4 left-4 z-40 rounded-2xl w-16"
      style={{ backdropFilter: 'blur(12px)' }}
    >
      <div className="flex flex-col h-full p-2 pt-4">
        {/* Lookup Search Bar at Top */}
        <div className="mb-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isLookupOpen ? "secondary" : "ghost"}
                size="icon"
                className={cn(
                  "w-full h-10 mb-1",
                  isLookupOpen && "bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/20"
                )}
                onClick={toggleLookup}
              >
                <div className="relative">
                  <Search className="h-5 w-5" />
                </div>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Lookup</TooltipContent>
          </Tooltip>
          
          {isLookupOpen && (
            <div className="py-2">
              <Input
                placeholder="Search..."
                className="w-full text-xs px-2 py-1 h-8 bg-background/50 border-sidebar-border"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {(filteredLookups.length > 0 && searchQuery) && (
                <div 
                  className="absolute left-20 top-16 bg-background/95 border border-border rounded-lg shadow-lg w-64 max-h-[280px] overflow-y-auto mt-1 z-50"
                  style={{ backdropFilter: 'blur(12px)' }}
                >
                  {filteredLookups.map((player, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      className="w-full justify-start text-xs py-3 px-3 h-auto"
                      onClick={() => navigate(`/lookup?id=${player.uuid}`)}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{player.username}</span>
                        <span className="text-muted-foreground text-[10px]">{player.lastOnline}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto scrollbar">
          <ul className="space-y-4">
            {navItems.slice(1).map((item) => { // Skip the lookup item which is now handled above
              const isActive = location === item.path;
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
