import { Bot } from 'lucide-react';

export function AssistantHost() {
  return (
    <button
      type="button"
      aria-label="Kisan Mitra AI"
      className="beacon-pulse fixed bottom-20 right-4 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg md:bottom-6 md:right-6"
    >
      <Bot size={26} aria-hidden />
    </button>
  );
}
