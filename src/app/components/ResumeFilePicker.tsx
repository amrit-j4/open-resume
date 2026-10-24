"use client";
import { useRef, useState } from "react";
import { ArrowUpTrayIcon, DocumentTextIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { cx } from "lib/cx";

export const MAX_RESUME_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** Why a file can't be used, or null when it can. */
export const resumeFileProblem = (file: File): string | null => {
  if (!ACCEPTED_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension))) return "Upload a PDF or Word (.docx) file.";
  if (file.size > MAX_RESUME_FILE_BYTES) return "This file is too large. The limit is 5 MB.";
  return null;
};

/**
 * Drop zone and file chooser for a PDF or Word resume. It checks the type and size and reports a problem through `onProblem`, and only hands
 * a usable file to `onChange`.
 */
export const ResumeFilePicker = ({
  file,
  onChange,
  onProblem,
  disabled = false,
  describedBy,
  inputId,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  onProblem: (message: string | null) => void;
  disabled?: boolean;
  describedBy?: string;
  inputId?: string;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const choose = (candidate: File | undefined) => {
    if (!candidate) return;
    const problem = resumeFileProblem(candidate);
    onProblem(problem);
    if (!problem) onChange(candidate);
  };

  return (
    <div
      className={cx(
        "flex flex-col items-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
        isDragging ? "border-gray-500 bg-gray-50" : "border-gray-300",
        disabled && "opacity-60"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!disabled) choose(e.dataTransfer.files[0]);
      }}
    >
      {file ? (
        <div className="flex max-w-full items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-left">
          <DocumentTextIcon className="h-6 w-6 shrink-0 text-gray-500" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
            <p className="text-xs tabular-nums text-gray-500">{formatSize(file.size)}</p>
          </div>
          <button
            type="button"
            aria-label="Remove file"
            disabled={disabled}
            onClick={() => {
              onChange(null);
              onProblem(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 focus-visible:bg-gray-100 disabled:opacity-50"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <>
          <ArrowUpTrayIcon className="h-7 w-7 text-gray-400" aria-hidden="true" />
          <p className="mt-2 text-sm text-gray-700">Drag and drop your resume here, or</p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 focus-visible:bg-gray-100 disabled:opacity-50"
          >
            Choose File
          </button>
          <p className="mt-3 text-xs text-gray-500">PDF or Word (.docx), up to 5&nbsp;MB</p>
        </>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(e) => choose(e.target.files?.[0])}
      />
    </div>
  );
};
