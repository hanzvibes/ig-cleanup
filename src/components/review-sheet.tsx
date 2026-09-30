"use client";

import { useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import type { InstagramAccount } from "@/features/instagram-data/types";

import { BookmarkIcon, CheckIcon, CloseIcon, ExternalIcon } from "./icons";

type ReviewSheetProps = {
  account: InstagramAccount;
  followsYou: boolean;
  kept: boolean;
  reviewed: boolean;
  sessionProgress: { position: number; total: number } | null;
  canGoPrevious: boolean;
  canUndo: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onSkip?: () => void;
  onUndo?: () => void;
  onToggleKeep: (username: string) => void;
  onToggleReviewed: (username: string) => void;
};

const CLOSE_THRESHOLD = 96;

export function ReviewSheet({
  account,
  followsYou,
  kept,
  reviewed,
  sessionProgress,
  canGoPrevious,
  canUndo,
  onClose,
  onNext,
  onPrevious,
  onSkip,
  onUndo,
  onToggleKeep,
  onToggleReviewed,
}: ReviewSheetProps) {
  const dragStartY = useRef(0);
  const dragOffsetRef = useRef(0);
  const activePointer = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const profileUrl = "https://www.instagram.com/" + encodeURIComponent(account.username) + "/";

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    activePointer.current = event.pointerId;
    dragStartY.current = event.clientY;
    dragOffsetRef.current = 0;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    const nextOffset = Math.max(0, Math.min(360, event.clientY - dragStartY.current));
    dragOffsetRef.current = nextOffset;
    setDragOffset(nextOffset);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    setDragging(false);

    if (dragOffsetRef.current >= CLOSE_THRESHOLD) {
      onClose();
      return;
    }

    dragOffsetRef.current = 0;
    setDragOffset(0);
  };

  const sheetStyle: CSSProperties = {
    translate: `0 ${dragOffset}px`,
    transition: dragging ? "none" : "translate 180ms cubic-bezier(.2,.75,.25,1)",
  };

  const progressPercent = sessionProgress
    ? Math.round((sessionProgress.position / Math.max(sessionProgress.total, 1)) * 100)
    : 0;

  return (
    <div className="sheetBackdrop" role="presentation" onPointerDown={onClose}>
      <section
        className="reviewSheet"
        role="dialog"
        aria-modal="true"
        aria-label={"Review " + account.username}
        style={sheetStyle}
        onPointerDown={(event: ReactPointerEvent<HTMLElement>) => event.stopPropagation()}
      >
        <div
          className="sheetDragZone"
          data-testid="sheet-drag-zone"
          aria-label="Drag to close"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        ><div className="sheetHandle" /></div>

        <button className="sheetClose" type="button" onClick={onClose} aria-label="Close"><CloseIcon /></button>

        {sessionProgress ? (
          <>
            <div className="sessionProgressPill" data-testid="session-progress">Session {sessionProgress.position} / {sessionProgress.total}</div>
            <div className="sessionProgressTrack" aria-hidden="true"><span style={{ width: progressPercent + "%" }} /></div>
          </>
        ) : null}

        <div className="sheetAvatar" aria-hidden="true">{account.username.slice(0, 2).toUpperCase()}</div>
        <h2>@{account.username}</h2>
        <p className="sheetStatus">
          {followsYou ? "Follows you" : "Does not follow you back"}
          {reviewed ? " · Reviewed" : kept ? " · In Keep list" : ""}
        </p>

        <a className="primaryAction" href={profileUrl} target="_blank" rel="noreferrer">Open in Instagram <ExternalIcon aria-hidden="true" /></a>
        <button className="secondaryAction" type="button" onClick={() => onToggleReviewed(account.username)}>
          <CheckIcon aria-hidden="true" /> {reviewed ? "Move back to review queue" : "Mark as reviewed"}
        </button>
        <button className="secondaryAction" type="button" onClick={() => onToggleKeep(account.username)}>
          <BookmarkIcon aria-hidden="true" /> {kept ? "Remove from Keep list" : "Add to Keep list"}
        </button>

        {sessionProgress ? (
          <div className="sessionNavGrid">
            <button type="button" onClick={onPrevious} disabled={!canGoPrevious}>Previous account</button>
            <button type="button" onClick={onSkip}>Skip</button>
            <button type="button" onClick={onNext}>Next account</button>
          </div>
        ) : null}

        {canUndo && onUndo ? <button className="undoAction" type="button" onClick={onUndo}>Undo last action</button> : null}

        <p className="sheetNote">Unfollow decisions stay in Instagram. IG Cleanup only manages your local review workflow.</p>
      </section>
    </div>
  );
}
