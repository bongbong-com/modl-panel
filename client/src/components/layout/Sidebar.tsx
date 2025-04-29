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
      className={cn(
        "fixed top-4 left-4 z-40 flex overflow-hidden",
        "bg-sidebar/90 h-auto min-h-[300px] rounded-2xl",
        "transition-all duration-300 ease-in-out",
        isLookupOpen ? "w-[320px]" : "w-16"
      )}
      style={{ backdropFilter: 'blur(12px)' }}
      onMouseLeave={() => isLookupOpen && toggleLookup()}
    >
      {/* Fixed-width sidebar navigation (always visible) */}
      <div className="w-16 flex-shrink-0 p-2 pt-4">
        <nav className="flex-1">
          <ul className="space-y-4">
            {navItems.map((item, index) => {
              const isActive = location === item.path || (item.path === '/lookup' && isLookupOpen);
              
              // Special handling for lookup icon
              if (item.path === '/lookup') {
                return (
                  <li key={item.path} className="relative">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isActive ? "secondary" : "ghost"}
                          size="icon"
                          className={cn(
                            "w-full h-10",
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
      
      {/* Expandable search area */}
      {isLookupOpen && (
        <div className="flex-grow p-2 pt-4">
          <div className="w-full h-10 mb-4">
            <Input
              placeholder="Search players..."
              className="w-full h-9 bg-background/90 border border-sidebar-border rounded-md text-sm px-3"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          
          {filteredLookups.length > 0 && searchQuery && (
            <div className="max-h-[calc(100%-60px)] overflow-y-auto pr-2">
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
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
