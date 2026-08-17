import type { Timestamp } from "firebase/firestore";
import type { LocationRow, ProfileData } from "../config/hotelSchema";

export type SubmissionStatus =
  | "uploaded"
  | "extracting"
  | "extracted"
  | "extraction_failed"
  | "reviewed";

export type SendStatus = "sending" | "sent" | "send_failed" | "retry";

export interface Submission {
  industryId: string;
  fileName: string;
  filePath: string;
  uploadedBy: string;
  uploadedAt: Timestamp;
  status: SubmissionStatus;
  extractedProfile?: ProfileData;
  extractedLocations?: LocationRow[];
  extractionError?: string;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  sendStatus?: SendStatus;
  sendStartedAt?: Timestamp;
  sendError?: string;
  sentAt?: Timestamp;
}
