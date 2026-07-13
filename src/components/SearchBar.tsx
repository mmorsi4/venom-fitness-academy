import { Input } from "./ui/input";
import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({ value, onChange, placeholder = "Search...", className = "" }: SearchBarProps) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        className="pl-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
