import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';

interface SidebarContextType {
  expanded: boolean;
  isHovering: boolean;
  toggle: () => void;
  setExpanded: (expanded: boolean) => void;
  setIsHovering: (isHovering: boolean) => void;
  isSearchActive: boolean;
  setIsSearchActive: (isSearchActive: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider = ({ children }: { children: ReactNode }) => {
  const [expanded, setExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Automatically expand the sidebar when hovering or searching
  useEffect(() => {
    if (isHovering || isSearchActive) {
      setExpanded(true);
    } else {
      setExpanded(false);
    }
  }, [isHovering, isSearchActive]);

  const toggle = useCallback(() => {
    setExpanded(!expanded);
  }, [expanded]);

  return (
    <SidebarContext.Provider value={{ 
      expanded, 
      isHovering,
      toggle, 
      setExpanded, 
      setIsHovering,
      isSearchActive,
      setIsSearchActive
    }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = (): SidebarContextType => {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};
