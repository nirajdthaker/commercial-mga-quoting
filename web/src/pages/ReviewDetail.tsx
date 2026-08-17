import { useEffect, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { doc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { INDUSTRIES } from "../config/industries";
import {
  LOCATION_FIELDS,
  PROFILE_FIELDS,
  emptyLocationRow,
  type FieldDef,
  type FieldValue,
  type LocationRow,
  type ProfileData,
} from "../config/hotelSchema";
import type { Submission } from "../types/submission";

function industryLabel(industryId: string): string {
  return INDUSTRIES.find((i) => i.id === industryId)?.label ?? industryId;
}

function inputValue(value: FieldValue): string {
  return value === null || value === undefined ? "" : String(value);
}

function parseFieldInput(field: FieldDef, raw: string): FieldValue {
  if (raw === "") return null;
  if (field.type === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return raw;
}

function groupBySection(fields: FieldDef[]): Array<[string, FieldDef[]]> {
  const groups = new Map<string, FieldDef[]>();
  for (const f of fields) {
    if (!groups.has(f.section)) groups.set(f.section, []);
    groups.get(f.section)!.push(f);
  }
  return [...groups.entries()];
}

const PROFILE_SECTIONS = groupBySection(PROFILE_FIELDS);

// Firestore rules allow retrying a "sending" submission once it's been
// stuck for 6 minutes (sendSubmission's own timeout is 300s/5min) - this is
// set a minute past that so the button never appears before the rule would
// actually accept the write.
const STALE_SENDING_MS = 7 * 60 * 1000;

export function ReviewDetail() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState<Submission | null | undefined>(undefined);
  const [profile, setProfile] = useState<ProfileData>({});
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!submissionId) return;
    const unsubscribe = onSnapshot(doc(db, "submissions", submissionId), (snap) => {
      if (!snap.exists()) {
        setSubmission(null);
        return;
      }
      const data = snap.data() as Submission;
      setSubmission(data);
      if (!initialized) {
        setProfile(data.extractedProfile ?? {});
        setLocations(data.extractedLocations ?? []);
        setInitialized(true);
      }
    });
    return unsubscribe;
  }, [submissionId, initialized]);

  // Ticks while a send is in flight so a stuck "sending" (the function was
  // killed mid-flight and never got to record an error) surfaces a retry
  // option on its own, without needing a page refresh to notice.
  useEffect(() => {
    if (submission?.sendStatus !== "sending") return;
    const interval = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(interval);
  }, [submission?.sendStatus]);

  const handleProfileChange = (field: FieldDef, raw: string) => {
    setProfile((prev) => ({ ...prev, [field.key]: parseFieldInput(field, raw) }));
  };

  const handleLocationChange = (index: number, field: FieldDef, raw: string) => {
    setLocations((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field.key]: parseFieldInput(field, raw) } : row))
    );
  };

  const addLocation = () => setLocations((prev) => [...prev, emptyLocationRow()]);
  const removeLocation = (index: number) =>
    setLocations((prev) => prev.filter((_, i) => i !== index));

  const save = async (markReviewed: boolean) => {
    if (!submissionId || !user) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateDoc(doc(db, "submissions", submissionId), {
        extractedProfile: profile,
        extractedLocations: locations,
        status: markReviewed ? "reviewed" : "extracted",
        ...(markReviewed ? { reviewedBy: user.uid, reviewedAt: serverTimestamp() } : {}),
      });
      if (markReviewed) navigate("/review");
    } catch {
      setSaveError("Couldn't save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const retrySend = async () => {
    if (!submissionId) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateDoc(doc(db, "submissions", submissionId), { sendStatus: "retry" });
    } catch {
      setSaveError("Couldn't retry the send. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (submission === undefined) {
    return <div className="page-center">Loading…</div>;
  }

  if (submission === null) {
    return (
      <div className="page-center">
        <div className="card">
          <h1>Not found</h1>
          <p className="fine-print">This submission doesn't exist.</p>
          <Link to="/review" className="link-button">
            Back to review queue
          </Link>
        </div>
      </div>
    );
  }

  const isReviewed = submission.status === "reviewed";
  const canEdit = submission.status === "extracted";
  const isStaleSending =
    submission.sendStatus === "sending" &&
    !!submission.sendStartedAt &&
    now - submission.sendStartedAt.toDate().getTime() > STALE_SENDING_MS;

  return (
    <div className="page-center">
      <div className="card card-wide">
        <div className="header-row">
          <div>
            <h1>{industryLabel(submission.industryId)} Submission</h1>
            <p className="subtitle">{submission.fileName}</p>
          </div>
          <div className="header-actions">
            <Link to="/review" className="link-button">
              Back to queue
            </Link>
            <button type="button" className="link-button" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </div>

        {!canEdit && !isReviewed && (
          <p className="notice-text">
            {submission.status === "extraction_failed"
              ? `Extraction failed: ${submission.extractionError ?? "unknown error"}`
              : "Extraction is still running — check back shortly."}
          </p>
        )}

        {(canEdit || isReviewed) && (
          <>
            {isReviewed && (
              <p className="notice-text">
                Reviewed{submission.reviewedAt ? ` on ${submission.reviewedAt.toDate().toLocaleString()}` : ""}.
              </p>
            )}

            {isReviewed && submission.sendStatus === "sending" && !isStaleSending && (
              <p className="notice-text">Filling the ACORDs and SOV and uploading them to Drive…</p>
            )}
            {isReviewed && submission.sendStatus === "sending" && isStaleSending && (
              <>
                <p className="notice-text">
                  This is taking much longer than expected and may have failed silently.
                </p>
                <div className="button-row">
                  <button type="button" onClick={() => void retrySend()} disabled={saving}>
                    {saving ? "Retrying…" : "Retry send"}
                  </button>
                </div>
              </>
            )}
            {isReviewed && submission.sendStatus === "sent" && (
              <p className="notice-text">
                Filled ACORDs and SOV uploaded to Drive
                {submission.sentAt ? ` on ${submission.sentAt.toDate().toLocaleString()}` : ""}.
              </p>
            )}
            {isReviewed && submission.sendStatus === "send_failed" && (
              <>
                <div className="error-text">Send failed: {submission.sendError ?? "unknown error"}</div>
                <div className="button-row">
                  <button type="button" onClick={() => void retrySend()} disabled={saving}>
                    {saving ? "Retrying…" : "Retry send"}
                  </button>
                </div>
              </>
            )}

            <h2 className="section-heading">Risk Profile</h2>
            {PROFILE_SECTIONS.map(([section, fields]) => (
              <details key={section} className="field-section" open>
                <summary>{section}</summary>
                <div className="field-grid">
                  {fields.map((field) => (
                    <div key={field.key} className="field-grid-item">
                      <label htmlFor={`profile-${field.key}`}>{field.label}</label>
                      {field.type === "boolean" ? (
                        <select
                          id={`profile-${field.key}`}
                          value={profile[field.key] === true ? "yes" : profile[field.key] === false ? "no" : ""}
                          disabled={!canEdit}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                            setProfile((prev) => ({
                              ...prev,
                              [field.key]: e.target.value === "" ? null : e.target.value === "yes",
                            }))
                          }
                        >
                          <option value="">—</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      ) : (
                        <input
                          id={`profile-${field.key}`}
                          type={field.type === "number" ? "number" : "text"}
                          value={inputValue(profile[field.key])}
                          disabled={!canEdit}
                          onChange={(e) => handleProfileChange(field, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </details>
            ))}

            <h2 className="section-heading">SOV / Locations</h2>
            {locations.length === 0 && <p className="fine-print">No locations extracted.</p>}
            {locations.map((row, index) => (
              <div key={index} className="location-row">
                <div className="field-grid">
                  {LOCATION_FIELDS.map((field) => (
                    <div key={field.key} className="field-grid-item">
                      <label htmlFor={`loc-${index}-${field.key}`}>{field.label}</label>
                      <input
                        id={`loc-${index}-${field.key}`}
                        type={field.type === "number" ? "number" : "text"}
                        value={inputValue(row[field.key])}
                        disabled={!canEdit}
                        onChange={(e) => handleLocationChange(index, field, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                {canEdit && (
                  <button type="button" className="link-button" onClick={() => removeLocation(index)}>
                    Remove this location
                  </button>
                )}
              </div>
            ))}
            {canEdit && (
              <button type="button" className="link-button" onClick={addLocation}>
                + Add location
              </button>
            )}

            {saveError && <div className="error-text">{saveError}</div>}

            {canEdit && (
              <div className="button-row">
                <button type="button" onClick={() => void save(false)} disabled={saving}>
                  {saving ? "Saving…" : "Save draft"}
                </button>
                <button type="button" onClick={() => void save(true)} disabled={saving}>
                  {saving ? "Saving…" : "Confirm & mark reviewed"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
