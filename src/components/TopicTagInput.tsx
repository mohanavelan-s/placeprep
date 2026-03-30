import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TopicTagInputProps {
  label: string;
  placeholder: string;
  value: string[];
  onChange: (value: string[]) => void;
  suggestions: string[];
  maxTags?: number;
  helperText?: string;
}

function normalizeTopic(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export default function TopicTagInput({
  label,
  placeholder,
  value,
  onChange,
  suggestions,
  maxTags = 8,
  helperText,
}: TopicTagInputProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const remaining = Math.max(0, maxTags - value.length);

  const filteredSuggestions = useMemo(() => {
    const loweredQuery = query.toLowerCase();
    return suggestions
      .filter((topic) => !value.some((selected) => selected.toLowerCase() === topic.toLowerCase()))
      .filter((topic) => !loweredQuery || topic.toLowerCase().includes(loweredQuery))
      .slice(0, 6);
  }, [query, suggestions, value]);

  function addTopic(topic: string) {
    const normalized = normalizeTopic(topic);
    if (!normalized || value.some((item) => item.toLowerCase() === normalized.toLowerCase()) || value.length >= maxTags) {
      return;
    }

    onChange([...value, normalized]);
    setQuery("");
  }

  function removeTopic(topic: string) {
    onChange(value.filter((item) => item !== topic));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTopic(query);
    }

    if (event.key === "Backspace" && !query && value.length) {
      removeTopic(value[value.length - 1]);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <label className="text-sm uppercase tracking-[0.18em] text-muted-foreground">{label}</label>
        <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          {value.length}/{maxTags}
        </span>
      </div>

      <div className="rounded-2xl border border-border/80 bg-background/60 p-3">
        <div className="mb-3 flex flex-wrap gap-2">
          {value.map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm text-foreground"
            >
              {topic}
              <button
                type="button"
                className="text-muted-foreground transition hover:text-foreground"
                onClick={() => removeTopic(topic)}
                aria-label={`Remove ${topic}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => window.setTimeout(() => setIsFocused(false), 120)}
            placeholder={remaining ? placeholder : "Tag limit reached"}
            disabled={!remaining}
            className="h-11 border-border/80 bg-background/80 pl-9"
          />
        </div>

        <AnimatePresence>
          {isFocused && remaining > 0 && filteredSuggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
              className="mt-3 grid gap-2"
            >
              {filteredSuggestions.map((topic) => (
                <Button
                  key={topic}
                  type="button"
                  variant="ghost"
                  className="justify-start rounded-xl border border-border/70 bg-card/70 px-4 py-3 text-left text-sm text-foreground hover:border-primary/30 hover:bg-primary/10"
                  onClick={() => addTopic(topic)}
                >
                  {topic}
                </Button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="text-sm leading-6 text-muted-foreground">
        {helperText || "Type to search, press Enter to add custom topics, and remove tags anytime."}
      </p>
    </div>
  );
}
