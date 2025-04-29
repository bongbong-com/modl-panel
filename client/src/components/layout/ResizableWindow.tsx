import { useRef, useEffect, useState, ReactNode } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WindowPosition } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface ResizableWindowProps {
  id: string;
  title: string;
  isOpen: boolean;
  initialPosition?: WindowPosition;
  initialSize?: { width: number; height: number };
  onClose: () => void;
  children: ReactNode;
}

const ResizableWindow = ({
  id,
  title,
  isOpen,
  initialPosition = { x: '50%', y: '50%' },
  initialSize = { width: 600, height: 500 },
  onClose,
  children
}: ResizableWindowProps) => {
  const windowRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const [size, setSize] = useState(initialSize);
  const [isMaximized, setIsMaximized] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [windowOffset, setWindowOffset] = useState({ x: 0, y: 0 });

  // Initial positioning
  useEffect(() => {
    if (!isOpen || !windowRef.current) return;
    
    // Center the window if initial position is percentage based
    if (typeof initialPosition.x === 'string' && initialPosition.x.includes('%')) {
      const windowWidth = windowRef.current.offsetWidth;
      const windowHeight = windowRef.current.offsetHeight;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      const xPercent = parseInt(initialPosition.x) / 100;
      const yPercent = parseInt(initialPosition.y) / 100;
      
      const xPos = viewportWidth * xPercent - windowWidth * xPercent;
      const yPos = viewportHeight * yPercent - windowHeight * yPercent;
      
      setPosition({ x: xPos, y: yPos });
    } else {
      setPosition(initialPosition);
    }
  }, [isOpen, initialPosition]);

  // Handle dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !windowRef.current) return;
      
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      
      // Constrain to viewport
      const maxX = window.innerWidth - windowRef.current.offsetWidth;
      const maxY = window.innerHeight - windowRef.current.offsetHeight;
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!windowRef.current) return;
    
    setIsMaximized(false);
    setIsDragging(true);
    setDragStart({
      x: e.clientX - (typeof position.x === 'number' ? position.x : 0),
      y: e.clientY - (typeof position.y === 'number' ? position.y : 0)
    });
  };

  const handleMaximize = () => {
    if (isMaximized) {
      // Restore
      setIsMaximized(false);
      setPosition({ x: windowOffset.x, y: windowOffset.y });
      setSize(initialSize);
    } else {
      // Maximize
      setIsMaximized(true);
      setWindowOffset({ 
        x: typeof position.x === 'number' ? position.x : 0, 
        y: typeof position.y === 'number' ? position.y : 0 
      });
      setPosition({ x: 0, y: 0 });
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={windowRef}
      id={id}
      className={cn(
        "resizable-window bg-background border border-border",
        isMaximized && "!fixed !top-0 !left-0 !w-full !h-full !max-w-none !max-h-none !resize-none"
      )}
      style={{
        top: typeof position.y === 'number' ? `${position.y}px` : position.y,
        left: typeof position.x === 'number' ? `${position.x}px` : position.x,
        width: isMaximized ? '100%' : size.width,
        height: isMaximized ? '100%' : size.height,
        transform: (typeof position.x === 'string' && position.x.includes('%')) ? 'translate(-50%, -50%)' : 'none'
      }}
    >
      <div 
        ref={headerRef}
        className="window-header flex justify-between items-center p-4 border-b border-border bg-card"
        onMouseDown={handleMouseDown}
      >
        <h3 className="font-medium">{title}</h3>
        <div className="flex space-x-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleMaximize}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="p-4 h-[calc(100%-60px)] overflow-y-auto scrollbar">
        {children}
      </div>
    </div>
  );
};

export default ResizableWindow;
