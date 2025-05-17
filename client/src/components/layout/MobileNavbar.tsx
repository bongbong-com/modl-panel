import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { 
  Home, 
  Search, 
  Ticket, 
  Settings, 
  AlertCircle,
  BookOpen
} from 'lucide-react';

const MobileNavbar = () => {
  const [location, navigate] = useLocation();
  
  const isActive = (path: string) => {
    return location === path 
      ? "text-primary" 
      : "text-muted-foreground";
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="grid grid-cols-5 h-16">
        <NavItem 
          icon={<Home className="h-5 w-5" />} 
          label="Home" 
          isActive={isActive('/')} 
          onClick={() => navigate('/')} 
        />
        <NavItem 
          icon={<Search className="h-5 w-5" />} 
          label="Lookup" 
          isActive={isActive('/lookup')} 
          onClick={() => navigate('/lookup')} 
        />
        <NavItem 
          icon={<Ticket className="h-5 w-5" />} 
          label="Tickets" 
          isActive={isActive('/tickets')} 
          onClick={() => navigate('/tickets')} 
        />
        <NavItem 
          icon={<AlertCircle className="h-5 w-5" />} 
          label="Audit" 
          isActive={isActive('/audit')} 
          onClick={() => navigate('/audit')} 
        />
        <NavItem 
          icon={<Settings className="h-5 w-5" />} 
          label="Settings" 
          isActive={isActive('/settings')} 
          onClick={() => navigate('/settings')} 
        />
      </div>
    </div>
  );
};

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: string;
  onClick: () => void;
}

const NavItem = ({ icon, label, isActive, onClick }: NavItemProps) => {
  return (
    <button 
      className={`flex flex-col items-center justify-center ${isActive}`}
      onClick={onClick}
    >
      <div className="mb-0.5">
        {icon}
      </div>
      <span className="text-[10px]">{label}</span>
    </button>
  );
};

export default MobileNavbar;