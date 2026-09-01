import { customAlphabet } from "nanoid";

// Unambiguous uppercase alphabet (no 0/O/1/I) for invite codes people type by hand.
const inviteAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const generateInviteCode = customAlphabet(inviteAlphabet, 8);
