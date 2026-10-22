"use client";

import { useEffect, useState } from "react";

type IgAccount = { id: string; username: string };

export default function PosterPage() {
  const [accounts, setAccounts] = useState<IgAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [containerId, setContainerId] = useState("");
  const [createOut, setCreateOut] = useState("");
  const [publishOut, setPublishOut] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/instagram/accounts")
      .then((r) => r.json())
      .then((j) => {
        const list: IgAccount[] = (j?.data?.instagramAccounts ?? []).map(
          (a: { id: string; username: string }) => ({
            id: a.id,
            username: a.username,
          })
        );
        setAccounts(list);
        const def =
          list.find((a) => a.username === "secondorder__") ?? list[0];
        if (def) setAccountId(def.id);
      })
      .catch(() => {});
  }, []);

  async function callPublish(payload: Record<string, string>) {
    const res = await fetch("/api/instagram/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  async function doCreate() {
    setBusy(true);
    setCreateOut("Creating container...");
    try {
      const j = await callPublish({
        action: "create",
        instagramAccountId: accountId,
        videoUrl,
        caption,
      });
      setCreateOut(JSON.stringify(j, null, 2));
      if (j?.containerId) setContainerId(j.containerId);
    } catch (e) {
      setCreateOut("Error: " + String(e));
    }
    setBusy(false);
  }

  async function doPublish() {
    setBusy(true);
    setPublishOut("Checking status / publishing...");
    try {
      const j = await callPublish({
        action: "publish",
        instagramAccountId: accountId,
        containerId,
      });
      setPublishOut(JSON.stringify(j, null, 2));
    } catch (e) {
      setPublishOut("Error: " + String(e));
    }
    setBusy(false);
  }

  const label: React.CSSProperties = {
    display: "block",
    fontWeight: 600,
    margin: "16px 0 6px",
  };
  const field: React.CSSProperties = {
    width: "100%",
    padding: "10px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    fontSize: "14px",
  };
  const btn: React.CSSProperties = {
    marginTop: "14px",
    padding: "12px 20px",
    borderRadius: "8px",
    border: "none",
    background: "#111",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: "15px",
  };
  const out: React.CSSProperties = {
    background: "#f6f6f6",
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "12px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    fontSize: "13px",
    marginTop: "10px",
  };

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 800 }}>Reel Poster</h1>
      <p>
        Internal tool. Step 1 creates an unpublished media container on
        Instagram. Step 2 publishes it once Instagram has finished
        processing the video. Nothing is public until Step 2 succeeds.
      </p>

      <label style={label} htmlFor="account">
        Instagram account
      </label>
      <select
        id="account"
        style={field}
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            @{a.username}
          </option>
        ))}
      </select>

      <label style={label} htmlFor="videoUrl">
        Video URL (public link to the .mp4)
      </label>
      <input
        id="videoUrl"
        style={field}
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
        placeholder="https://..."
      />

      <label style={label} htmlFor="caption">
        Caption (exact text)
      </label>
      <textarea
        id="caption"
        style={{ ...field, minHeight: "220px" }}
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
      />

      <button style={btn} onClick={doCreate} disabled={busy}>
        Step 1: Create container
      </button>
      {createOut ? <pre style={out}>{createOut}</pre> : null}

      <label style={label} htmlFor="containerId">
        Container ID
      </label>
      <input
        id="containerId"
        style={field}
        value={containerId}
        onChange={(e) => setContainerId(e.target.value)}
      />

      <button style={btn} onClick={doPublish} disabled={busy}>
        Step 2: Check status and publish
      </button>
      {publishOut ? <pre style={out}>{publishOut}</pre> : null}
    </div>
  );
}
