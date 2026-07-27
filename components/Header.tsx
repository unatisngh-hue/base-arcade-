'use client';

interface HeaderProps {
  title: string;
  onTitleClick: () => void;
}

export function Header({ title, onTitleClick }: HeaderProps) {
  return (
    <h1
      onClick={onTitleClick}
      className="font-pixel text-[33px] tracking-[1.5px] font-normal text-title-fill cursor-pointer select-none text-center leading-[1.4]"
      style={{
        WebkitTextStroke: '0.9px var(--title-outline)',
        textShadow: '3px 3px 0 var(--title-shadow)',
      }}
    >
      {title}
    </h1>
  );
}
