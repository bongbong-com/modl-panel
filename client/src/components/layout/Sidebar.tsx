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
  const { expanded, setIsHovering, setIsSearchActive } = useSidebar();
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
        "bg-sidebar/90 h-auto min-h-[300px] transition-all duration-300 ease-in-out overflow-hidden fixed top-4 left-4 z-40 rounded-2xl", 
        expanded ? "sidebar-expanded w-60" : "sidebar-collapsed w-16"
      )}
      style={{ backdropFilter: 'blur(12px)' }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="flex flex-col h-full p-2">
        {/* Header */}
        <div className="flex justify-center items-center mb-4 mt-2">
          <div className="flex flex-col items-center">
            {expanded && <h1 className="text-sm font-bold text-white">Mod Panel</h1>}
            {expanded && <p className="text-xs text-muted-foreground">JohnDoe - Admin</p>}
          </div>
        </div>
        
        {/* Nav Links */}
        <nav className="overflow-y-auto scrollbar">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.path || (item.path === '/lookup' && isLookupOpen);
              return (
                <li key={item.path}>
                  {expanded ? (
                    <div>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className={cn(
                          "w-full justify-start px-3 py-2 h-auto",
                          isActive && "bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/20"
                        )}
                        onClick={item.onClick}
                      >
                        {item.icon}
                        <span className="ml-3 text-sm">{item.name}</span>
                        {item.notifications && (
                          <Badge 
                            variant="default" 
                            className="ml-auto bg-sidebar-primary text-white"
                          >
                            {item.notifications}
                          </Badge>
                        )}
                        {item.path === '/lookup' && (
                          <span className="ml-auto">
                            {isLookupOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </span>
                        )}
                      </Button>
                      
                      {/* Lookup dropdown */}
                      {item.path === '/lookup' && isLookupOpen && (
                        <div className="pl-10 pr-2 py-2 space-y-2">
                          <Input
                            placeholder="Search players..."
                            className="w-full bg-background/50 border-sidebar-border"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                          />
                          {filteredLookups.length > 0 && (
                            <div className="max-h-40 overflow-y-auto">
                              {filteredLookups.map((player, index) => (
                                <Button
                                  key={index}
                                  variant="ghost"
                                  className="w-full justify-start text-xs py-2 px-2 h-auto"
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
                  ) : (
                    <div>
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
                      
                      {/* Collapsed lookup dropdown */}
                      {item.path === '/lookup' && isLookupOpen && (
                        <div className="py-2">
                          <Input
                            placeholder="Search..."
                            className="w-full text-xs px-1 py-1 h-7 bg-background/50 border-sidebar-border"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                          />
                          {filteredLookups.length > 0 && (
                            <div className="max-h-40 overflow-y-auto mt-1">
                              {filteredLookups.map((player, index) => (
                                <Button
                                  key={index}
                                  variant="ghost"
                                  size="icon"
                                  className="w-full h-8 mb-1"
                                  onClick={() => navigate(`/lookup?id=${player.uuid}`)}
                                >
                                  <div className="h-6 w-6 rounded-full bg-sidebar-accent/20 flex items-center justify-center">
                                    <span className="text-xs">{player.username.substring(0, 1)}</span>
                                  </div>
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
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
