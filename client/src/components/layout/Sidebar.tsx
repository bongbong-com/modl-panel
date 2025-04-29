import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/hooks/use-sidebar';
import { 
  Home, 
  Search, 
  Ticket, 
  FileText, 
  Settings, 
  FoldHorizontal, 
  UnfoldHorizontal, 
  LogOut
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const Sidebar = () => {
  const { expanded, toggle } = useSidebar();
  const [location, navigate] = useLocation();

  const navItems = [
    { 
      name: 'Home', 
      path: '/', 
      icon: <Home className="h-5 w-5" />,
      notifications: 3
    },
    { 
      name: 'Lookup', 
      path: '/lookup', 
      icon: <Search className="h-5 w-5" />,
    },
    { 
      name: 'Tickets', 
      path: '/tickets', 
      icon: <Ticket className="h-5 w-5" />,
      notifications: 5
    },
    { 
      name: 'Audit', 
      path: '/audit', 
      icon: <FileText className="h-5 w-5" />,
    },
    { 
      name: 'Settings', 
      path: '/settings', 
      icon: <Settings className="h-5 w-5" />,
    },
  ];

  return (
    <aside 
      className={cn(
        "bg-sidebar h-screen border-r border-sidebar-border transition-all duration-300 ease-in-out overflow-hidden fixed top-0 left-0 z-40", 
        expanded ? "sidebar-expanded" : "sidebar-collapsed"
      )}
      style={{ opacity: 0.95 }}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-sidebar-border">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-md bg-sidebar-primary/20 flex items-center justify-center">
              <span className="text-sidebar-primary text-lg font-bold">G</span>
            </div>
            <h1 className="text-lg font-semibold text-white sidebar-expanded-only">Mod Panel</h1>
          </div>
          <Button
            variant="ghost" 
            size="icon"
            onClick={toggle}
            className="text-sidebar-foreground hover:bg-sidebar-accent/10 hover:text-sidebar-accent"
          >
            {expanded ? <FoldHorizontal className="h-5 w-5" /> : <UnfoldHorizontal className="h-5 w-5" />}
          </Button>
        </div>
        
        {/* Nav Links */}
        <nav className="py-4 flex-1 overflow-y-auto scrollbar">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => {
              const isActive = location === item.path;
              return (
                <li key={item.path}>
                  {expanded ? (
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start px-3 py-6 h-auto",
                        isActive && "bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/20"
                      )}
                      onClick={() => navigate(item.path)}
                    >
                      {item.icon}
                      <span className="ml-3">{item.name}</span>
                      {item.notifications && (
                        <Badge 
                          variant="default" 
                          className="ml-auto bg-sidebar-primary text-white"
                        >
                          {item.notifications}
                        </Badge>
                      )}
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isActive ? "secondary" : "ghost"}
                          size="icon"
                          className={cn(
                            "w-full h-12",
                            isActive && "bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/20"
                          )}
                          onClick={() => navigate(item.path)}
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
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        
        {/* User area */}
        <div className="border-t border-sidebar-border px-4 py-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 bg-sidebar-accent">
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <div className="sidebar-expanded-only">
              <p className="text-sm font-medium">JohnDoe</p>
              <p className="text-xs text-muted-foreground">Admin</p>
            </div>
            <div className="ml-auto sidebar-expanded-only">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
