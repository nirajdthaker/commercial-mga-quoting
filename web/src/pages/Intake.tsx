import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ref, uploadBytes } from "firebase/storage";
import { storage } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { INDUSTRIES } from "../config/industries";

const ACCEPTED_EXTENSIONS = [".pdf", ".eml"];
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function hasAcceptedExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

type Status = "idle" | "submitting" | "received" | "error";

export function Intake() {
  const { user, signOut } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [industryId, setIndustryId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receivedFileName, setReceivedFileName] = useState("");
  const [receivedIndustryLabel, setReceivedIndustryLabel] = useState("");

  const selectedIndustry = INDUSTRIES.find((i) => i.id === industryId);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFileError(null);
    setFile(null);

    if (!selected) return;

    if (!hasAcceptedExtension(selected.name)) {
      setFileError("Only PDF or EML files are accepted.");
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setFileError("File is too large (25 MB max).");
      return;
    }
    setFile(selected);
  };

  const resetForm = () => {
    setIndustryId("");
    setFile(null);
    setFileError(null);
    setSubmitError(null);
    setStatus("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !selectedIndustry || !file) return;

    setStatus("submitting");
    setSubmitError(null);

    const path = `uploads/${user.uid}/${Date.now()}-${sanitizeFileName(file.name)}`;
    const storageRef = ref(storage, path);

    try {
      // File is stored under the signed-in user's own uid so it's ready
      // for the extraction step to pick up next. Storage rules restrict
      // read/write to that uid only (see storage.rules). Until the
      // extraction step exists to consume and clean these up, apply the
      // bucket lifecycle rule described in SETUP.md to auto-expire them.
      await uploadBytes(storageRef, file, { contentType: file.type || undefined });

      setReceivedFileName(file.name);
      setReceivedIndustryLabel(selectedIndustry.label);
      setStatus("received");
    } catch {
      setSubmitError("Something went wrong submitting your file. Please try again.");
      setStatus("error");
    }
  };

  if (status === "received") {
    return (
      <div className="page-center">
        <div className="card">
          <h1>Received</h1>
          <p className="subtitle">Your submission has been received.</p>
          <dl className="summary-list">
            <dt>Industry</dt>
            <dd>{receivedIndustryLabel}</dd>
            <dt>File</dt>
            <dd>{receivedFileName}</dd>
          </dl>
          <p className="fine-print">
            No further processing happens yet — that comes in the next step.
          </p>
          <button type="button" onClick={resetForm}>
            Submit another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-center">
      <form className="card" onSubmit={handleSubmit}>
        <div className="header-row">
          <div>
            <h1>New Submission</h1>
            <p className="subtitle">Florida Coastal Insurance Agency</p>
          </div>
          <button type="button" className="link-button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>

        <label htmlFor="industry">Industry</label>
        <select
          id="industry"
          value={industryId}
          onChange={(e) => setIndustryId(e.target.value)}
          required
        >
          <option value="" disabled>
            Select an industry…
          </option>
          {INDUSTRIES.map((industry) => (
            <option key={industry.id} value={industry.id} disabled={!industry.enabled}>
              {industry.label}
              {!industry.enabled ? " (coming soon)" : ""}
            </option>
          ))}
        </select>

        <label htmlFor="file">Submission file (PDF or EML)</label>
        <input
          id="file"
          ref={fileInputRef}
          type="file"
          accept=".pdf,.eml,application/pdf,message/rfc822"
          onChange={handleFileChange}
          required
        />
        {fileError && <div className="error-text">{fileError}</div>}
        {file && !fileError && <div className="notice-text">Selected: {file.name}</div>}

        {submitError && <div className="error-text">{submitError}</div>}

        <button
          type="submit"
          disabled={!selectedIndustry || !file || !!fileError || status === "submitting"}
        >
          {status === "submitting" ? "Submitting…" : "Submit"}
        </button>
      </form>
    </div>
  );
}
