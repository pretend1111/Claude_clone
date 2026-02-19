import React, { useState, useCallback, useEffect } from 'react';

interface DraggableDividerProps {
  onResize: (percent: number) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
}

const DraggableDivider: React.FC<DraggableDividerProps> = ({ onResize, containerRef }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      let percent = 0;
      if (containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Calculate X relative to the container's left edge
        const relativeX = e.clientX - rect.left;
        // Panel width % = 100% - (Mouse Position %)
        percent = 100 - (relativeX / rect.width) * 100;
      } else {
        // Fallback to window width
        percent = 100 - (e.clientX / window.innerWidth) * 100;
      }
      const clamped = Math.min(75, Math.max(25, percent));
      onResize(clamped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, onResize, containerRef]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`w-[12px] -ml-[6px] flex-shrink-0 cursor-col-resize z-50 flex justify-end h-full group outline-none`}
    >
      <div className={`w-[1px] h-full transition-colors duration-200 ${isDragging ? 'bg-blue-500' : 'bg-transparent group-hover:bg-blue-400'
        }`} />
    </div>
  );
};

export default DraggableDivider;
