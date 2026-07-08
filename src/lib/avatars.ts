// 24 self-contained avatars — emoji + gradient, no external assets needed.
export interface AvatarDef {
  id: string;
  emoji: string;
  /** Tailwind gradient classes for the avatar ring/background. */
  gradient: string;
  label: string;
}

export const AVATARS: AvatarDef[] = [
  { id: "fox", emoji: "🦊", gradient: "from-orange-500 to-rose-500", label: "Fox" },
  { id: "ghost", emoji: "👻", gradient: "from-indigo-400 to-violet-600", label: "Ghost" },
  { id: "alien", emoji: "👽", gradient: "from-emerald-400 to-teal-600", label: "Alien" },
  { id: "robot", emoji: "🤖", gradient: "from-slate-400 to-slate-700", label: "Robot" },
  { id: "cat", emoji: "🐱", gradient: "from-amber-400 to-orange-600", label: "Cat" },
  { id: "panda", emoji: "🐼", gradient: "from-zinc-300 to-zinc-600", label: "Panda" },
  { id: "dragon", emoji: "🐲", gradient: "from-green-500 to-emerald-700", label: "Dragon" },
  { id: "unicorn", emoji: "🦄", gradient: "from-pink-400 to-fuchsia-600", label: "Unicorn" },
  { id: "owl", emoji: "🦉", gradient: "from-amber-500 to-yellow-700", label: "Owl" },
  { id: "wolf", emoji: "🐺", gradient: "from-slate-400 to-blue-700", label: "Wolf" },
  { id: "tiger", emoji: "🐯", gradient: "from-orange-400 to-amber-600", label: "Tiger" },
  { id: "frog", emoji: "🐸", gradient: "from-lime-400 to-green-600", label: "Frog" },
  { id: "penguin", emoji: "🐧", gradient: "from-sky-400 to-indigo-600", label: "Penguin" },
  { id: "koala", emoji: "🐨", gradient: "from-gray-400 to-slate-600", label: "Koala" },
  { id: "lion", emoji: "🦁", gradient: "from-yellow-500 to-amber-700", label: "Lion" },
  { id: "shark", emoji: "🦈", gradient: "from-cyan-400 to-blue-700", label: "Shark" },
  { id: "octopus", emoji: "🐙", gradient: "from-rose-400 to-pink-600", label: "Octopus" },
  { id: "bee", emoji: "🐝", gradient: "from-yellow-400 to-orange-600", label: "Bee" },
  { id: "monkey", emoji: "🐵", gradient: "from-amber-600 to-yellow-800", label: "Monkey" },
  { id: "dog", emoji: "🐶", gradient: "from-orange-300 to-amber-500", label: "Dog" },
  { id: "bear", emoji: "🐻", gradient: "from-amber-700 to-orange-900", label: "Bear" },
  { id: "skull", emoji: "💀", gradient: "from-zinc-400 to-neutral-700", label: "Skull" },
  { id: "devil", emoji: "😈", gradient: "from-purple-500 to-fuchsia-700", label: "Devil" },
  { id: "ninja", emoji: "🥷", gradient: "from-slate-600 to-zinc-900", label: "Ninja" },
];

const AVATAR_MAP = new Map(AVATARS.map((a) => [a.id, a]));

export function getAvatar(id: string | undefined | null): AvatarDef {
  return (id && AVATAR_MAP.get(id)) || AVATARS[0];
}

export function isValidAvatar(id: string): boolean {
  return AVATAR_MAP.has(id);
}
