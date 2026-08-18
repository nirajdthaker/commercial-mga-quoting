import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ref, uploadBytes } from "firebase/storage";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, storage } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { INDUSTRIES } from "../config/industries";

const ACCEPTED_EXTENSIONS = [".pdf", ".eml", ".xlsx", ".csv", ".docx"];
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 10;

function hasAcceptedExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

type Status = "idle" | "submitting" | "received" | "error";

export function CreateFactSheet() {
  const { user, signOut } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [industryId, setIndustryId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receivedCount, setReceivedCount] = useState(0);

  const selectedIndustry = INDUSTRIES.find((i) => i.id === industryId);

  const handleFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    setFileError(null);
    setFiles([]);

    if (selected.length === 0) return;

    if (selected.length > MAX_FILES) {
      setFileError(`Select at most ${MAX_FILES} files at a time.`);
      return;
    }
    const badFile = selected.find((f) => !hasAcceptedExtension(f.name));
    if (badFile) {
      setFileError(`"${badFile.name}" isn't a supported type. Only PDF, EML, XLSX, CSV, or Word (.docx) files are accepted.`);
      return;
    }
    const bigFile = selected.find((f) => f.size > MAX_FILE_BYTES);
    if (bigFile) {
      setFileError(`"${bigFile.name}" is too large (25 MB max).`);
      return;
    }
    setFiles(selected);
  };

  const resetForm = () => {
    setIndustryId("");
    setFiles([]);
    setFileError(null);
    setSubmitError(null);
    setStatus("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !selectedIndustry || files.length === 0) return;

    setStatus("submitting");
    setSubmitError(null);

    try {
      // Uploaded sequentially rather than in parallel purely to keep this
      // simple - Fact Sheet uploads are a handful of files at most, so
      // there's no real latency cost to doing them one at a time.
      const uploaded: Array<{ fileName: string; filePath: string }> = [];
      for (const file of files) {
        const path = `uploads/${user.uid}/${Date.now()}-${sanitizeFileName(file.name)}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file, { contentType: file.type || undefined });
        uploaded.push({ fileName: file.name, filePath: path });
      }

      await addDoc(collection(db, "submissions"), {
        kind: "factSheet",
        industryId: selectedIndustry.id,
        files: uploaded,
        uploadedBy: user.uid,
        uploadedAt: serverTimestamp(),
        status: "uploaded",
      });

      setReceivedCount(uploaded.length);
      setStatus("received");
    } catch {
      setSubmitError("Something went wrong submitting your files. Please try again.");
      setStatus("error");
    }
  };

  if (status === "received") {
    return (
      <div className="page-center">
        <div className="card">
          <h1>Received</h1>
          <p className="subtitle">
            {receivedCount} file{receivedCount === 1 ? "" : "s"} received.
          </p>
          <p className="fine-print">
            Extraction is running in the background. Once it's done, check the{" "}
            <Link to="/review">review queue</Link> to confirm the merged data — any fields the
            source documents disagreed on will be flagged for you to pick.
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
            <h1>Create Fact Sheet</h1>
            <p className="subtitle">Florida Coastal Insurance Agency</p>
          </div>
          <div className="header-actions">
            <Link to="/" className="link-button">
              ACORD intake
            </Link>
            <Link to="/review" className="link-button">
              Review queue
            </Link>
            <button type="button" className="link-button" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
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

        <label htmlFor="files">Client documents (PDF, EML, XLSX, CSV, or Word)</label>
        <input
          id="files"
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.eml,.xlsx,.csv,.docx,application/pdf,message/rfc822,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFilesChange}
          required
        />
        {fileError && <div className="error-text">{fileError}</div>}
        {files.length > 0 && !fileError && (
          <div className="notice-text">
            Selected: {files.map((f) => f.name).join(", ")}
          </div>
        )}

        {submitError && <div className="error-text">{submitError}</div>}

        <button
          type="submit"
          disabled={!selectedIndustry || files.length === 0 || !!fileError || status === "submitting"}
        >
          {status === "submitting" ? "Submitting…" : "Submit"}
        </button>
      </form>
    </div>
  );
}
