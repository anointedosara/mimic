import { z } from "zod";
import { isValidAvatar } from "@/lib/avatars";

export const signupSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(24, "Name must be at most 24 characters"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  avatar: z.string().refine(isValidAvatar, "Pick a valid avatar"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(24).optional(),
  avatar: z.string().refine(isValidAvatar).optional(),
});

export const createRoomSchema = z.object({
  maxPlayers: z.number().int().min(3).max(20),
  imposterCount: z.number().int().min(1).max(6),
  durationSeconds: z.number().int().min(30).max(900),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
