import type { Timestamp } from "firebase/firestore";
import type { FieldValue, LocationRow, ProfileData } from "../config/hotelSchema";

export type SubmissionKind = "acord" | "factSheet";

export type SubmissionStatus =
  | "uploaded"
  | "extracting"
  | "extracted"
  | "extraction_failed"
  | "reviewed";

export type SendStatus = "sending" | "sent" | "send_failed" | "retry";

export interface SubmissionFile {
  fileName: string;
  filePath: string;
}

/** One candidate value a merge saw for a field, and which source file gave it. */
export interface FieldConflict {
  value: FieldValue;
  source: string;
}

/** fieldKey -> the distinct candidate values seen for it, when a merge couldn't pick one on its own. */
export type ConflictMap = Record<string, FieldConflict[]>;

export interface Submission {
  kind: SubmissionKind;
  industryId: string;
  // Present for kind "acord" (single file).
  fileName?: string;
  filePath?: string;
  // Present for kind "factSheet" (multiple files).
  files?: SubmissionFile[];
  uploadedBy: string;
  uploadedAt: Timestamp;
  status: SubmissionStatus;
  extractedProfile?: ProfileData;
  extractedLocations?: LocationRow[];
  fieldConflicts?: ConflictMap;
  /** Parallel to extractedLocations - one conflict map per location row. */
  locationConflicts?: ConflictMap[];
  extractionError?: string;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  sendStatus?: SendStatus;
  sendStartedAt?: Timestamp;
  sendError?: string;
  sentAt?: Timestamp;
}
