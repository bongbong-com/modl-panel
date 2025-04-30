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
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize position once
  useEffect(() => {
    if (!isOpen || !windowRef.current || isInitialized) return;
    
    // Center the window if initial position is percentage based
    if (typeof initialPosition.x === 'string' && initialPosition.x.includes('%')) {
      const windowWidth = windowRef.current.offsetWidth;
      const windowHeight = windowRef.current.offsetHeight;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Safe parsing of percentage values
      let xPercent = 0.5; // Default to 50%
      let yPercent = 0.5; // Default to 50%
      
      if (typeof initialPosition.x === 'string') {
        const parsedX = parseFloat(initialPosition.x);
        if (!isNaN(parsedX)) {
          xPercent = parsedX / 100;
        }
      }
      
      if (typeof initialPosition.y === 'string') {
        const parsedY = parseFloat(initialPosition.y);
        if (!isNaN(parsedY)) {
          yPercent = parsedY / 100;
        }
      }
      
      const xPos = viewportWidth * xPercent - windowWidth * xPercent;
      const yPos = viewportHeight * yPercent - windowHeight * yPercent;
      
      setPosition({ x: xPos, y: yPos });
      setIsInitialized(true);
    }
  }, [isOpen, initialPosition, isInitialized]);

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

  // Determine transform style based on position type
  const transformStyle = (typeof position.x === 'string' && position.x.includes('%')) 
    ? 'translate(-50%, -50%)' 
    : 'none';

  // Function to handle resize
  const handleResize = (e: React.MouseEvent, direction: 'right' | 'bottom' | 'corner') => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isMaximized) return; // Don't allow resize when maximized
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (direction === 'right' || direction === 'corner') {
        const newWidth = Math.max(300, startWidth + (moveEvent.clientX - startX));
        setSize(prev => ({ ...prev, width: newWidth }));
      }
      
      if (direction === 'bottom' || direction === 'corner') {
        const newHeight = Math.max(200, startHeight + (moveEvent.clientY - startY));
        setSize(prev => ({ ...prev, height: newHeight }));
      }
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      ref={windowRef}
      id={id}
      className={cn(
        "resizable-window fixed bg-background border border-border rounded-lg shadow-lg overflow-hidden",
        isMaximized && "!top-0 !left-0 !w-full !h-full !max-w-none !max-h-none !resize-none z-50"
      )}
      style={{
        top: typeof position.y === 'number' ? `${position.y}px` : position.y,
        left: typeof position.x === 'number' ? `${position.x}px` : position.x,
        width: isMaximized ? '100%' : size.width,
        height: isMaximized ? '100%' : size.height,
        transform: transformStyle,
        zIndex: 40
      }}
    >
      <div 
        ref={headerRef}
        className="window-header flex justify-between items-center p-4 border-b border-border bg-card rounded-t-lg cursor-move"
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
      
      {/* Resize handles */}
      {!isMaximized && (
        <>
          {/* Right resize handle */}
          <div 
            className="absolute top-0 right-0 h-full w-3 cursor-e-resize"
            onMouseDown={(e) => handleResize(e, 'right')}
          />
          
          {/* Bottom resize handle */}
          <div 
            className="absolute bottom-0 left-0 w-full h-3 cursor-s-resize"
            onMouseDown={(e) => handleResize(e, 'bottom')}
          />
          
          {/* Corner resize handle with visual indicator */}
          <div 
            className="absolute bottom-0 right-0 w-8 h-8 cursor-se-resize flex items-end justify-end pb-0.5 pr-0.5"
            onMouseDown={(e) => handleResize(e, 'corner')}
          >
            <div className="w-3 h-3 flex flex-col items-end">
              <div className="h-[2px] w-[2px] bg-border mb-[1px]"></div>
              <div className="h-[2px] w-[5px] bg-border mb-[1px]"></div>
              <div className="h-[2px] w-[8px] bg-border"></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ResizableWindow;
