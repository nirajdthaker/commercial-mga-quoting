import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, onSnapshot, orderBy, query, limit, type QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { INDUSTRIES } from "../config/industries";
import type { Submission } from "../types/submission";

const STATUS_LABELS: Record<Submission["status"], string> = {
  uploaded: "Queued",
  extracting: "Extracting…",
  extracted: "Ready for review",
  extraction_failed: "Extraction failed",
  reviewed: "Reviewed",
};

function industryLabel(industryId: string): string {
  return INDUSTRIES.find((i) => i.id === industryId)?.label ?? industryId;
}

function statusDisplay(data: Submission): { label: string; badgeClass: string } {
  if (data.status === "reviewed" && data.sendStatus) {
    if (data.sendStatus === "sending") return { label: "Sending…", badgeClass: "status-reviewed" };
    if (data.sendStatus === "sent") return { label: "Sent", badgeClass: "status-sent" };
    if (data.sendStatus === "send_failed") return { label: "Send failed", badgeClass: "status-extraction_failed" };
  }
  return { label: STATUS_LABELS[data.status] ?? data.status, badgeClass: `status-${data.status}` };
}

function formatDate(submission: Submission): string {
  return submission.uploadedAt?.toDate?.().toLocaleString() ?? "—";
}

export function ReviewList() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Array<{ id: string; data: Submission }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "submissions"), orderBy("uploadedAt", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSubmissions(
        snapshot.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, data: d.data() as Submission }))
      );
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <div className="page-center">
      <div className="card card-wide">
        <div className="header-row">
          <div>
            <h1>Review Queue</h1>
            <p className="subtitle">Florida Coastal Insurance Agency</p>
          </div>
          <div className="header-actions">
            <Link to="/" className="link-button">
              New submission
            </Link>
            <button type="button" className="link-button" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </div>

        {loading && <p className="fine-print">Loading…</p>}
        {!loading && submissions.length === 0 && <p className="fine-print">No submissions yet.</p>}

        {submissions.length > 0 && (
          <table className="submission-table">
            <thead>
              <tr>
                <th>Industry</th>
                <th>File</th>
                <th>Uploaded</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map(({ id, data }) => {
                const reviewable = data.status === "extracted" || data.status === "reviewed";
                const { label, badgeClass } = statusDisplay(data);
                return (
                  <tr
                    key={id}
                    className={reviewable ? "row-clickable" : undefined}
                    onClick={reviewable ? () => navigate(`/review/${id}`) : undefined}
                  >
                    <td>{industryLabel(data.industryId)}</td>
                    <td>{data.fileName}</td>
                    <td>{formatDate(data)}</td>
                    <td>
                      <span className={`status-badge ${badgeClass}`}>{label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
