import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Home,
  Search,
  Ticket,
  FileText,
  Settings,
  BookOpen
} from "lucide-react";

const MobileNavbar = () => {
  const [location, navigate] = useLocation();

  // Define nav items
  const navItems = [
    {
      name: "Home",
      path: "/",
      icon: <Home className="h-5 w-5" />,
      onClick: () => navigate("/")
    },
    {
      name: "Lookup",
      path: "/lookup",
      icon: <Search className="h-5 w-5" />,
      onClick: () => navigate("/lookup")
    },
    {
      name: "Tickets",
      path: "/tickets",
      icon: <Ticket className="h-5 w-5" />,
      onClick: () => navigate("/tickets")
    },
    {
      name: "Audit",
      path: "/audit",
      icon: <FileText className="h-5 w-5" />,
      onClick: () => navigate("/audit")
    },
    {
      name: "Docs",
      path: "/api-docs",
      icon: <BookOpen className="h-5 w-5" />,
      onClick: () => navigate("/api-docs")
    },
    {
      name: "Settings",
      path: "/settings",
      icon: <Settings className="h-5 w-5" />,
      onClick: () => navigate("/settings")
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-sidebar/90 backdrop-blur-md border-t border-border z-50">
      <div className="flex h-full items-center justify-around">
        {navItems.map((item) => {
          const isActive = location === item.path;
          
          return (
            <button
              key={item.path}
              className={cn(
                "flex flex-col items-center justify-center px-2 py-1 w-1/6",
                isActive && "text-primary"
              )}
              onClick={item.onClick}
            >
              <div className="relative">
                {item.icon}
                {item.name === "Tickets" && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[8px] text-white">
                    5
                  </span>
                )}
              </div>
              <span className="text-[9px] mt-1">{item.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileNavbar;