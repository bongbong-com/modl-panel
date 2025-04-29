import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/hooks/use-sidebar';
import { useState, useEffect } from 'react';
import { 
  Home, 
  Search, 
  Ticket, 
  FileText, 
  Settings
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
  const [isLookupClosing, setIsLookupClosing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isHoveringSearch, setIsHoveringSearch] = useState(false);
  
  const openLookup = () => {
    if (!isLookupOpen && !isLookupClosing) {
      setIsLookupOpen(true);
      setIsLookupClosing(false);
    }
  };
  
  const closeLookup = () => {
    if (!isLookupOpen || isHoveringSearch) return; // Don't close if hovering over search
    setIsLookupClosing(true);
    setTimeout(() => {
      setIsLookupOpen(false);
      setIsLookupClosing(false);
      setSearchQuery('');
      setIsFocused(false);
    }, 100); // Faster than before for immediate effect
  };

  // Update search active state when search query changes
  useEffect(() => {
    setIsSearchActive(searchQuery.length > 0);
  }, [searchQuery, setIsSearchActive]);

  // Define nav items
  const navItems = [
    { 
      name: 'Home', 
      path: '/', 
      icon: <Home className="h-5 w-5" />,
      notifications: 3,
      onClick: () => {
        if (isLookupOpen) closeLookup();
        navigate('/');
      }
    },
    { 
      name: 'Lookup', 
      path: '/lookup', 
      icon: <Search className="h-5 w-5" />,
      onClick: () => isLookupOpen ? closeLookup() : openLookup()
    },
    { 
      name: 'Tickets', 
      path: '/tickets', 
      icon: <Ticket className="h-5 w-5" />,
      notifications: 5,
      onClick: () => {
        if (isLookupOpen) closeLookup();
        navigate('/tickets');
      }
    },
    { 
      name: 'Audit', 
      path: '/audit', 
      icon: <FileText className="h-5 w-5" />,
      onClick: () => {
        if (isLookupOpen) closeLookup();
        navigate('/audit');
      }
    },
    { 
      name: 'Settings', 
      path: '/settings', 
      icon: <Settings className="h-5 w-5" />,
      onClick: () => {
        if (isLookupOpen) closeLookup();
        navigate('/settings');
      }
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
    <div className="fixed top-1/4 left-4 z-40 flex">
      {/* Fixed-width sidebar navigation (always visible) */}
      <aside 
        className="bg-sidebar/90 h-auto min-h-[300px] rounded-2xl w-16 overflow-hidden"
        style={{ backdropFilter: 'blur(12px)' }}
        onClick={(e) => {
          // Close search if clicked anywhere except the lookup button
          if (isLookupOpen && !(e.target as HTMLElement).closest('button[data-lookup="true"]')) {
            closeLookup();
          }
        }}
      >
        <div className="w-16 p-2 pt-4">
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
                            onClick={() => isLookupOpen ? closeLookup() : openLookup()}
                            onMouseEnter={openLookup}
                            onMouseLeave={() => setTimeout(closeLookup, 50)}
                            data-lookup="true"
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
      </aside>
      
      {/* Expandable search area */}
      {isLookupOpen && (
        <div 
          className={`bg-sidebar/90 h-auto min-h-[300px] ml-2 rounded-xl overflow-hidden ${isLookupClosing ? 'animate-slide-left' : 'animate-slide-right'}`}
          style={{ backdropFilter: 'blur(12px)' }}
          onMouseEnter={() => {
            setIsLookupClosing(false);
            setIsHoveringSearch(true);
          }}
          onMouseLeave={() => {
            setIsHoveringSearch(false);
            closeLookup();
          }}
        >
          <div className="p-3 pt-4 w-[240px]">
            <Input
              placeholder="Search players..."
              className="w-full h-9 bg-background/90 border border-sidebar-border rounded-md text-sm px-3 mb-3"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
            
            {filteredLookups.length > 0 && searchQuery && (
              <div className="max-h-[220px] overflow-y-auto pr-1">
                {filteredLookups.map((player, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="w-full justify-start text-xs py-2 px-3 h-auto mb-1"
                    onClick={() => {
                      navigate(`/lookup?id=${player.uuid}`);
                      closeLookup();
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
        </div>
      )}
    </div>
  );
};

export default Sidebar;