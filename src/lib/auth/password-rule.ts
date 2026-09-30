import { z } from "zod";

// The one definition of what a new password must satisfy, used wherever a
// password is set (signup, password reset). Kept apart from `password.ts` so
// client forms can import the length for their `minLength` without pulling
// bcrypt into the browser bundle.
export const PASSWORD_MIN_LENGTH = 8;

export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH);
