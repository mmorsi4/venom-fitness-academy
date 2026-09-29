import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface SearchableOption {
  value: string;
  label: string;
  searchTerms?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  "data-testid"?: string;
}

export function SearchableSelect({
  options, value, onValueChange, placeholder = "Select...",
  searchPlaceholder = "Search...", emptyMessage = "No results found.",
  className, "data-testid": testId,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const selected = options.find(o => o.value === value);

  const filteredOptions = options.filter(o => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return o.label.toLowerCase().includes(q) || (o.searchTerms && o.searchTerms.toLowerCase().includes(q));
  }).slice(0, 50);

  return (
    <Popover open={open} onOpenChange={(val) => { setOpen(val); if (!val) setSearchTerm(""); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-testid={testId}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={searchTerm} onValueChange={setSearchTerm} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map(option => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.searchTerms ?? ""}`}
                  onSelect={() => { onValueChange(option.value); setOpen(false); setSearchTerm(""); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                  {option.label}
                </CommandItem>
              ))}
              {options.length > 50 && !searchTerm && (
                <div className="py-2 text-center text-xs text-muted-foreground">
                  Type to search more...
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
